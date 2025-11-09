import { useEffect, useState } from 'react'
import { supabase, getSupabaseAdmin } from '@/lib/supabase'
import { Restaurant, SubscriptionStatus, User } from '@/types/database'
import { Plus, Edit, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface RestaurantWithManager extends Restaurant {
  manager?: User
}

export function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState<RestaurantWithManager[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    subscription_status: 'trial' as SubscriptionStatus,
  })
  const [managerForm, setManagerForm] = useState({
    email: '',
    password: '',
    full_name: '',
  })

  useEffect(() => {
    fetchRestaurants()
  }, [])

  async function fetchRestaurants() {
    try {
      // Prefer admin client to avoid RLS hiding managers for admins without a users row
      const client = getSupabaseAdmin() ?? supabase

      const { data: restaurantsData, error: restaurantsError } = await client
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false })

      if (restaurantsError) throw restaurantsError

      // Fetch managers for each restaurant
      const { data: managersData, error: managersError } = await client
        .from('users')
        .select('*')
        .eq('role', 'restaurant_manager')

      if (managersError) throw managersError

      // Combine restaurants with their managers
      const restaurantsWithManagers = (restaurantsData || []).map(restaurant => ({
        ...restaurant,
        manager: managersData?.find(m => m.restaurant_id === restaurant.id),
      }))

      setRestaurants(restaurantsWithManagers)
    } catch (error: any) {
      toast.error('Errore nel caricamento dei ristoranti')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      if (editingRestaurant) {
        const { error } = await supabase
          .from('restaurants')
          .update(formData)
          .eq('id', editingRestaurant.id)

        if (error) throw error
        toast.success('Ristorante aggiornato')
      } else {
        const { error } = await supabase
          .from('restaurants')
          .insert([formData])

        if (error) throw error
        toast.success('Ristorante creato')
      }

      setShowModal(false)
      setEditingRestaurant(null)
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
        subscription_status: 'trial',
      })
      fetchRestaurants()
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'operazione')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo ristorante? Questa azione è irreversibile.')) return

    try {
      // Try with regular client first, fallback to admin client if RLS blocks it
      let error
      const result = await supabase
        .from('restaurants')
        .delete()
        .eq('id', id)

      error = result.error

      // If RLS blocks, try with admin client
      if (error?.code === '42501' || error?.message?.includes('row-level security')) {
        const admin = getSupabaseAdmin()
        if (admin) {
          const adminResult = await admin
            .from('restaurants')
            .delete()
            .eq('id', id)
          error = adminResult.error
        }
      }

      if (error) throw error
      toast.success('Ristorante eliminato')
      fetchRestaurants()
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'eliminazione')
      console.error('Delete error:', error)
    }
  }

  function openEditModal(restaurant: Restaurant) {
    setEditingRestaurant(restaurant)
    setFormData({
      name: restaurant.name,
      address: restaurant.address || '',
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      subscription_status: restaurant.subscription_status,
    })
    setShowModal(true)
  }

  function openManagerModal(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant)
    setManagerForm({
      email: '',
      password: '',
      full_name: '',
    })
    setShowManagerModal(true)
  }

  async function handleManagerSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRestaurant) return

    try {
      toast.loading('Creazione manager in corso...')

      const supabaseAdmin = getSupabaseAdmin()
      if (!supabaseAdmin) {
        throw new Error('Service role key non configurata. Usa il metodo alternativo SQL.')
      }

      let userId: string
      let isNewUser = false

      // Check existing user via Admin API pagination (broad compatibility)
      async function findUserByEmail(email: string) {
        let page = 1
        const perPage = 1000
        while (page <= 10) { // hard cap to avoid infinite loops
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
          if (error) {
            console.warn('listUsers warning:', error)
            break
          }
          const found = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
          if (found) return found
          if (!data || !data.users || data.users.length < perPage) break
          page += 1
        }
        return null
      }

      const existingUser = await findUserByEmail(managerForm.email)

      if (existingUser) {
        // User exists - update their profile
        userId = existingUser.id
        
        // Check if profile exists
        const { data: existingProfile } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (existingProfile) {
          // Update existing profile
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              role: 'restaurant_manager',
              restaurant_id: selectedRestaurant.id,
              full_name: managerForm.full_name || existingProfile.full_name,
            })
            .eq('id', userId)

          if (updateError) throw updateError
          
          // Update password if provided
          if (managerForm.password) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: managerForm.password,
            })
          }
        } else {
          // Create profile for existing auth user
          const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert([
              {
                id: userId,
                email: managerForm.email,
                full_name: managerForm.full_name,
                role: 'restaurant_manager',
                restaurant_id: selectedRestaurant.id,
              },
            ])

          if (profileError) throw profileError

          // Update password if provided
          if (managerForm.password) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: managerForm.password,
            })
          }
        }
      } else {
        // Create new user
        isNewUser = true
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: managerForm.email,
          password: managerForm.password,
          email_confirm: true,
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Utente non creato')
        
        userId = authData.user.id

        // Create user profile
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert([
            {
              id: userId,
              email: managerForm.email,
              full_name: managerForm.full_name,
              role: 'restaurant_manager',
              restaurant_id: selectedRestaurant.id,
            },
          ])

        if (profileError) {
          // If profile creation fails, try to delete the auth user
          await supabaseAdmin.auth.admin.deleteUser(userId)
          throw profileError
        }
      }

      toast.success(isNewUser ? 'Manager creato con successo!' : 'Manager aggiornato con successo!')
      setShowManagerModal(false)
      setManagerForm({ email: '', password: '', full_name: '' })
      fetchRestaurants()
    } catch (error: any) {
      toast.error(error.message || 'Errore nella creazione del manager')
      console.error(error)
      
      // Show helpful message for common errors
      if (error.message?.includes('already been registered')) {
        toast.error('Esiste già un utente con questa email. Riprova: verrà aggiornato come manager.')
      }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Ristoranti</h1>
        <button
          onClick={() => {
            setEditingRestaurant(null)
            setFormData({
              name: '',
              address: '',
              phone: '',
              email: '',
              subscription_status: 'trial',
            })
            setShowModal(true)
          }}
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Ristorante
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {restaurants.map((restaurant) => (
                <tr key={restaurant.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{restaurant.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{restaurant.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {restaurant.manager ? (
                        <span className="text-green-600">{restaurant.manager.full_name || restaurant.manager.email}</span>
                      ) : (
                        <span className="text-gray-400 italic">Nessun manager</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        restaurant.subscription_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : restaurant.subscription_status === 'trial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {restaurant.subscription_status === 'active'
                        ? 'Attivo'
                        : restaurant.subscription_status === 'trial'
                        ? 'Prova'
                        : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(restaurant)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Modifica"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openManagerModal(restaurant)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Assegna Manager"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(restaurant.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingRestaurant ? 'Modifica Ristorante' : 'Nuovo Ristorante'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    required
                    className="input mt-1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Indirizzo</label>
                  <input
                    type="text"
                    className="input mt-1"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefono</label>
                  <input
                    type="tel"
                    className="input mt-1"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    className="input mt-1"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="input mt-1"
                    value={formData.subscription_status}
                    onChange={(e) =>
                      setFormData({ ...formData, subscription_status: e.target.value as SubscriptionStatus })
                    }
                  >
                    <option value="trial">Prova</option>
                    <option value="active">Attivo</option>
                    <option value="inactive">Inattivo</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingRestaurant(null)
                  }}
                  className="btn btn-secondary"
                >
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manager Modal */}
      {showManagerModal && selectedRestaurant && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Assegna Manager - {selectedRestaurant.name}
            </h3>
            <form onSubmit={handleManagerSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    className="input mt-1"
                    value={managerForm.email}
                    onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                    placeholder="manager@ristorante.it"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    required
                    className="input mt-1"
                    value={managerForm.password}
                    onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })}
                    placeholder="Password minima 6 caratteri"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                  <input
                    type="text"
                    className="input mt-1"
                    value={managerForm.full_name}
                    onChange={(e) => setManagerForm({ ...managerForm, full_name: e.target.value })}
                    placeholder="Mario Rossi"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowManagerModal(false)
                    setSelectedRestaurant(null)
                  }}
                  className="btn btn-secondary"
                >
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Crea Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


