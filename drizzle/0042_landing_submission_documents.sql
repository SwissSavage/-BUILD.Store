CREATE TABLE IF NOT EXISTS landing_submission_documents (
  submission_id text NOT NULL REFERENCES inbound_submissions(id) ON DELETE CASCADE,
  document_index integer NOT NULL,
  content_base64 text NOT NULL,
  PRIMARY KEY (submission_id, document_index)
);
