-- Aggiungi policy DELETE per admin su restaurants
CREATE POLICY "Admins can delete restaurants" ON restaurants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );





