ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS arrived boolean;

UPDATE public.reservations
SET arrived = true
WHERE arrived IS NULL;

ALTER TABLE public.reservations
ALTER COLUMN arrived SET DEFAULT false,
ALTER COLUMN arrived SET NOT NULL;

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.no_show_blacklist (
	phone_normalized text PRIMARY KEY,
	full_name text NOT NULL,
	phone text NOT NULL,
	source_reservation_id text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	created_by text NOT NULL
);

ALTER TABLE public.no_show_blacklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.no_show_blacklist FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.reservations FROM PUBLIC, anon, authenticated;

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
		'[[:space:]]+',
		' ',
		'g'
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

CREATE OR REPLACE FUNCTION public.mark_reservation_arrived(p_reservation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'guvenlik@saha-kort.local'
		OR auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'readonly' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	UPDATE public.reservations AS r
	SET arrived = true, arrived_at = now()
	WHERE r.id::text = p_reservation_id
		AND r.reservation_date::text = (now() AT TIME ZONE 'Europe/Istanbul')::date::text
		AND r.reservation_time::time <= (now() AT TIME ZONE 'Europe/Istanbul')::time
		AND r.arrived = false;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Reservation not found or not eligible for check-in';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_no_show_candidates()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sevval.atahan@saha-kort.local'
		OR auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	RETURN QUERY
	SELECT jsonb_build_object(
		'id', r.id, 'full_name', r.full_name, 'phone', r.phone,
		'court_id', r.court_id, 'court_name', r.court_name,
		'reservation_date', r.reservation_date, 'reservation_time', r.reservation_time
	)
	FROM public.reservations AS r
	WHERE r.arrived = false
		AND (((r.reservation_date::text || ' ' || r.reservation_time::text)::timestamp
			+ interval '1 hour') AT TIME ZONE 'Europe/Istanbul') < now()
		AND NOT EXISTS (
			SELECT 1 FROM public.no_show_blacklist AS b
			WHERE b.phone_normalized = right(
				regexp_replace(coalesce(r.phone, ''), '[^0-9]', '', 'g'), 10
			)
		)
	ORDER BY r.reservation_date DESC, r.reservation_time DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_no_show_blacklist()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sevval.atahan@saha-kort.local'
		OR auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	RETURN QUERY
	SELECT jsonb_build_object('full_name', b.full_name, 'phone', b.phone, 'created_at', b.created_at)
	FROM public.no_show_blacklist AS b
	ORDER BY b.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_no_show_to_blacklist(p_reservation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	reservation public.reservations%ROWTYPE;
	normalized_phone text;
BEGIN
	IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sevval.atahan@saha-kort.local'
		OR auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	SELECT r.* INTO reservation
	FROM public.reservations AS r
	WHERE r.id::text = p_reservation_id
		AND r.arrived = false
		AND (((r.reservation_date::text || ' ' || r.reservation_time::text)::timestamp
			+ interval '1 hour') AT TIME ZONE 'Europe/Istanbul') < now();

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Reservation is not an eligible no-show';
	END IF;

	normalized_phone := regexp_replace(coalesce(reservation.phone, ''), '[^0-9]', '', 'g');
	IF normalized_phone LIKE '90%' AND length(normalized_phone) = 12 THEN
		normalized_phone := substring(normalized_phone FROM 3);
	ELSIF normalized_phone LIKE '0%' AND length(normalized_phone) = 11 THEN
		normalized_phone := substring(normalized_phone FROM 2);
	ELSIF length(normalized_phone) > 10 THEN
		normalized_phone := right(normalized_phone, 10);
	END IF;

	IF length(normalized_phone) < 10 THEN
		RAISE EXCEPTION 'Reservation has no usable phone number';
	END IF;

	INSERT INTO public.no_show_blacklist (
		phone_normalized, full_name, phone, source_reservation_id, created_by
	) VALUES (
		normalized_phone, reservation.full_name, reservation.phone,
		reservation.id::text, lower(auth.jwt() ->> 'email')
	) ON CONFLICT (phone_normalized) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_no_show_from_blacklist(p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	normalized_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
BEGIN
	IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sevval.atahan@saha-kort.local'
		OR auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	IF normalized_phone LIKE '90%' AND length(normalized_phone) = 12 THEN
		normalized_phone := substring(normalized_phone FROM 3);
	ELSIF normalized_phone LIKE '0%' AND length(normalized_phone) = 11 THEN
		normalized_phone := substring(normalized_phone FROM 2);
	ELSIF length(normalized_phone) > 10 THEN
		normalized_phone := right(normalized_phone, 10);
	END IF;

	DELETE FROM public.no_show_blacklist AS b
	WHERE b.phone_normalized = normalized_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.get_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_reservation_limits(date, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_reservation_arrived(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_no_show_candidates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_no_show_blacklist() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_no_show_to_blacklist(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_no_show_from_blacklist(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_reservations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reservation_arrived(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_no_show_candidates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_no_show_blacklist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_no_show_to_blacklist(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_no_show_from_blacklist(text) TO authenticated;
