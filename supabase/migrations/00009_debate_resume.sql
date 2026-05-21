-- Demande de reprise après pause (validation par l'autre participant)

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS resume_requested_at TIMESTAMPTZ;
