-- =============================================================================
-- Live Debate — Schéma PostgreSQL / Supabase (production)
-- =============================================================================
-- Prérequis : extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
CREATE TYPE debate_status AS ENUM ('pending', 'active', 'finished');

CREATE TYPE participant_role AS ENUM ('participant', 'spectator');

CREATE TYPE ai_output_type AS ENUM (
  'summary',
  'moderation',
  'analysis',
  'rewrite',
  'highlight'
);

-- -----------------------------------------------------------------------------
-- Catégories
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT categories_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT categories_slug_not_empty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX categories_name_unique_idx ON categories (lower(trim(name)));
CREATE UNIQUE INDEX categories_slug_unique_idx ON categories (slug);

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (extension de auth.users — pas de password ici)
-- Supabase Auth gère email + mot de passe dans auth.users
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  is_premium  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_email_not_empty CHECK (char_length(trim(email)) > 0)
);

CREATE UNIQUE INDEX profiles_email_unique_idx ON profiles (lower(trim(email)));

-- -----------------------------------------------------------------------------
-- Débats
-- -----------------------------------------------------------------------------
CREATE TABLE debates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  category_id        UUID NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  status             debate_status NOT NULL DEFAULT 'pending',
  turn_user_id       UUID REFERENCES profiles (id) ON DELETE SET NULL,
  current_turn_number INT NOT NULL DEFAULT 0,
  max_turn_time      INT NOT NULL DEFAULT 120,
  max_message_length INT NOT NULL DEFAULT 500,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT debates_title_not_empty CHECK (char_length(trim(title)) > 0),
  CONSTRAINT debates_max_turn_time_positive CHECK (max_turn_time > 0),
  CONSTRAINT debates_max_message_length_positive CHECK (max_message_length > 0 AND max_message_length <= 10000),
  CONSTRAINT debates_current_turn_number_non_negative CHECK (current_turn_number >= 0),
  CONSTRAINT debates_ended_after_created CHECK (
    ended_at IS NULL OR ended_at >= created_at
  ),
  CONSTRAINT debates_started_before_ended CHECK (
    started_at IS NULL OR ended_at IS NULL OR ended_at >= started_at
  )
);

CREATE INDEX debates_category_id_idx ON debates (category_id);
CREATE INDEX debates_status_idx ON debates (status);
CREATE INDEX debates_turn_user_id_idx ON debates (turn_user_id) WHERE turn_user_id IS NOT NULL;
CREATE INDEX debates_created_at_idx ON debates (created_at DESC);
CREATE INDEX debates_active_list_idx ON debates (status, created_at DESC)
  WHERE status IN ('pending', 'active');

-- -----------------------------------------------------------------------------
-- Participants & spectateurs (remplace user1 / user2)
-- -----------------------------------------------------------------------------
CREATE TABLE debate_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id  UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role       participant_role NOT NULL,
  position   INT,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT debate_participants_unique_user_per_debate UNIQUE (debate_id, user_id),
  CONSTRAINT debate_participants_position_range CHECK (
    position IS NULL OR position IN (1, 2)
  ),
  CONSTRAINT debate_participants_position_role CHECK (
    (role = 'participant' AND position IN (1, 2))
    OR (role = 'spectator' AND position IS NULL)
  )
);

-- Un seul joueur par position (1 et 2) par débat
CREATE UNIQUE INDEX debate_participants_debate_position_unique_idx
  ON debate_participants (debate_id, position)
  WHERE role = 'participant' AND position IS NOT NULL;

CREATE INDEX debate_participants_debate_id_idx ON debate_participants (debate_id);
CREATE INDEX debate_participants_user_id_idx ON debate_participants (user_id);
CREATE INDEX debate_participants_debate_role_idx ON debate_participants (debate_id, role);

-- -----------------------------------------------------------------------------
-- Messages (optimisé gros volume + Realtime)
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id    UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  turn_number  INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT messages_content_not_empty CHECK (char_length(trim(content)) > 0),
  CONSTRAINT messages_turn_number_positive CHECK (turn_number > 0)
);

-- Index principal : flux chronologique par débat (pagination curseur)
CREATE INDEX messages_debate_id_idx ON messages (debate_id);
CREATE INDEX messages_user_id_idx ON messages (user_id);
CREATE INDEX messages_debate_turn_number_idx ON messages (debate_id, turn_number);
CREATE INDEX messages_debate_created_at_idx ON messages (debate_id, created_at DESC);
CREATE INDEX messages_debate_turn_created_idx ON messages (debate_id, turn_number, created_at);

-- Un message par tour et par auteur (évite doublons tour par tour)
CREATE UNIQUE INDEX messages_debate_turn_user_unique_idx
  ON messages (debate_id, turn_number, user_id);

-- -----------------------------------------------------------------------------
-- Sorties IA (scalable)
-- -----------------------------------------------------------------------------
CREATE TABLE ai_outputs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  message_id  UUID REFERENCES messages (id) ON DELETE CASCADE,
  type        ai_output_type NOT NULL,
  content     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_outputs_content_not_empty CHECK (content <> '{}'::jsonb OR type IS NOT NULL)
);

