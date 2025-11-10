import { useEffect, useState } from 'react'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/utils/auth'
import { User } from '@/types/database'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

export function RestaurantStaff() {
  const [staff, setStaff] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff' as 'restaurant_manager' | 'staff' | 'kitchen',
  })

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser()
      if (user?.restaurant_id) {
        setRestaurantId(user.restaurant_id)
        fetchStaff(user.restaurant_id)
      }
    }
    loadData()
  }, [])

  async function fetchStaff(restId: string) {
    try {
      const admin = getSupabaseAdmin()
      if (!admin) {
        throw new Error('Service role non configurata: impossibile leggere lo staff con le RLS attuali')
      }

      const { data, error } = await admin
        .from('users')
        .select('*')
        .eq('restaurant_id', restId)
        .in('role', ['restaurant_manager', 'staff', 'kitchen'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setStaff(data || [])
    } catch (error: any) {
      toast.error('Errore nel caricamento dello staff')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return

    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          full_name: formData.full_name,
          role: formData.role,
        }

        // Note: Password update requires user to be logged in or use Supabase Admin API
        // For now, we'll skip password updates from the client
        // Password reset should be handled through Supabase Auth UI or admin panel

        const admin = getSupabaseAdmin()
        if (!admin) throw new Error('Service role non configurata')

        const { error } = await admin
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id)

        if (error) throw error
        toast.success('Utente aggiornato')
      } else {
        // Create new user via Admin API
        const admin = getSupabaseAdmin()
        if (!admin) throw new Error('Service role non configurata')

        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true,
        })
        if (createErr) throw createErr
        const newUserId = created.user?.id
        if (!newUserId) throw new Error('Utente non creato')

        const { error: profileError } = await admin
          .from('users')
          .insert([
            {
              id: newUserId,
              email: formData.email,
              full_name: formData.full_name,
              role: formData.role,
              restaurant_id: restaurantId,
            },
          ])

        if (profileError) throw profileError
        toast.success('Utente creato')
      }

      setShowModal(false)
      setEditingUser(null)
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'staff',
      })
      fetchStaff(restaurantId)
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'operazione')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo utente?')) return

    try {
      const admin = getSupabaseAdmin()
      if (!admin) throw new Error('Service role non configurata')

      // Delete from users table (profile)
      const { error } = await admin.from('users').delete().eq('id', id)
      if (error) throw error

      // Also delete from auth.users
      await admin.auth.admin.deleteUser(id)

      toast.success('Utente eliminato')
      if (restaurantId) {
        fetchStaff(restaurantId)
      }
    } catch (error: any) {
      toast.error(error.message || 'Errore durante l\'eliminazione')
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
        <h1 className="text-3xl font-bold text-gray-900">Gestione Staff</h1>
        <button
          onClick={() => {
            setEditingUser(null)
            setFormData({
              email: '',
              password: '',
              full_name: '',
              role: 'staff',
            })
            setShowModal(true)
          }}
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Utente
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
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'restaurant_manager'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'kitchen'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {user.role === 'restaurant_manager'
                        ? 'Manager'
                        : user.role === 'kitchen'
                        ? 'Cucina'
                        : 'Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingUser(user)
                        setFormData({
                          email: user.email,
                          password: '',
                          full_name: user.full_name || '',
                          role: (['restaurant_manager', 'staff', 'kitchen'].includes(user.role)
                            ? (user.role as 'restaurant_manager' | 'staff' | 'kitchen')
                            : 'staff'),
                        })
                        setShowModal(true)
                      }}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
              {editingUser ? 'Modifica Utente' : 'Nuovo Utente'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      className="input mt-1"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {editingUser ? 'Nuova Password (lascia vuoto per non cambiare)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    className="input mt-1"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                  <input
                    type="text"
                    className="input mt-1"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ruolo</label>
                  <select
                    className="input mt-1"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'restaurant_manager' | 'staff' | 'kitchen',
                      })
                    }
                  >
                    <option value="staff">Staff</option>
                    <option value="restaurant_manager">Manager</option>
                    <option value="kitchen">Cucina</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingUser(null)
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
    </div>
  )
}

