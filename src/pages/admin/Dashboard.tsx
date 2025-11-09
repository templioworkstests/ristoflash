import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/types/database'
import { Store, Users, ShoppingCart, TrendingUp } from 'lucide-react'
import { toast } from 'react-hot-toast'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    trialRestaurants: 0,
    totalOrders: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get restaurants count
        const { data: restaurants, error: restaurantsError } = await supabase
          .from('restaurants')
          .select('id, subscription_status')

        if (restaurantsError) throw restaurantsError

        const active = restaurants?.filter(r => r.subscription_status === 'active').length || 0
        const trial = restaurants?.filter(r => r.subscription_status === 'trial').length || 0

        // Get orders count (estimated - you might want to optimize this)
        const { count: ordersCount, error: ordersError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })

        if (ordersError) throw ordersError

        setStats({
          totalRestaurants: restaurants?.length || 0,
          activeRestaurants: active,
          trialRestaurants: trial,
          totalOrders: ordersCount || 0,
        })
      } catch (error: any) {
        toast.error('Errore nel caricamento delle statistiche')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Amministrazione</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Store className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Totale Ristoranti</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalRestaurants}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ristoranti Attivi</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeRestaurants}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Users className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Prova</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.trialRestaurants}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ordini Totali</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}










