UPDATE storage.buckets
SET public = false
WHERE id = 'dekontlar';

DROP POLICY IF EXISTS "Full admins can read receipt files" ON storage.objects;
CREATE POLICY "Full admins can read receipt files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
	bucket_id = 'dekontlar'
	AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'full'
);

DROP POLICY IF EXISTS "Restrict receipt reads to full admins" ON storage.objects;
CREATE POLICY "Restrict receipt reads to full admins"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (
	bucket_id <> 'dekontlar'
	OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'full'
);
