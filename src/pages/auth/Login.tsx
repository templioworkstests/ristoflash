import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '@/utils/auth'
import { getCurrentUser } from '@/utils/auth'
import { toast } from 'react-hot-toast'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        toast.error(error.message || 'Errore durante il login')
        setLoading(false)
        return
      }

      // Wait a bit for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const user = await getCurrentUser()
      
      if (!user) {
        toast.error('Profilo utente non trovato. Verifica che l\'utente esista nella tabella users con role e restaurant_id corretti.')
        console.error('User profile not found. Check browser console for details.')
        setLoading(false)
        return
      }

      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin')
      } else if (user.role === 'restaurant_manager' || user.role === 'staff') {
        navigate('/restaurant')
      } else if (user.role === 'kitchen') {
        navigate('/restaurant/kitchen')
      } else {
        toast.error('Ruolo non autorizzato')
      }
      
      toast.success('Login effettuato con successo')
    } catch (err) {
      toast.error('Errore durante il login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accedi a RistoFlash
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input rounded-t-md"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input rounded-b-md"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


