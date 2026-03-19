-- ============================================================
-- RLS policies for document_attachments and Storage bucket
-- Allows the anon role to manage documents (internal ERP, no user auth)
-- ============================================================

-- 1. Ensure RLS is enabled on document_attachments
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert documents
CREATE POLICY "anon_insert_document_attachments"
  ON document_attachments FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to select documents
CREATE POLICY "anon_select_document_attachments"
  ON document_attachments FOR SELECT
  TO anon
  USING (true);

-- Allow anon to update documents
CREATE POLICY "anon_update_document_attachments"
  ON document_attachments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to delete documents
CREATE POLICY "anon_delete_document_attachments"
  ON document_attachments FOR DELETE
  TO anon
  USING (true);

-- 2. Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for the 'documents' bucket
-- Allow anon to upload files
CREATE POLICY "anon_upload_documents"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'documents');

-- Allow anon to read/download files
CREATE POLICY "anon_read_documents"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'documents');

-- Allow anon to update files (overwrite)
CREATE POLICY "anon_update_documents"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- Allow anon to delete files
CREATE POLICY "anon_delete_documents"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'documents');
