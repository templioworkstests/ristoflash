-- Adds party_size column to orders table to track number of guests per table session
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS party_size INTEGER
  CHECK (party_size IS NULL OR party_size > 0);

