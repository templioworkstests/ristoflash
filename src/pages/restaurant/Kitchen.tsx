import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import type { Order, OrderItem, Product, Table } from '@/types/database'

type KitchenOrder = Order & {
  items: OrderItem[]
  table: Pick<Table, 'id' | 'name'>
}

export function RestaurantKitchen() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [productsMap, setProductsMap] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      try {
        const user = await getCurrentUser()
        if (!user?.restaurant_id) {
          toast.error('Utente non associato ad alcun ristorante')
          return
        }

        const userRestaurantId = user.restaurant_id
        setRestaurantId(userRestaurantId)
        await Promise.all([fetchProducts(userRestaurantId), fetchOrders(userRestaurantId)])

        channel = supabase
          .channel('kitchen-orders')
          .on(
            'postgres_changes',
            {
              schema: 'public',
              table: 'orders',
              filter: `restaurant_id=eq.${userRestaurantId}`,
            },
            (payload) => {
              console.log('[Kitchen] orders change', payload)
              fetchOrders(userRestaurantId)
            }
          )
          .on(
            'postgres_changes',
            {
              schema: 'public',
              table: 'order_items',
            },
            (payload) => {
              console.log('[Kitchen] order_items change', payload)
              fetchOrders(userRestaurantId)
            }
          )
          .subscribe()
      } catch (error) {
        console.error('Kitchen init error:', error)
        toast.error('Errore nel caricamento degli ordini')
      } finally {
        setLoading(false)
      }
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

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

  async function fetchOrders(restId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        tables(id,name)
      `
      )
      .eq('restaurant_id', restId)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Orders fetch error:', error)
      toast.error('Errore nel caricamento degli ordini')
      return
    }

    const normalized =
      data?.map(order => ({
        ...(order as unknown as Order),
        items: (order as any).order_items ?? [],
        table: (order as any).tables ?? { id: order.table_id, name: 'Tavolo' },
      })) ?? []

    setOrders(normalized)
  }

  async function advanceOrder(orderId: string, nextStatus: 'preparing' | 'ready') {
    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (orderError) throw orderError

      const { error: itemsError } = await supabase
        .from('order_items')
        .update({ status: nextStatus })
        .eq('order_id', orderId)

      if (itemsError) throw itemsError

      toast.success(nextStatus === 'preparing' ? 'Ordine in preparazione' : 'Ordine pronto')
    } catch (error: any) {
      console.error('Advance order error:', error)
      toast.error(error.message || 'Errore durante l\'aggiornamento dell\'ordine')
    } finally {
      if (restaurantId) fetchOrders(restaurantId)
    }
  }

  const groupedByStatus = useMemo(
    () =>
      orders.reduce(
        (acc, order) => {
          acc[order.status] = acc[order.status] ? [...acc[order.status], order] : [order]
          return acc
        },
        {} as Record<'pending' | 'preparing', KitchenOrder[]>
      ),
    [orders]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Sala Cucina</h1>
        <p className="text-gray-600">Gestisci la preparazione delle comande in arrivo.</p>
      </header>

      {(['pending', 'preparing'] as const).map(status => (
        <section key={status} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {status === 'pending' ? 'Da iniziare' : 'In preparazione'}
            </h2>
            <span className="text-sm text-gray-500">{groupedByStatus[status]?.length ?? 0} ordini</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groupedByStatus[status]?.map(order => (
              <article key={order.id} className="card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{order.table?.name ?? 'Tavolo'}</p>
                    <p className="text-lg font-semibold text-gray-900">Ordine #{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-700">€{order.total_amount.toFixed(2)}</span>
                </div>

                <ul className="space-y-2">
                  {order.items.map(item => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}× {productsMap[item.product_id]?.name ?? 'Prodotto'}
                        {item.notes && <span className="text-gray-500"> – {item.notes}</span>}
                      </span>
                      <span className="font-medium">€{item.total_price.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    {status === 'pending' ? 'In attesa di chef' : 'In corso'}
                  </span>
                  <button
                    onClick={() => advanceOrder(order.id, status === 'pending' ? 'preparing' : 'ready')}
                    className="btn btn-primary text-sm"
                  >
                    {status === 'pending' ? 'Inizia Preparazione' : 'Segna Pronto'}
                  </button>
                </div>
              </article>
            ))}

            {(!groupedByStatus[status] || groupedByStatus[status].length === 0) && (
              <div className="col-span-full rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
                Nessun ordine in questa colonna
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}


