-- Conclusions de fin de débat (une par participant authentifié)
CREATE TABLE debate_conclusions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id  UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT debate_conclusions_unique_user_per_debate UNIQUE (debate_id, user_id),
  CONSTRAINT debate_conclusions_content_not_empty CHECK (char_length(trim(content)) > 0),
  CONSTRAINT debate_conclusions_content_max CHECK (char_length(content) <= 3000)
);

CREATE INDEX debate_conclusions_debate_id_idx ON debate_conclusions (debate_id);
CREATE INDEX debate_conclusions_user_id_idx ON debate_conclusions (user_id);

ALTER TABLE debate_conclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY debate_conclusions_select_all ON debate_conclusions
  FOR SELECT USING (true);

CREATE POLICY debate_conclusions_insert_own ON debate_conclusions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM debates d
      WHERE d.id = debate_id AND d.status = 'finished'
    )
    AND EXISTS (
      SELECT 1 FROM debate_participants dp
      WHERE dp.debate_id = debate_id
        AND dp.user_id = auth.uid()
        AND dp.role = 'participant'
    )
  );

CREATE POLICY debate_conclusions_update_own ON debate_conclusions
  FOR UPDATE USING (auth.uid() = user_id);
