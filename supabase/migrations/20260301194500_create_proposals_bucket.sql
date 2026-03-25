insert into storage.buckets (id, name, public)
values ('proposals', 'proposals', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload proposal files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND policyname = 'Proposal files upload'
  ) THEN
    CREATE POLICY "Proposal files upload" ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'proposals' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Allow anyone to read proposal files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND policyname = 'Proposal files read'
  ) THEN
    CREATE POLICY "Proposal files read" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'proposals');
  END IF;
END $$;
