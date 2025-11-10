-- Grant restaurant managers and staff the ability to update their own restaurant settings
-- Run this script in Supabase SQL editor after enabling RLS on `restaurants`

CREATE POLICY "Restaurant staff can update their restaurant"
ON public.restaurants
FOR UPDATE
USING (
  id IN (
    SELECT restaurant_id
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
  )
)
WITH CHECK (
  id IN (
    SELECT restaurant_id
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
  )
);


