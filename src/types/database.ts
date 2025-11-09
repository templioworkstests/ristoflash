export type UserRole = 'admin' | 'restaurant_manager' | 'staff' | 'guest'

export type SubscriptionStatus = 'active' | 'trial' | 'inactive'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid'

export type ProductStatus = 'available' | 'unavailable'

export interface Restaurant {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  logo_url?: string
  primary_color?: string
  subscription_status: SubscriptionStatus
  subscription_plan?: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  role: UserRole
  restaurant_id?: string | null
  full_name?: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  description?: string
  display_order: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description?: string
  price: number
  image_url?: string
  status: ProductStatus
  display_order: number
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  price_modifier: number
  display_order: number
  created_at: string
}

export interface ProductOption {
  id: string
  product_id: string
  name: string
  price_modifier: number
  is_required: boolean
  display_order: number
  created_at: string
}

export interface Table {
  id: string
  restaurant_id: string
  name: string
  area?: string
  qr_code?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  restaurant_id: string
  table_id: string
  status: OrderStatus
  total_amount: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  variant_id?: string | null
  options?: string | null // JSON array of option IDs
  notes?: string
  status: OrderStatus
  created_at: string
}

export interface WaiterCall {
  id: string
  restaurant_id: string
  table_id: string
  status: 'active' | 'resolved'
  created_at: string
  resolved_at?: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price: number
  features?: string // JSON array
  created_at: string
}










