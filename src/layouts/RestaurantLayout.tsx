import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LogOut,
  LayoutDashboard,
  UtensilsCrossed,
  Table,
  ShoppingCart,
  Users,
  Menu,
  X,
  ChefHat,
  CreditCard,
  BarChart3,
} from 'lucide-react'
import { getCurrentUser, signOut } from '@/utils/auth'
import { toast } from 'react-hot-toast'
import { useEffect, useMemo, useState } from 'react'

export function RestaurantLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const handleSignOut = async () => {
    await signOut()
    toast.success('Logout effettuato')
    navigate('/login')
  }

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser()
      setCurrentUser(user)
      setLoadingUser(false)
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!loadingUser && currentUser?.role === 'kitchen' && location.pathname === '/restaurant') {
      navigate('/restaurant/kitchen', { replace: true })
    }
  }, [currentUser, loadingUser, location.pathname, navigate])

  const navigation = useMemo(() => {
    const fullNav = [
      {
        to: '/restaurant',
        label: 'Dashboard',
        icon: LayoutDashboard,
        end: true,
      },
      {
        to: '/restaurant/menu',
        label: 'Menu',
        icon: UtensilsCrossed,
      },
      {
        to: '/restaurant/tables',
        label: 'Tavoli',
        icon: Table,
      },
      {
        to: '/restaurant/orders',
        label: 'Ordini',
        icon: ShoppingCart,
      },
      {
        to: '/restaurant/kitchen',
        label: 'Cucina',
        icon: ChefHat,
      },
      {
        to: '/restaurant/payments',
        label: 'Pagamenti',
        icon: CreditCard,
      },
      {
        to: '/restaurant/analytics',
        label: 'Statistiche',
        icon: BarChart3,
      },
      {
        to: '/restaurant/staff',
        label: 'Staff',
        icon: Users,
      },
    ]

    if (currentUser?.role === 'kitchen') {
      return fullNav.filter((item) => item.to === '/restaurant/kitchen')
    }

    return fullNav
  }, [currentUser])

  const navLinkClass = (isActive: boolean) =>
    `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
      isActive
        ? 'border-primary-500 text-gray-900'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-primary-600">RistoFlash</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
            <div className="hidden sm:flex items-center">
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="sm:hidden pb-4 space-y-2">
              {navigation.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-md text-base font-medium ${
                      isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {label}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleSignOut()
                }}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}










