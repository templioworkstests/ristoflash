-- RLS policies for users and related tables

-- Enable RLS (if not already enabled in schema)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- Users: admins can view all
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Users: authenticated user can view own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (
    id = auth.uid()
  );

-- Users: restaurant staff can view users of their restaurant
CREATE POLICY "Restaurant staff can view their restaurant users" ON users
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'restaurant_manager', 'staff')
    )
  );

-- Optional: staff/manager can manage users in their restaurant (limit updates)
-- Adjust as needed for your flows (e.g., only admin can insert managers)
CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Managers can read/write staff of their restaurant
CREATE POLICY "Managers can manage staff in their restaurant" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'restaurant_manager'
      AND (
        -- newly inserted user belongs to same restaurant
        users.restaurant_id = u.restaurant_id
      )
    )
  );

CREATE POLICY "Managers can update staff in their restaurant" ON users
  FOR UPDATE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'restaurant_manager'
    )
  ) WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'restaurant_manager'
    )
  );

-- Prevent managers from elevating roles to admin or changing other managers of other restaurants
-- Enforce via CHECK constraints or triggers in production as needed





-- Policies for tables: allow restaurant staff to manage their tables and admins to manage all
ALTER TABLE IF EXISTS tables ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "Restaurant staff can view tables" ON tables
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- INSERT
CREATE POLICY "Restaurant staff can insert tables" ON tables
  FOR INSERT WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- UPDATE
CREATE POLICY "Restaurant staff can update tables" ON tables
  FOR UPDATE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  ) WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- DELETE
CREATE POLICY "Restaurant staff can delete tables" ON tables
  FOR DELETE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- Admins can manage all tables
CREATE POLICY "Admins can manage all tables" ON tables
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );


-- Policies for waiter_calls: allow public insert; staff/manager and admins manage
ALTER TABLE IF EXISTS waiter_calls ENABLE ROW LEVEL SECURITY;

-- Anyone can create waiter calls (for anonymous customers)
CREATE POLICY "Anyone can insert waiter calls" ON waiter_calls
  FOR INSERT WITH CHECK (true);

-- Staff can view waiter calls of their restaurant
CREATE POLICY "Restaurant staff can view waiter calls" ON waiter_calls
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- Staff can update waiter calls of their restaurant
CREATE POLICY "Restaurant staff can update waiter calls" ON waiter_calls
  FOR UPDATE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- Staff can delete waiter calls of their restaurant
CREATE POLICY "Restaurant staff can delete waiter calls" ON waiter_calls
  FOR DELETE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- Admins can manage all waiter calls
CREATE POLICY "Admins can manage all waiter calls" ON waiter_calls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );


-- Storage policies: restaurant staff can manage assets in their own folder
CREATE POLICY "Restaurant staff manage product assets" ON storage.objects
  FOR ALL USING (
    bucket_id = 'restaurant-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.restaurant_id IS NOT NULL
        AND name LIKE 'products/' || u.restaurant_id::text || '/%'
    )
  )
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.restaurant_id IS NOT NULL
        AND name LIKE 'products/' || u.restaurant_id::text || '/%'
    )
  );
