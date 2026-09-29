REVOKE INSERT, UPDATE, DELETE ON public.reservations FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.closed_slots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_reservation_limits(date, text, text, text, text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_reservation(
	p_court_id text,
	p_reservation_date date,
	p_reservation_time text,
	p_full_name text,
	p_phone text,
	p_person_count integer,
	p_category text,
	p_receipt_url text,
	p_receipt_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	check_result text;
	reservation_court_name text;
	reservation_pricing_type text;
	reservation_day_type text;
	reservation_unit_price numeric;
	reservation_hour integer := extract(hour FROM p_reservation_time::time)::integer;
	month_day text := to_char(p_reservation_date, 'MM-DD');
	is_summer boolean;
BEGIN
	IF p_person_count IS NULL OR p_person_count < 1
		OR nullif(trim(p_receipt_url), '') IS NULL
		OR nullif(trim(p_receipt_name), '') IS NULL
		OR p_receipt_url NOT LIKE p_reservation_date::text || '/%' THEN
		RETURN 'invalid_reservation';
	END IF;

	PERFORM pg_advisory_xact_lock(
		hashtextextended(p_reservation_date::text || ':' || p_court_id, 0)
	);

	check_result := public.check_reservation_limits(
		p_reservation_date, p_court_id, p_reservation_time,
		p_full_name, p_phone, p_category
	);

	IF check_result <> 'ok' THEN
		RETURN check_result;
	END IF;

	IF p_court_id = 'salon'
		AND (p_category IS NULL OR p_category NOT IN ('lisanssiz', 'lisansli', 'ogrenci')) THEN
		RETURN 'invalid_category';
	END IF;

	IF p_court_id = 'salon' THEN
		reservation_court_name := 'Çok Amaçlı Salon / Voleybol';
		reservation_pricing_type := CASE p_category
			WHEN 'lisansli' THEN 'Lisanslı'
			ELSE 'Lisanssız'
		END;
		reservation_unit_price := CASE p_category
			WHEN 'lisansli' THEN 25
			ELSE 48
		END;
	ELSE
		IF p_category IS NULL OR p_category NOT IN ('yetiskin', 'ogrenci') THEN
			RETURN 'invalid_category';
		END IF;

		reservation_court_name := 'Tenis Kortu';
		reservation_pricing_type := CASE p_category
			WHEN 'yetiskin' THEN 'Yetişkin'
			ELSE 'Öğrenci'
		END;
		is_summer := month_day BETWEEN '06-01' AND '10-01';
		reservation_day_type := CASE
			WHEN (is_summer AND reservation_hour BETWEEN 7 AND 19)
				OR (NOT is_summer AND reservation_hour BETWEEN 8 AND 17)
			THEN 'gunduz'
			ELSE 'gece'
		END;
		reservation_unit_price := CASE
			WHEN p_category = 'yetiskin' AND reservation_day_type = 'gunduz' THEN 163
			WHEN p_category = 'yetiskin' AND reservation_day_type = 'gece' THEN 217
			WHEN p_category = 'ogrenci' AND reservation_day_type = 'gunduz' THEN 122
			ELSE 163
		END;
	END IF;

	INSERT INTO public.reservations (
		court_id, court_name, reservation_date, reservation_time,
		full_name, phone, person_count, category, pricing_type, day_type,
		unit_price, total_price, receipt_url, receipt_name, is_approved, arrived
	) VALUES (
		p_court_id, reservation_court_name, p_reservation_date,
		p_reservation_time::time, trim(p_full_name), p_phone, p_person_count,
		p_category, reservation_pricing_type, reservation_day_type,
		reservation_unit_price, reservation_unit_price * p_person_count,
		p_receipt_url, p_receipt_name, false, false
	);

	RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_reservation(p_reservation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	DELETE FROM public.reservations AS r
	WHERE r.id::text = p_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_closed_slot(
	p_court_id text,
	p_close_date date,
	p_start_time text,
	p_end_time text,
	p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	IF p_court_id NOT IN ('tenis', 'salon')
		OR p_start_time::time >= p_end_time::time
		OR nullif(trim(p_reason), '') IS NULL THEN
		RAISE EXCEPTION 'Invalid closed slot';
	END IF;

	INSERT INTO public.closed_slots (
		court_id, close_date, start_time, end_time, reason
	) VALUES (
		p_court_id, p_close_date, p_start_time::time, p_end_time::time, trim(p_reason)
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_closed_slot(p_closed_slot_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF auth.jwt() -> 'app_metadata' ->> 'role' IS DISTINCT FROM 'full' THEN
		RAISE EXCEPTION 'Not authorized';
	END IF;

	DELETE FROM public.closed_slots AS c
	WHERE c.id::text = p_closed_slot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(text, date, text, text, text, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_reservation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_closed_slot(text, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_closed_slot(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_reservation(text, date, text, text, text, integer, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_reservation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_closed_slot(text, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_closed_slot(text) TO authenticated;
