CREATE OR REPLACE FUNCTION public.get_admin_reservations()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', r.id,
    'court_id', r.court_id,
    'court_name', r.court_name,
    'reservation_date', r.reservation_date,
    'reservation_time', r.reservation_time,
    'full_name', r.full_name,
    'phone', r.phone,
    'person_count', r.person_count,
    'category', r.category,
    'pricing_type', r.pricing_type,
    'day_type', r.day_type,
    'unit_price', r.unit_price,
    'total_price', r.total_price,
    'receipt_url', r.receipt_url,
    'receipt_name', r.receipt_name,
    'is_approved', r.is_approved,
    'arrived', r.arrived,
    'created_at', r.created_at
  )
  FROM public.reservations AS r
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_reservations() TO authenticated;
