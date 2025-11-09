-- Policy per order_items: permette ai clienti di creare order_items quando creano ordini

-- SELECT: Manager e staff possono vedere gli order_items del loro ristorante
CREATE POLICY "Restaurant staff can view order items" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN public.users u ON u.restaurant_id = o.restaurant_id
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- INSERT: Chiunque può creare order_items (per permettere ordini anonimi dai clienti)
CREATE POLICY "Anyone can create order items" ON order_items
  FOR INSERT WITH CHECK (true);

-- UPDATE: Manager e staff possono aggiornare order_items
CREATE POLICY "Restaurant staff can update order items" ON order_items
  FOR UPDATE USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN public.users u ON u.restaurant_id = o.restaurant_id
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- DELETE: Manager e staff possono eliminare order_items
CREATE POLICY "Restaurant staff can delete order items" ON order_items
  FOR DELETE USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN public.users u ON u.restaurant_id = o.restaurant_id
      WHERE u.id = auth.uid()
      AND u.role IN ('restaurant_manager', 'staff')
    )
  );

-- Admin può fare tutto
CREATE POLICY "Admins can manage all order items" ON order_items
  FOR ALL USING (public.is_admin(auth.uid()));





