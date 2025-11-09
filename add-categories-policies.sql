-- Policy per categories: permette a manager e staff di gestire categorie del loro ristorante

-- SELECT: Manager e staff possono vedere le categorie del loro ristorante
CREATE POLICY "Restaurant staff can view categories" ON categories
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

-- INSERT: Manager e staff possono creare categorie
CREATE POLICY "Restaurant staff can insert categories" ON categories
  FOR INSERT WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

-- UPDATE: Manager e staff possono aggiornare categorie
CREATE POLICY "Restaurant staff can update categories" ON categories
  FOR UPDATE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

-- DELETE: Manager e staff possono eliminare categorie
CREATE POLICY "Restaurant staff can delete categories" ON categories
  FOR DELETE USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

-- Admin può fare tutto
CREATE POLICY "Admins can manage all categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );





