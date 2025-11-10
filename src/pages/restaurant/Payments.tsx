import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import type { Order, Table } from '@/types/database'

type Payment = Pick<Order, 'id' | 'table_id' | 'total_amount' | 'payment_method' | 'updated_at' | 'created_at'> & {
  table?: Pick<Table, 'id' | 'name'> | null
}

type Filters = {
  startDate: string
  endDate: string
  method: 'all' | 'cash' | 'card'
}

function getTodayDateString() {
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  const localISO = new Date(now.getTime() - tzOffset).toISOString()
  return localISO.slice(0, 10)
}

const getDefaultFilters = (): Filters => {
  const today = getTodayDateString()
  return {
    startDate: today,
    endDate: today,
    method: 'all',
  }
}

export function RestaurantPayments() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters())
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        const user = await getCurrentUser()
        if (!user?.restaurant_id) {
          toast.error('Utente non associato ad alcun ristorante')
          return
        }
        if (isMounted) {
          setRestaurantId(user.restaurant_id)
        }
      } catch (error) {
        console.error('Load user error:', error)
        toast.error('Errore nel caricamento dell\'utente')
      }
    }

    init()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!restaurantId) return
    fetchPayments(restaurantId, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, filters.startDate, filters.endDate, filters.method])

  async function fetchPayments(restId: string, currentFilters: Filters) {
    try {
      setLoading(true)
      let query = supabase
        .from('orders')
        .select(
          `
            id,
            table_id,
            total_amount,
            payment_method,
            updated_at,
            created_at,
            tables ( id, name )
          `
        )
        .eq('restaurant_id', restId)
        .eq('status', 'paid')
        .order('updated_at', { ascending: false })

      if (currentFilters.startDate) {
        const start = new Date(currentFilters.startDate)
        start.setHours(0, 0, 0, 0)
        query = query.gte('updated_at', start.toISOString())
      }

      if (currentFilters.endDate) {
        const end = new Date(currentFilters.endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('updated_at', end.toISOString())
      }

      if (currentFilters.method !== 'all') {
        query = query.eq('payment_method', currentFilters.method)
      }

      const { data, error } = await query

      if (error) throw error

      const parsedPayments: Payment[] =
        data?.map(payment => ({
          id: payment.id,
          table_id: payment.table_id,
          total_amount: payment.total_amount,
          payment_method: payment.payment_method,
          updated_at: payment.updated_at,
          created_at: payment.created_at,
          table: (payment as any).tables ?? null,
        })) ?? []

      setPayments(parsedPayments)
    } catch (error: any) {
      console.error('Payments fetch error:', error)
      toast.error(error.message || 'Errore nel caricamento dei pagamenti')
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange<T extends keyof Filters>(key: T, value: Filters[T]) {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  function resetFilters() {
    setFilters(getDefaultFilters())
  }

  const totalAmount = useMemo(
    () => payments.reduce((sum, payment) => sum + (payment.total_amount ?? 0), 0),
    [payments]
  )

  const totalCount = payments.length

  const groupedByMethod = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        const key = payment.payment_method ?? 'unknown'
        acc[key] = (acc[key] ?? 0) + (payment.total_amount ?? 0)
        return acc
      },
      {} as Record<string, number>
    )
  }, [payments])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Pagamenti</h1>
        <p className="text-sm text-gray-600">
          Consulta lo storico dei pagamenti ricevuti e filtra per periodo o metodo di pagamento.
        </p>
      </header>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Filtri</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dal</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => handleFilterChange('startDate', event.target.value)}
              className="input mt-1"
              max={filters.endDate || undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Al</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => handleFilterChange('endDate', event.target.value)}
              className="input mt-1"
              min={filters.startDate || undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Metodo</label>
            <select
              value={filters.method}
              onChange={(event) => handleFilterChange('method', event.target.value as Filters['method'])}
              className="input mt-1"
            >
              <option value="all">Tutti</option>
              <option value="cash">Contanti</option>
              <option value="card">Carta</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => restaurantId && fetchPayments(restaurantId, filters)}
              className="btn btn-primary w-full"
            >
              Aggiorna
            </button>
            <button onClick={resetFilters} className="btn btn-secondary w-full">
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Totale incassato</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-gray-400">Ordini pagati nel periodo selezionato</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Numero pagamenti</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalCount}</p>
          <p className="text-xs text-gray-400">Totale scontrini chiusi</p>
        </div>
        <div className="card space-y-2">
          <p className="text-sm text-gray-500">Distribuzione metodi</p>
          {Object.keys(groupedByMethod).length === 0 ? (
            <p className="text-sm text-gray-400">Nessun dato</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-600">
              {Object.entries(groupedByMethod).map(([method, amount]) => (
                <li key={method} className="flex justify-between">
                  <span className="capitalize">{method === 'cash' ? 'Contanti' : method === 'card' ? 'Carta' : 'N/D'}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Storico pagamenti</h2>
          <span className="text-sm text-gray-500">
            {payments.length} {payments.length === 1 ? 'transazione' : 'transazioni'}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Nessun pagamento trovato per i filtri selezionati.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tavolo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Metodo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Totale
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ID Ordine
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map(payment => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatDateTime(payment.updated_at || payment.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {payment.table?.name || 'Tavolo'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 capitalize">
                      {payment.payment_method === 'cash'
                        ? 'Contanti'
                        : payment.payment_method === 'card'
                        ? 'Carta'
                        : 'N/D'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(payment.total_amount ?? 0)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      #{payment.id.slice(0, 8)}
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


