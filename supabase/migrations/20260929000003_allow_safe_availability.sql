CREATE OR REPLACE FUNCTION public.get_reservations()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF current_role = 'full' THEN
    RETURN QUERY
    SELECT to_jsonb(r)
    FROM public.reservations AS r
    ORDER BY r.created_at DESC;
    RETURN;
  END IF;

  IF current_role = 'readonly' AND current_email = 'guvenlik@saha-kort.local' THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'id', r.id,
      'court_id', r.court_id,
      'court_name', r.court_name,
      'reservation_date', r.reservation_date,
      'reservation_time', r.reservation_time,
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
      'court_id', r.court_id,
      'court_name', r.court_name,
      'reservation_date', r.reservation_date,
      'reservation_time', r.reservation_time
    )
    FROM public.reservations AS r
    WHERE r.reservation_date >= (now() AT TIME ZONE 'Europe/Istanbul')::date
    ORDER BY r.reservation_date, r.reservation_time;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not authorized';
END;
$$;