CREATE INDEX ai_outputs_debate_id_idx ON ai_outputs (debate_id);
CREATE INDEX ai_outputs_message_id_idx ON ai_outputs (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX ai_outputs_debate_type_idx ON ai_outputs (debate_id, type);
CREATE INDEX ai_outputs_created_at_idx ON ai_outputs (created_at DESC);

-- -----------------------------------------------------------------------------
-- Favoris
-- -----------------------------------------------------------------------------
CREATE TABLE favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  debate_id  UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT favorites_user_debate_unique UNIQUE (user_id, debate_id)
);

CREATE INDEX favorites_user_id_idx ON favorites (user_id);
CREATE INDEX favorites_debate_id_idx ON favorites (debate_id);
CREATE INDEX favorites_user_created_idx ON favorites (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Notes utilisateur
-- -----------------------------------------------------------------------------
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notes_title_not_empty CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX notes_user_id_idx ON notes (user_id);
CREATE INDEX notes_user_created_idx ON notes (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Liens notes ↔ débats / messages
-- -----------------------------------------------------------------------------
CREATE TABLE note_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  debate_id  UUID REFERENCES debates (id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT note_links_at_least_one_target CHECK (
    debate_id IS NOT NULL OR message_id IS NOT NULL
  ),
  CONSTRAINT note_links_unique_note_debate UNIQUE (note_id, debate_id),
  CONSTRAINT note_links_unique_note_message UNIQUE (note_id, message_id)
);

CREATE INDEX note_links_note_id_idx ON note_links (note_id);
CREATE INDEX note_links_debate_id_idx ON note_links (debate_id) WHERE debate_id IS NOT NULL;
CREATE INDEX note_links_message_id_idx ON note_links (message_id) WHERE message_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Modération hybride (scores + blocage)
-- -----------------------------------------------------------------------------
CREATE TABLE message_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  toxicity_score  REAL NOT NULL DEFAULT 0,
  is_blocked      BOOLEAN NOT NULL DEFAULT false,
  reason          TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT message_flags_message_unique UNIQUE (message_id),
  CONSTRAINT message_flags_toxicity_range CHECK (
    toxicity_score >= 0 AND toxicity_score <= 1
  ),
  CONSTRAINT message_flags_blocked_requires_reason CHECK (
    NOT is_blocked OR reason IS NOT NULL
  )
);

CREATE INDEX message_flags_is_blocked_idx ON message_flags (is_blocked) WHERE is_blocked = true;
CREATE INDEX message_flags_toxicity_idx ON message_flags (toxicity_score DESC)
  WHERE is_blocked = false;

-- -----------------------------------------------------------------------------
-- Vues / présence spectateurs (remplace compteur statique)
-- -----------------------------------------------------------------------------
CREATE TABLE debate_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id  UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles (id) ON DELETE SET NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at    TIMESTAMPTZ,

  CONSTRAINT debate_views_identity CHECK (
    user_id IS NOT NULL OR session_id IS NOT NULL
  )
);

CREATE INDEX debate_views_debate_id_idx ON debate_views (debate_id);
CREATE INDEX debate_views_user_id_idx ON debate_views (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX debate_views_debate_active_idx ON debate_views (debate_id, created_at DESC)
  WHERE left_at IS NULL;

-- -----------------------------------------------------------------------------
-- Fonctions & triggers
-- -----------------------------------------------------------------------------

-- Longueur message vs max du débat
CREATE OR REPLACE FUNCTION check_message_length()
RETURNS TRIGGER AS $$
DECLARE
  max_len INT;
BEGIN
  SELECT max_message_length INTO max_len
  FROM debates
  WHERE id = NEW.debate_id;

  IF char_length(NEW.content) > max_len THEN
    RAISE EXCEPTION 'Message exceeds max length (%) for this debate', max_len;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_check_length
  BEFORE INSERT OR UPDATE OF content ON messages
  FOR EACH ROW EXECUTE FUNCTION check_message_length();

-- turn_user_id doit être un participant actif du débat
CREATE OR REPLACE FUNCTION check_turn_user_is_participant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.turn_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM debate_participants dp
    WHERE dp.debate_id = NEW.id
      AND dp.user_id = NEW.turn_user_id
      AND dp.role = 'participant'
  ) THEN
    RAISE EXCEPTION 'turn_user_id must be an active participant of this debate';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER debates_check_turn_user
  BEFORE INSERT OR UPDATE OF turn_user_id ON debates
  FOR EACH ROW EXECUTE FUNCTION check_turn_user_is_participant();

-- Auto-création profil à l'inscription Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- updated_at automatique
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER debates_set_updated_at
  BEFORE UPDATE ON debates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) — squelette Supabase
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Profils : lecture publique limitée, écriture propre compte
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Catégories : lecture pour tous les authentifiés
CREATE POLICY categories_select_all ON categories
  FOR SELECT TO authenticated USING (true);

-- Messages : lecture si membre du débat, insert si c'est son tour
CREATE POLICY messages_select_debate_members ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM debate_participants dp
      WHERE dp.debate_id = messages.debate_id
        AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY messages_insert_own_turn ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM debates d
      WHERE d.id = debate_id
        AND d.turn_user_id = auth.uid()
        AND d.status = 'active'
    )
  );

-- Favoris : CRUD sur ses propres favoris
CREATE POLICY favorites_all_own ON favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notes : privées à l'utilisateur
CREATE POLICY notes_all_own ON notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Supabase Realtime — activer la réplication
-- Exécuter aussi dans le Dashboard : Database → Replication
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE debates;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE message_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_views;
