-- Add order cooldown settings to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS order_cooldown_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS order_cooldown_minutes INTEGER NOT NULL DEFAULT 15
  CHECK (order_cooldown_minutes > 0 AND order_cooldown_minutes <= 180);



