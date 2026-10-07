CREATE OR REPLACE FUNCTION public.get_reservations()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_role text := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''));
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  today_istanbul date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  IF current_role = 'full' THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'id', r.id,
      'court_id', lower(trim(r.court_id::text)),
      'court_name', r.court_name,
      'reservation_date', r.reservation_date::date,
      'reservation_time', to_char(r.reservation_time::time, 'HH24:MI')
    )
    FROM public.reservations AS r
    ORDER BY r.created_at DESC;
    RETURN;
  END IF;

  IF current_role = 'readonly' AND current_email = 'guvenlik@saha-kort.local' THEN
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
    RETURN;
  END IF;

  IF auth.role() IN ('anon', 'authenticated') THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'id', r.id,
      'court_id', lower(trim(r.court_id::text)),
      'court_name', r.court_name,
      'reservation_date', r.reservation_date::date,
      'reservation_time', to_char(r.reservation_time::time, 'HH24:MI')
    )
    FROM public.reservations AS r
    WHERE r.reservation_date >= today_istanbul
    ORDER BY r.reservation_date, r.reservation_time;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not authorized';
END;
$$;

REVOKE ALL ON FUNCTION public.get_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reservations() TO anon, authenticated;

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
