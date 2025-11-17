import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { toast } from 'react-hot-toast'
import { OrderEditorModal } from '@/components/OrderEditorModal'

type Order = import('@/types/database').Order
type OrderItem = import('@/types/database').OrderItem
type Product = import('@/types/database').Product

type RestaurantOrder = Order & { items: OrderItem[]; table_name: string }

export function RestaurantOrders() {
  const [orders, setOrders] = useState<RestaurantOrder[]>([])
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    activeWaiterCalls: 0,
  })
  const [selectedOrder] = useState<string | null>(null)
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<RestaurantOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [editingOrder, setEditingOrder] = useState<RestaurantOrder | null>(null)
  const [showWaiterCalls, setShowWaiterCalls] = useState(false)
  const [waiterCalls, setWaiterCalls] = useState<Array<{ id: string; table_id: string; table_name: string; created_at: string | null }>>([])
  const [loadingCalls, setLoadingCalls] = useState(false)

  useEffect(() => {
    let channel: any = null

    async function loadData() {
      const user = await getCurrentUser()
      if (user?.restaurant_id) {
        setRestaurantId(user.restaurant_id)
        await fetchProducts(user.restaurant_id)
        await fetchOrders(user.restaurant_id)
        await fetchStats(user.restaurant_id)
        
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
                fetchStats(user.restaurant_id)
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
                fetchStats(user.restaurant_id)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'waiter_calls',
              filter: `restaurant_id=eq.${user.restaurant_id}`,
            },
            () => {
              if (user.restaurant_id) {
                fetchStats(user.restaurant_id)
                if (showWaiterCalls) {
                  fetchWaiterCalls(user.restaurant_id)
                }
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
        .in('status', ['pending', 'preparing', 'ready', 'served'])
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
      // Update counters from current orders
      setStats(prev => ({
        ...prev,
        pendingOrders: ordersWithItems.filter(o => o.status === 'pending').length,
        preparingOrders: ordersWithItems.filter(o => o.status === 'preparing').length,
        readyOrders: ordersWithItems.filter(o => o.status === 'ready').length,
      }))
    } catch (error: any) {
      toast.error('Errore nel caricamento degli ordini')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats(restId: string) {
    try {
      // Active waiter calls
      const { data: calls, error: callsError } = await supabase
        .from('waiter_calls')
        .select('id')
        .eq('restaurant_id', restId)
        .eq('status', 'active')
      if (callsError) throw callsError
      setStats(prev => ({
        ...prev,
        activeWaiterCalls: calls?.length || 0,
      }))
    } catch (error) {
      // Non-bloccante
      console.warn('Errore nel caricamento delle chiamate cameriere:', error)
    }
  }

  async function fetchWaiterCalls(restId: string) {
    try {
      setLoadingCalls(true)
      const { data, error } = await supabase
        .from('waiter_calls')
        .select('id, table_id, created_at, tables!inner(id, name)')
        .eq('restaurant_id', restId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      const list =
        (data || []).map((row: any) => ({
          id: row.id as string,
          table_id: row.table_id as string,
          table_name: (row as any).tables?.name ?? 'Tavolo',
          created_at: row.created_at as string | null,
        })) ?? []
      setWaiterCalls(list)
    } catch (error: any) {
      console.error('Errore caricamento chiamate:', error)
      toast.error(error.message || 'Errore nel caricamento delle chiamate')
    } finally {
      setLoadingCalls(false)
    }
  }

  async function resolveWaiterCall(callId: string) {
    if (!restaurantId) return
    try {
      const { error } = await supabase
        .from('waiter_calls')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', callId)
      if (error) throw error
      toast.success('Chiamata risolta')
      fetchStats(restaurantId)
      if (showWaiterCalls) {
        fetchWaiterCalls(restaurantId)
      }
    } catch (error: any) {
      console.error('Errore risoluzione chiamata:', error)
      toast.error(error.message || 'Errore durante la risoluzione')
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

  async function updateOrderStatus(
    orderId: string,
    status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid',
    paymentMethod?: 'cash' | 'card'
  ) {
    try {
      const payload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status === 'paid' && paymentMethod) {
        payload.payment_method = paymentMethod
      }

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)

      if (error) throw error

      // Also update all items
      await supabase
        .from('order_items')
        .update({ status })
        .eq('order_id', orderId)

      if (status === 'paid') {
        toast.success('Ordine pagato')
      } else {
        toast.success('Stato ordine aggiornato')
      }
      
      if (restaurantId) {
        fetchOrders(restaurantId)
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'aggiornamento')
    }
  }

  async function revokeTableTokens(tableId: string) {
    if (!restaurantId) return
    
    try {
      // Revoca tutti i token attivi per questo tavolo
      const { error } = await supabase
        .from('table_tokens')
        .update({ revoked: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .eq('revoked', false)

      if (error) {
        console.error('Error revoking table tokens:', error)
        // Non mostriamo errore all'utente, è un'operazione secondaria
      }
    } catch (error) {
      console.error('Error revoking table tokens:', error)
    }
  }

  async function markAsPaid(orderId: string, method: 'cash' | 'card' = 'cash') {
    await updateOrderStatus(orderId, 'paid', method)
    
    // Trova il table_id dell'ordine e revoca i token
    const order = orders.find(o => o.id === orderId)
    if (order) {
      await revokeTableTokens(order.table_id)
    }
  }

  function openPaymentModal(order: RestaurantOrder) {
    setPaymentOrder(order)
    setPaymentMethod('cash')
    setPaymentModalOpen(true)
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
        return 'bg-purple-100 text-purple-800'
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
        return 'Pronto per consegna'
      case 'served':
        return 'Consegnato al tavolo'
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

  async function closeTable(tableId: string) {
    if (!restaurantId) return

    const tableOrders = groupedOrders[tableId] || []
    const orderIds = tableOrders.map(order => order.id)

    if (orderIds.length === 0) {
      toast.dismiss()
      toast.success('Tavolo già libero')
      return
    }

    try {
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString(), payment_method: 'cash' })
        .in('id', orderIds)

      if (ordersError) throw ordersError

      const { error: itemsError } = await supabase
        .from('order_items')
        .update({ status: 'paid' })
        .in('order_id', orderIds)

      if (itemsError) throw itemsError

      // Revoca i token del QR code per questo tavolo
      await revokeTableTokens(tableId)

      toast.success('Tavolo pagato e svuotato. QR code invalidato.')
      fetchOrders(restaurantId)
    } catch (error: any) {
      toast.error(error.message || 'Errore durante il pagamento del tavolo')
    }
  }

  const paymentOrderSubtotal = useMemo(() => {
    if (!paymentOrder) return 0
    return paymentOrder.items.reduce((sum, item) => sum + item.total_price, 0)
  }, [paymentOrder])

  const paymentOrderTotal = paymentOrder?.total_amount ?? 0

  async function refreshOrders() {
    if (restaurantId) {
      await fetchOrders(restaurantId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <>
      {editingOrder && (
        <OrderEditorModal
          order={editingOrder}
          tableName={editingOrder.table_name}
          products={products}
          open={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          onUpdated={refreshOrders}
        />
      )}

      {isPaymentModalOpen && paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Paga Conto</h3>
                <p className="text-sm text-gray-500">
                  Tavolo {paymentOrder.table_name} · Ordine #{paymentOrder.id.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => {
                  setPaymentModalOpen(false)
                  setPaymentOrder(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700">Riepilogo ordine</h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  {paymentOrder.items.map(item => {
                    const product = products[item.product_id]
                    return (
                      <li key={item.id} className="flex justify-between">
                        <span>
                          {item.quantity}× {product?.name || 'Prodotto'}
                          {item.notes && <span className="text-gray-500"> – {item.notes}</span>}
                        </span>
                        <span className="font-medium">€{item.total_price.toFixed(2)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotale</span>
                  <span>€{paymentOrderSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Totale da pagare</span>
                  <span className="text-lg font-bold text-primary-600">€{paymentOrderTotal.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700">Metodo di pagamento</p>
                <div className="mt-3 flex gap-3">
                  <label
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                      paymentMethod === 'cash'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                    />
                    Contanti
                  </label>
                  <label
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                      paymentMethod === 'card'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                    />
                    Carta
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-4">
              <button
                onClick={() => {
                  setPaymentModalOpen(false)
                  setPaymentOrder(null)
                }}
                className="btn btn-secondary"
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  if (!paymentOrder) return
                  await markAsPaid(paymentOrder.id, paymentMethod)
                  setPaymentModalOpen(false)
                  setPaymentOrder(null)
                }}
                className="btn btn-primary"
              >
                Conferma pagamento
              </button>
            </div>
          </div>
        </div>
      )}

    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <div className="h-6 w-6 text-yellow-600">⏳</div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ordini in Attesa</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingOrders}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <div className="h-6 w-6 text-blue-600">👨‍🍳</div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Preparazione</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.preparingOrders}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <div className="h-6 w-6 text-green-600">✅</div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pronti</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.readyOrders}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="card text-left transition hover:shadow-md"
          onClick={async () => {
            if (restaurantId) {
              await fetchWaiterCalls(restaurantId)
            }
            setShowWaiterCalls(true)
          }}
          title="Vedi chiamate cameriere"
        >
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <div className="h-6 w-6 text-red-600">🔔</div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Chiamate Cameriere</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeWaiterCalls}</p>
            </div>
          </div>
        </button>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Ordini in Tempo Reale</h1>

      <div className="space-y-6">
        {Object.entries(groupedOrders).map(([tableId, tableOrders]) => (
          <div key={tableId} className="card">
            <h2 className="text-xl font-semibold mb-4">
              {tableOrders[0]?.table_name || 'Tavolo sconosciuto'}
            </h2>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Totale tavolo:</span>{' '}
                €{tableOrders.reduce((sum, order) => sum + order.total_amount, 0).toFixed(2)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => closeTable(tableId)}
                  className="btn btn-secondary text-sm"
                >
                  Chiudi e Paga Tavolo
                </button>
              </div>
            </div>
            
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
                    <button
                      onClick={() => setEditingOrder(order)}
                      className="btn btn-secondary text-sm"
                    >
                      Modifica Ordine
                    </button>
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
                        Consegnato al Tavolo
                      </button>
                    )}
                    {order.status !== 'paid' && (
                      <button
                        onClick={() => openPaymentModal(order)}
                        className="btn btn-secondary text-sm"
                      >
                        Paga Conto
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

    {showWaiterCalls && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Chiamate Cameriere</h3>
              <p className="text-sm text-gray-500">Elenco chiamate attive dai tavoli</p>
            </div>
            <button
              onClick={() => setShowWaiterCalls(false)}
              className="text-gray-500 hover:text-gray-700"
              title="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-6 py-4">
            {loadingCalls ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              </div>
            ) : waiterCalls.length === 0 ? (
              <div className="text-center py-10 text-gray-500">Nessuna chiamata attiva</div>
            ) : (
              <div className="divide-y">
                {waiterCalls.map(call => (
                  <div key={call.id} className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-gray-900">Tavolo {call.table_name}</p>
                      <p className="text-sm text-gray-600">
                        {call.created_at
                          ? new Date(call.created_at).toLocaleString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resolveWaiterCall(call.id)}
                        className="btn btn-primary"
                      >
                        Chiudi chiamata
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-4">
            <button
              onClick={() => setShowWaiterCalls(false)}
              className="btn btn-secondary"
            >
              Chiudi
            </button>
            <button
              onClick={() => {
                if (restaurantId) fetchWaiterCalls(restaurantId)
              }}
              className="btn btn-primary"
            >
              Aggiorna
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

