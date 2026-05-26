-- Étape 2 : schéma débats proposés (après commit des enum de 00010)

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interested_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS debate_schedule_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  proposed_at TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debate_schedule_proposals_debate_idx
  ON debate_schedule_proposals (debate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS debates_proposed_list_idx
  ON debates (created_at DESC)
  WHERE status = 'proposed';

CREATE INDEX IF NOT EXISTS debates_scheduled_at_idx
  ON debates (scheduled_at)
  WHERE status = 'scheduled';

ALTER TABLE debate_schedule_proposals ENABLE ROW LEVEL SECURITY;
