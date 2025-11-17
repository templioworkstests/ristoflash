-- RLS policies for waiter_calls
-- Allow restaurant staff to view waiter calls for their restaurant
CREATE POLICY IF NOT EXISTS "Restaurant staff can view their waiter calls" ON waiter_calls
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff', 'kitchen')
    )
  );

-- Allow restaurant staff to update waiter calls (e.g., resolve) for their restaurant
CREATE POLICY IF NOT EXISTS "Restaurant staff can update their waiter calls" ON waiter_calls
  FOR UPDATE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff', 'kitchen')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff', 'kitchen')
    )
  );



