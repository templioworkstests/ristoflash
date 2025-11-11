-- RistoFlash Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  logo_url TEXT,
  primary_color VARCHAR(7),
  all_you_can_eat_enabled BOOLEAN NOT NULL DEFAULT false,
  all_you_can_eat_lunch_price DECIMAL(10, 2),
  all_you_can_eat_dinner_price DECIMAL(10, 2),
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('active', 'trial', 'inactive')),
  subscription_plan VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'restaurant_manager', 'staff', 'guest')),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable')),
  ayce_limit_enabled BOOLEAN NOT NULL DEFAULT false,
  ayce_limit_quantity INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT products_ayce_limit_check CHECK (
    ayce_limit_enabled = false
    OR (ayce_limit_quantity IS NOT NULL AND ayce_limit_quantity > 0)
  )
);

-- Product Variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Options table
CREATE TABLE IF NOT EXISTS product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tables table
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  area VARCHAR(100),
  qr_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'paid')),
  total_amount DECIMAL(10, 2) NOT NULL,
  party_size INTEGER CHECK (party_size IS NULL OR party_size > 0),
  payment_method VARCHAR(20) CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  options JSONB,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Waiter Calls table
CREATE TABLE IF NOT EXISTS waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Table Tokens (temporary QR sessions)
CREATE TABLE IF NOT EXISTS table_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_subscription_status ON restaurants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_id ON waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON waiter_calls(status);
CREATE INDEX IF NOT EXISTS idx_table_tokens_table_id ON table_tokens(table_id);
CREATE INDEX IF NOT EXISTS idx_table_tokens_token ON table_tokens(token);
CREATE INDEX IF NOT EXISTS idx_table_tokens_expires_at ON table_tokens(expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for restaurants
CREATE POLICY "Admins can view all restaurants" ON restaurants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Restaurant managers can view their restaurant" ON restaurants
  FOR SELECT USING (
    id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert restaurants" ON restaurants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update restaurants" ON restaurants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Restaurant managers can update their restaurant settings" ON restaurants
  FOR UPDATE USING (
    id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'restaurant_manager'
    )
  )
  WITH CHECK (
    id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'restaurant_manager'
    )
  );

-- Policies for products (public read for customers)
CREATE POLICY "Anyone can read products for active restaurants" ON products
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE subscription_status = 'active'
    )
  );

CREATE POLICY "Restaurant staff can manage products" ON products
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

-- Policies for orders
CREATE POLICY "Restaurant staff can view their restaurant orders" ON orders
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

CREATE POLICY "Restaurant staff can update their restaurant orders" ON orders
  FOR UPDATE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

CREATE POLICY "Anyone can create orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Restaurant staff can manage order items" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.restaurant_id IN (
        SELECT restaurant_id
        FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('restaurant_manager', 'staff')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.restaurant_id IN (
        SELECT restaurant_id
        FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('restaurant_manager', 'staff')
      )
    )
  );

CREATE POLICY "Restaurant staff manage table tokens" ON table_tokens
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

CREATE POLICY "Restaurant staff read table tokens" ON table_tokens
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

-- Token validation function for customers (bypasses RLS with security definer)
CREATE OR REPLACE FUNCTION validate_table_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  table_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT tt.id, tt.restaurant_id, tt.table_id, tt.expires_at
  FROM table_tokens tt
  WHERE tt.token = p_token
    AND tt.revoked = false
    AND tt.expires_at > NOW()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION validate_table_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_table_token(TEXT) TO authenticated;

-- Similar policies for other tables...
-- (Note: You should implement comprehensive RLS policies for all tables)












