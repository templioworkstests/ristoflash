-- Table tokens keep track of time-bound QR sessions
CREATE TABLE IF NOT EXISTS table_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_table_tokens_table_id ON table_tokens(table_id);
CREATE INDEX IF NOT EXISTS idx_table_tokens_token ON table_tokens(token);
CREATE INDEX IF NOT EXISTS idx_table_tokens_expires_at ON table_tokens(expires_at);

ALTER TABLE table_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage table tokens" ON table_tokens
  FOR ALL USING (
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

CREATE POLICY "Restaurant staff read table tokens" ON table_tokens
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('restaurant_manager', 'staff')
    )
  );

CREATE OR REPLACE FUNCTION validate_table_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  table_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT tt.id, tt.restaurant_id, tt.table_id, tt.expires_at
  FROM table_tokens tt
  WHERE tt.token = p_token
    AND tt.revoked = false
    AND tt.expires_at > NOW()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION validate_table_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_table_token(TEXT) TO authenticated;

