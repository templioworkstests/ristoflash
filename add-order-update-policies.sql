-- Allow restaurant staff to update orders belonging to their restaurant
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

-- Allow restaurant staff to manage order items linked to their orders
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

