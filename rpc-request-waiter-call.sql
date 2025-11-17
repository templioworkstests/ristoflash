-- Function to request a waiter call from customer using a valid table token
CREATE OR REPLACE FUNCTION request_waiter_call(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant UUID;
  v_table UUID;
  v_call_id UUID;
BEGIN
  -- Validate token against active table_tokens
  SELECT restaurant_id, table_id
  INTO v_restaurant, v_table
  FROM table_tokens
  WHERE token = p_token
    AND revoked = false
    AND now() < expires_at
  LIMIT 1;

  IF v_restaurant IS NULL OR v_table IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Insert waiter call
  INSERT INTO waiter_calls (restaurant_id, table_id, status)
  VALUES (v_restaurant, v_table, 'active')
  RETURNING id INTO v_call_id;

  RETURN v_call_id;
END;
$$;

REVOKE ALL ON FUNCTION request_waiter_call(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_waiter_call(TEXT) TO anon, authenticated;



