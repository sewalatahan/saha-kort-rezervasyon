CREATE OR REPLACE FUNCTION public.check_reservation_limits(
  p_reservation_date date,
  p_court_id text,
  p_reservation_time text,
  p_full_name text,
  p_phone text,
  p_category text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  turkey_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  normalized_name text;
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  matching_reservations integer;
BEGIN
  IF nullif(trim(p_full_name), '') IS NULL OR length(normalized_phone) < 10 THEN
    RETURN 'invalid_contact';
  END IF;

  IF normalized_phone LIKE '90%' AND length(normalized_phone) = 12 THEN
    normalized_phone := substring(normalized_phone FROM 3);
  ELSIF normalized_phone LIKE '0%' AND length(normalized_phone) = 11 THEN
    normalized_phone := substring(normalized_phone FROM 2);
  ELSIF length(normalized_phone) > 10 THEN
    normalized_phone := right(normalized_phone, 10);
  END IF;

  normalized_name := regexp_replace(
    translate(upper(trim(p_full_name)), 'ÇĞİÖŞÜ', 'CGIOSU'),
    '[[:space:]]+', ' ', 'g'
  );

  IF p_court_id = 'tenis' THEN
    IF p_reservation_date < turkey_today OR p_reservation_date > turkey_today + 1 THEN
      RETURN 'invalid_date';
    END IF;
  ELSIF p_court_id = 'salon' THEN
    IF p_reservation_date < date_trunc('week', turkey_today)::date
      OR p_reservation_date > date_trunc('week', turkey_today)::date + 6 THEN
      RETURN 'invalid_date';
    END IF;
  ELSE
    RETURN 'invalid_court';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reservations AS r
    WHERE r.reservation_date::text = p_reservation_date::text
      AND r.court_id = p_court_id
      AND r.reservation_time::text = p_reservation_time
  ) THEN
    RETURN 'slot_taken';
  END IF;

  IF (p_court_id = 'salon' AND p_reservation_time < '18:00') OR EXISTS (
    SELECT 1
    FROM public.closed_slots AS c
    WHERE c.court_id = p_court_id
      AND c.close_date::text = p_reservation_date::text
      AND p_reservation_time::time BETWEEN c.start_time::time AND c.end_time::time
  ) THEN
    RETURN 'slot_closed';
  END IF;

  SELECT count(*)::integer
  INTO matching_reservations
  FROM public.reservations AS r
  WHERE r.reservation_date::text = p_reservation_date::text
    AND r.court_id = p_court_id
    AND (
      regexp_replace(
        translate(upper(trim(coalesce(r.full_name, ''))), 'ÇĞİÖŞÜ', 'CGIOSU'),
        '[[:space:]]+', ' ', 'g'
      ) = normalized_name
      OR right(regexp_replace(coalesce(r.phone, ''), '[^0-9]', '', 'g'), 10) = normalized_phone
    );

  IF p_court_id = 'salon' AND matching_reservations >= 1 THEN
    RETURN 'reservation_limit';
  END IF;

  IF p_court_id = 'tenis' AND p_category = 'ogrenci' AND matching_reservations >= 1 THEN
    RETURN 'reservation_limit';
  END IF;

  IF p_court_id = 'tenis' AND p_category = 'yetiskin' THEN
    IF p_reservation_date = turkey_today
      AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= time '17:00' THEN
      IF matching_reservations >= 3 THEN
        RETURN 'reservation_limit';
      END IF;
    ELSIF matching_reservations >= 2 THEN
      RETURN 'reservation_limit';
    END IF;
  END IF;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.check_reservation_limits(date, text, text, text, text, text)
FROM PUBLIC, anon, authenticated;
