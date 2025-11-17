-- Add prepayment_required flag to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS prepayment_required BOOLEAN NOT NULL DEFAULT false;



