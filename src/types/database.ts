export type UserRole = string

export type SubscriptionStatus = string

export type OrderStatus = string

export type ProductStatus = string

export interface Restaurant {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  primary_color: string | null
  all_you_can_eat_enabled: boolean
  all_you_can_eat_lunch_price: number | null
  all_you_can_eat_dinner_price: number | null
  subscription_status: SubscriptionStatus
  subscription_plan: string | null
  created_at: string | null
  updated_at: string | null
}

export interface User {
  id: string
  email: string
  role: UserRole
  restaurant_id: string | null
  full_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  display_order: number
  created_at: string | null
  updated_at: string | null
}

export interface Product {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  status: ProductStatus
  ayce_limit_enabled: boolean
  ayce_limit_quantity: number | null
  display_order: number
  created_at: string | null
  updated_at: string | null
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  price_modifier: number
  display_order: number
  created_at: string | null
}

export interface ProductOption {
  id: string
  product_id: string
  name: string
  price_modifier: number
  is_required: boolean
  display_order: number
  created_at: string | null
}

export interface Table {
  id: string
  restaurant_id: string
  name: string
  area: string | null
  qr_code: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface Order {
  id: string
  restaurant_id: string
  table_id: string
  status: OrderStatus
  total_amount: number
  payment_method: 'cash' | 'card' | null
  party_size: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  variant_id: string | null
  options: any
  notes: string | null
  status: OrderStatus
  created_at: string | null
}

export interface WaiterCall {
  id: string
  restaurant_id: string
  table_id: string
  status: 'active' | 'resolved'
  created_at: string | null
  resolved_at: string | null
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price: number
  features: string | null
  created_at: string | null
}










