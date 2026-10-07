CREATE OR REPLACE FUNCTION public.get_security_reservations()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'guvenlik@saha-kort.local'
    OR auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'readonly' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', r.id,
    'court_id', lower(trim(r.court_id::text)),
    'court_name', r.court_name,
    'reservation_date', r.reservation_date::date,
    'reservation_time', to_char(r.reservation_time::time, 'HH24:MI'),
    'full_name', r.full_name,
    'arrived', r.arrived
  )
  FROM public.reservations AS r
  ORDER BY r.reservation_date DESC, r.reservation_time;
END;
$$;

REVOKE ALL ON FUNCTION public.get_security_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_security_reservations() TO authenticated;
