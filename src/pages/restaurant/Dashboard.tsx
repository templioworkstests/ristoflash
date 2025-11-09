import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { ShoppingCart, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'react-hot-toast'

export function RestaurantDashboard() {
  const [stats, setStats] = useState({
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    activeWaiterCalls: 0,
  })
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser()
      if (user?.restaurant_id) {
        setRestaurantId(user.restaurant_id)
        fetchStats(user.restaurant_id)
      }
    }
    loadData()
  }, [])

  async function fetchStats(restId: string) {
    try {
      // Get orders by status
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('status')
        .eq('restaurant_id', restId)
        .in('status', ['pending', 'preparing', 'ready'])

      if (ordersError) throw ordersError

      // Get waiter calls
      const { data: waiterCalls, error: callsError } = await supabase
        .from('waiter_calls')
        .select('id')
        .eq('restaurant_id', restId)
        .eq('status', 'active')

      if (callsError) throw callsError

      setStats({
        pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
        preparingOrders: orders?.filter(o => o.status === 'preparing').length || 0,
        readyOrders: orders?.filter(o => o.status === 'ready').length || 0,
        activeWaiterCalls: waiterCalls?.length || 0,
      })
    } catch (error: any) {
      toast.error('Errore nel caricamento delle statistiche')
      console.error(error)
    } finally {
      setLoading(false)
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
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
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
              <Clock className="h-6 w-6 text-blue-600" />
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
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pronti</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.readyOrders}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Chiamate Cameriere</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeWaiterCalls}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}










