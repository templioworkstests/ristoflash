import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { toast } from 'react-hot-toast'

type Order = import('@/types/database').Order
type OrderItem = import('@/types/database').OrderItem
type Product = import('@/types/database').Product

export function RestaurantOrders() {
  const [orders, setOrders] = useState<(Order & { items: OrderItem[]; table_name: string })[]>([])
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [selectedOrder] = useState<string | null>(null)

  useEffect(() => {
    let channel: any = null

    async function loadData() {
      const user = await getCurrentUser()
      if (user?.restaurant_id) {
        setRestaurantId(user.restaurant_id)
        await fetchProducts(user.restaurant_id)
        await fetchOrders(user.restaurant_id)
        
        // Setup realtime subscription
        channel = supabase
          .channel('orders-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'orders',
              filter: `restaurant_id=eq.${user.restaurant_id}`,
            },
            () => {
              if (user.restaurant_id) {
                fetchOrders(user.restaurant_id)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'order_items',
            },
            () => {
              if (user.restaurant_id) {
                fetchOrders(user.restaurant_id)
              }
            }
          )
          .subscribe()
      }
    }

    loadData()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  async function fetchProducts(restId: string) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restId)

      if (error) throw error
      const productsMap: Record<string, Product> = {}
      data?.forEach(p => {
        productsMap[p.id] = p
      })
      setProducts(productsMap)
    } catch (error: any) {
      console.error('Error fetching products:', error)
    }
  }

  async function fetchOrders(restId: string) {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch order items
      const orderIds = ordersData?.map(o => o.id) || []
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      if (itemsError) throw itemsError

      // Fetch table names
      const tableIds = [...new Set(ordersData?.map(o => o.table_id) || [])]
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('id, name')
        .in('id', tableIds)

      if (tablesError) throw tablesError

      const tablesMap: Record<string, string> = {}
      tablesData?.forEach(t => {
        tablesMap[t.id] = t.name
      })

      // Group items by order
      const itemsByOrder: Record<string, OrderItem[]> = {}
      itemsData?.forEach(item => {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = []
        }
        itemsByOrder[item.order_id].push(item)
      })

      const ordersWithItems = ordersData?.map(order => ({
        ...order,
        items: itemsByOrder[order.id] || [],
        table_name: tablesMap[order.table_id] || 'Tavolo sconosciuto',
      })) || []

      setOrders(ordersWithItems)

      // Play sound for new orders
      if (ordersWithItems.some(o => o.status === 'pending')) {
        playNotificationSound()
      }
    } catch (error: any) {
      toast.error('Errore nel caricamento degli ordini')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function playNotificationSound() {
    // Create a simple notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  async function updateOrderStatus(orderId: string, status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid') {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (error) throw error

      // Also update all items
      await supabase
        .from('order_items')
        .update({ status })
        .eq('order_id', orderId)

      toast.success('Stato ordine aggiornato')
      if (restaurantId) {
        fetchOrders(restaurantId)
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'aggiornamento')
    }
  }

  async function markAsPaid(orderId: string) {
    await updateOrderStatus(orderId, 'paid')
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'preparing':
        return 'bg-blue-100 text-blue-800'
      case 'ready':
        return 'bg-green-100 text-green-800'
      case 'served':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'pending':
        return 'In attesa'
      case 'preparing':
        return 'In preparazione'
      case 'ready':
        return 'Pronto'
      case 'served':
        return 'Servito'
      case 'paid':
        return 'Pagato'
      default:
        return status
    }
  }

  const groupedOrders = orders.reduce((acc, order) => {
    if (!acc[order.table_id]) {
      acc[order.table_id] = []
    }
    acc[order.table_id].push(order)
    return acc
  }, {} as Record<string, typeof orders>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Ordini in Tempo Reale</h1>

      <div className="space-y-6">
        {Object.entries(groupedOrders).map(([tableId, tableOrders]) => (
          <div key={tableId} className="card">
            <h2 className="text-xl font-semibold mb-4">
              {tableOrders[0]?.table_name || 'Tavolo sconosciuto'}
            </h2>
            
            <div className="space-y-4">
              {tableOrders.map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-lg p-4 ${
                    selectedOrder === order.id ? 'border-primary-500 bg-primary-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {order.created_at ? new Date(order.created_at).toLocaleTimeString('it-IT') : ''}
                        </span>
                      </div>
                      {order.notes && (
                        <p className="mt-2 text-sm text-gray-600">Note: {order.notes}</p>
                      )}
                    </div>
                    <span className="text-lg font-bold">€{order.total_amount.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map((item) => {
                      const product = products[item.product_id]
                      return (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>
                            {item.quantity}x {product?.name || 'Prodotto'}
                            {item.notes && <span className="text-gray-500"> ({item.notes})</span>}
                          </span>
                          <span>€{(item.total_price).toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex space-x-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="btn btn-primary text-sm"
                      >
                        Inizia Preparazione
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="btn btn-primary text-sm"
                      >
                        Segna come Pronto
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="btn btn-primary text-sm"
                      >
                        Segna come Servito
                      </button>
                    )}
                    {order.status !== 'paid' && (
                      <button
                        onClick={() => markAsPaid(order.id)}
                        className="btn btn-secondary text-sm"
                      >
                        Conto Pagato
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500">Nessun ordine attivo</p>
          </div>
        )}
      </div>
    </div>
  )
}

