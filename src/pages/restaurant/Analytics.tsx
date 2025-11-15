import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import type { OrderItem, Product } from '@/types/database'

type RangePreset = '1m' | '3m' | '6m'

const RANGE_LABELS: Record<RangePreset, string> = {
  '1m': 'Ultimo mese',
  '3m': 'Ultimi 3 mesi',
  '6m': 'Ultimi 6 mesi',
}

interface ProductStats {
  product_id: string
  name: string
  total_quantity: number
  total_revenue: number
  last_order_at: string | null
}

const DEFAULT_RANGE: RangePreset = '1m'

export function RestaurantAnalytics() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [range, setRange] = useState<RangePreset>(DEFAULT_RANGE)
  const [loading, setLoading] = useState(true)
  const [productsMap, setProductsMap] = useState<Record<string, Product>>({})
  const [items, setItems] = useState<OrderItem[]>([])

  useEffect(() => {
    async function init() {
      try {
        const user = await getCurrentUser()
        if (!user?.restaurant_id) {
          toast.error('Utente non associato ad alcun ristorante')
          return
        }
        setRestaurantId(user.restaurant_id)
        await fetchProducts(user.restaurant_id)
      } catch (error) {
        console.error('Analytics init error:', error)
        toast.error('Errore nel caricamento dei dati')
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!restaurantId) return
    fetchOrderItems(restaurantId, range)
  }, [restaurantId, range])

  async function fetchProducts(restId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restId)

    if (error) {
      console.error('Products fetch error:', error)
      toast.error('Errore nel caricamento dei prodotti')
      return
    }

    const map: Record<string, Product> = {}
    data?.forEach(product => {
      map[product.id] = product
    })
    setProductsMap(map)
  }

  async function fetchOrderItems(restId: string, preset: RangePreset) {
    try {
      setLoading(true)

      const endDate = new Date()
      const startDate = new Date()
      if (preset === '1m') startDate.setMonth(startDate.getMonth() - 1)
      if (preset === '3m') startDate.setMonth(startDate.getMonth() - 3)
      if (preset === '6m') startDate.setMonth(startDate.getMonth() - 6)

      const { data, error } = await supabase
        .from('order_items')
        .select(
          `
            *,
            orders!inner (
              restaurant_id,
              status,
              created_at
            )
          `
        )
        .eq('orders.restaurant_id', restId)
        .eq('orders.status', 'paid')
        .gte('orders.created_at', startDate.toISOString())
        .lte('orders.created_at', endDate.toISOString())

      if (error) throw error

      setItems(data ?? [])
    } catch (error: any) {
      console.error('Order items fetch error:', error)
      toast.error(error.message || 'Errore nel caricamento delle statistiche')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo<ProductStats[]>(() => {
    const aggregates: Record<string, ProductStats> = {}

    items.forEach(item => {
      const product = productsMap[item.product_id]
      if (!product) return

      if (!aggregates[item.product_id]) {
        aggregates[item.product_id] = {
          product_id: item.product_id,
          name: product.name,
          total_quantity: 0,
          total_revenue: 0,
          last_order_at: null,
        }
      }

      aggregates[item.product_id].total_quantity += item.quantity
      aggregates[item.product_id].total_revenue += item.total_price ?? 0

      const orderDate = (item as any).orders?.created_at
      if (orderDate) {
        if (
          !aggregates[item.product_id].last_order_at ||
          new Date(orderDate) > new Date(aggregates[item.product_id].last_order_at!)
        ) {
          aggregates[item.product_id].last_order_at = orderDate
        }
      }
    })

    return Object.values(aggregates).sort((a, b) => b.total_quantity - a.total_quantity)
  }, [items, productsMap])

  const topProducts = stats.slice(0, 5)
  const bottomProducts = stats.slice(-5).reverse()

  const totalQuantity = stats.reduce((sum, product) => sum + product.total_quantity, 0)
  const totalRevenue = stats.reduce((sum, product) => sum + product.total_revenue, 0)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—'

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Statistiche Piatti</h1>
        <p className="text-sm text-gray-600">
          Analizza i piatti più ordinati e identifica quelli meno richiesti nel periodo selezionato.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map(preset => (
          <button
            key={preset}
            onClick={() => setRange(preset)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              range === preset
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            {RANGE_LABELS[preset]}
          </button>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-1">
          <p className="text-sm text-gray-500">Quantità totale venduta</p>
          <p className="text-2xl font-semibold text-gray-900">{totalQuantity}</p>
          <p className="text-xs text-gray-400">Somma totale delle porzioni vendute</p>
        </div>
        <div className="card space-y-1">
          <p className="text-sm text-gray-500">Fatturato stimato</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400">Valore totale degli ordini pagati (periodo selezionato)</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top 5 piatti più ordinati</h2>
            <span className="text-sm text-gray-500">Per quantità</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600"></div>
            </div>
          ) : topProducts.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              Nessun dato disponibile per il periodo selezionato.
            </div>
          ) : (
            <ul className="space-y-3">
              {topProducts.map((product, index) => (
                <li
                  key={product.product_id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">
                          Ultimo ordine: {formatDate(product.last_order_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{product.total_quantity} porzioni</p>
                    <p className="text-xs text-gray-500">{formatCurrency(product.total_revenue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top 5 piatti meno ordinati</h2>
            <span className="text-sm text-gray-500">Per quantità</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600"></div>
            </div>
          ) : bottomProducts.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              Nessun dato disponibile per il periodo selezionato.
            </div>
          ) : (
            <ul className="space-y-3">
              {bottomProducts.map((product, index) => (
                <li
                  key={product.product_id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">
                          Ultimo ordine: {formatDate(product.last_order_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{product.total_quantity} porzioni</p>
                    <p className="text-xs text-gray-500">{formatCurrency(product.total_revenue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Classifica completa</h2>
          <span className="text-sm text-gray-500">
            {stats.length} {stats.length === 1 ? 'piatto' : 'piatti'}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600"></div>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Nessun piatto trovato per il periodo selezionato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Prodotto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Quantità
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fatturato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Ultimo ordine
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {stats.map((product, index) => (
                  <tr key={product.product_id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                      {product.total_quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                      {formatCurrency(product.total_revenue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(product.last_order_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}




