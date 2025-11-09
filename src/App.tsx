import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { RestaurantLayout } from './layouts/RestaurantLayout'
import { Login } from './pages/auth/Login'
import { AdminDashboard } from './pages/admin/Dashboard'
import { AdminRestaurants } from './pages/admin/Restaurants'
import { RestaurantDashboard } from './pages/restaurant/Dashboard'
import { RestaurantMenu } from './pages/restaurant/Menu'
import { RestaurantTables } from './pages/restaurant/Tables'
import { RestaurantOrders } from './pages/restaurant/Orders'
import { RestaurantStaff } from './pages/restaurant/Staff'
import { CustomerMenu } from './pages/customer/Menu'
import { Unauthorized } from './pages/Unauthorized'

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* Customer Route (No auth required) */}
        <Route path="/:restaurantId/:tableId" element={<CustomerMenu />} />
        
        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="restaurants" element={<AdminRestaurants />} />
        </Route>
        
        {/* Restaurant Routes */}
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
              <RestaurantLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RestaurantDashboard />} />
          <Route path="menu" element={<RestaurantMenu />} />
          <Route path="tables" element={<RestaurantTables />} />
          <Route path="orders" element={<RestaurantOrders />} />
          <Route path="staff" element={<RestaurantStaff />} />
        </Route>
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


