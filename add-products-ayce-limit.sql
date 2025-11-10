-- Adds AYCE limit columns to products table for per-item restrictions
ALTER TABLE products
ADD COLUMN IF NOT EXISTS ayce_limit_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS ayce_limit_quantity INTEGER;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_ayce_limit_check;

ALTER TABLE products
ADD CONSTRAINT products_ayce_limit_check CHECK (
  ayce_limit_enabled = false
  OR (ayce_limit_quantity IS NOT NULL AND ayce_limit_quantity > 0)
);

