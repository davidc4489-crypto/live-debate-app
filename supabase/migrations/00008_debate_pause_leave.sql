-- Pause volontaire, fin par participant, traçabilité

ALTER TYPE debate_status ADD VALUE IF NOT EXISTS 'paused';

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS paused_by_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_by_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS debates_paused_by_idx ON debates (paused_by_user_id)
  WHERE paused_by_user_id IS NOT NULL;
