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
import { RestaurantKitchen } from './pages/restaurant/Kitchen'
import { RestaurantPayments } from './pages/restaurant/Payments'
import { RestaurantAnalytics } from './pages/restaurant/Analytics'
import { RestaurantStaff } from './pages/restaurant/Staff'
import { CustomerMenu } from './pages/customer/Menu'
import { QRRedirect } from './pages/customer/QRRedirect'
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
        
        {/* QR Code Redirect Route - handles /qr/... and redirects to API */}
        <Route path="/qr/:restaurantId/:tableId" element={<QRRedirect />} />
        
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
            <ProtectedRoute allowedRoles={['restaurant_manager', 'staff', 'kitchen']}>
              <RestaurantLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
                <RestaurantDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="menu"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
                <RestaurantMenu />
              </ProtectedRoute>
            }
          />
          <Route
            path="tables"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
                <RestaurantTables />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
                <RestaurantOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="kitchen"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff', 'kitchen']}>
                <RestaurantKitchen />
              </ProtectedRoute>
            }
          />
          <Route
            path="payments"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
                <RestaurantPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="analytics"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager', 'staff']}>
                <RestaurantAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="staff"
            element={
              <ProtectedRoute allowedRoles={['restaurant_manager']}>
                <RestaurantStaff />
              </ProtectedRoute>
            }
          />
        </Route>
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


