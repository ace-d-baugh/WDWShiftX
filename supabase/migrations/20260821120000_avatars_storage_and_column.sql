-- Profile pictures: first Supabase Storage bucket in this project. Public-read
-- (avatars aren't sensitive, and a public bucket means <img> tags load the
-- URL directly with no signed-URL dance), write-restricted to each user's own
-- <user_id>/ path prefix. The client always re-encodes to JPEG before upload
-- and always writes to the same path (avatars/<user_id>/avatar.jpg), so a
-- re-upload is a clean overwrite — no orphaned files to clean up later.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- storage.foldername(name) splits the object path on '/' — [1] is the first
-- segment, i.e. the <user_id> prefix. Anyone can read (public bucket, covers
-- both anon and authenticated); only the owning user can write their own.
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- users.avatar_url stores the full public Storage URL, with a ?v=<timestamp>
-- query string appended on every upload — the object path never changes
-- (clean overwrite above), so without a cache-busting query string a
-- re-uploaded photo would keep showing the old cached image to anyone who'd
-- already loaded it.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- boards and users both use an explicit column-level SELECT grant instead of
-- table-wide (see 20260730003000 and 20260701152710) — a new column has no
-- grant until it's added here, and selecting it fails the WHOLE query with
-- "permission denied for table X", not just that column.
GRANT SELECT (avatar_url) ON public.users TO anon, authenticated;
