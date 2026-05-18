-- Statut annulé, validation de démarrage, expiration 1h, notification adversaire

ALTER TYPE debate_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'opponent_joined';

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opponent_joined_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS debates_pending_expires_idx
  ON debates (expires_at)
  WHERE status = 'pending' AND validated_at IS NULL;
