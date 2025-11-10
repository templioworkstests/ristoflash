-- Adds payment_method column to orders table if it does not already exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card'));

