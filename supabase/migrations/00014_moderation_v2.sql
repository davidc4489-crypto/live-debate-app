-- -----------------------------------------------------------------------------
-- Modération v2 : catégories, gravité, langue et modèles ayant décidé
-- -----------------------------------------------------------------------------
-- Le service Python renvoie désormais un verdict détaillé (Detoxify multilingue
-- + lexique FR/EN). On le persiste pour pouvoir auditer les décisions, régler
-- les seuils sur données réelles et alimenter un tableau de bord de modération.

ALTER TABLE message_flags
  ADD COLUMN IF NOT EXISTS action        TEXT,
  ADD COLUMN IF NOT EXISTS categories    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS severity      REAL   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS language      TEXT,
  ADD COLUMN IF NOT EXISTS models        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quality_score SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_flags_action_valid'
  ) THEN
    ALTER TABLE message_flags
      ADD CONSTRAINT message_flags_action_valid
      CHECK (action IS NULL OR action IN ('allow', 'warn', 'block'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_flags_severity_range'
  ) THEN
    ALTER TABLE message_flags
      ADD CONSTRAINT message_flags_severity_range
      CHECK (severity >= 0 AND severity <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_flags_quality_range'
  ) THEN
    ALTER TABLE message_flags
      ADD CONSTRAINT message_flags_quality_range
      CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));
  END IF;
END $$;

-- Historique : les lignes existantes n'ont pas d'action explicite.
UPDATE message_flags
SET action = CASE WHEN is_blocked THEN 'block' ELSE 'allow' END
WHERE action IS NULL;

CREATE INDEX IF NOT EXISTS message_flags_severity_idx
  ON message_flags (severity DESC) WHERE severity > 0;

CREATE INDEX IF NOT EXISTS message_flags_action_idx
  ON message_flags (action, created_at DESC);

-- Vue de supervision : volumétrie par jour, action et langue.
CREATE OR REPLACE VIEW moderation_overview AS
SELECT
  date_trunc('day', created_at) AS day,
  COALESCE(action, CASE WHEN is_blocked THEN 'block' ELSE 'allow' END) AS action,
  COALESCE(language, 'inconnue') AS language,
  count(*)                       AS messages,
  round(avg(toxicity_score)::numeric, 4) AS avg_toxicity,
  round(avg(severity)::numeric, 4)       AS avg_severity,
  round(avg(quality_score)::numeric, 1)  AS avg_quality
FROM message_flags
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;
