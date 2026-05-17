-- =============================================================================
-- Profils publics, centres d'intérêt, stats agrégées
-- Exécuter dans Supabase : SQL Editor → New query → Run
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS age INT;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (
    username IS NULL OR username ~ '^[a-zA-Z0-9_]{3,30}$'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_age_range CHECK (
    age IS NULL OR (age >= 13 AND age <= 120)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_bio_length CHECK (
    bio IS NULL OR char_length(bio) <= 500
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON profiles (lower(trim(username)))
  WHERE username IS NOT NULL;

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS debates_created_by_idx ON debates (created_by)
  WHERE created_by IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Centres d'intérêt
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT interests_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT interests_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS interests_name_unique_idx ON interests (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS interests_slug_unique_idx ON interests (slug);

CREATE TABLE IF NOT EXISTS user_interests (
  user_id     UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, interest_id)
);

CREATE INDEX IF NOT EXISTS user_interests_user_id_idx ON user_interests (user_id);
CREATE INDEX IF NOT EXISTS user_interests_interest_id_idx ON user_interests (interest_id);

INSERT INTO interests (name, slug)
SELECT v.name, v.slug
FROM (VALUES
  ('Politique', 'politique'),
  ('Technologie', 'technologie'),
  ('Sport', 'sport'),
  ('Philosophie', 'philosophie'),
  ('Société', 'societe'),
  ('Économie', 'economie'),
  ('Environnement', 'environnement'),
  ('Culture', 'culture'),
  ('Santé', 'sante'),
  ('Éducation', 'education'),
  ('Sciences', 'sciences'),
  ('Histoire', 'histoire'),
  ('Droit & justice', 'droit-justice'),
  ('International', 'international'),
  ('Médias & presse', 'medias-presse'),
  ('Psychologie', 'psychologie'),
  ('Entrepreneuriat', 'entrepreneuriat'),
  ('Gaming & esport', 'gaming-esport'),
  ('Art & design', 'art-design'),
  ('Musique', 'musique'),
  ('Cinéma & séries', 'cinema-series'),
  ('Actualité', 'actualite'),
  ('Géopolitique', 'geopolitique'),
  ('Intelligence artificielle', 'intelligence-artificielle'),
  ('Climat & écologie', 'climat-ecologie'),
  ('Santé mentale', 'sante-mentale'),
  ('Travail & emploi', 'travail-emploi'),
  ('Logement', 'logement'),
  ('Littérature', 'litterature')
) AS v(name, slug)
WHERE NOT EXISTS (SELECT 1 FROM interests i WHERE i.slug = v.slug);

-- -----------------------------------------------------------------------------
-- RLS (sans DROP — pas d'opération destructive)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_public'
  ) THEN
    CREATE POLICY profiles_select_public ON profiles
      FOR SELECT
      USING (true);
  END IF;
END $$;

ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interests' AND policyname = 'interests_select_all'
  ) THEN
    CREATE POLICY interests_select_all ON interests
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_interests' AND policyname = 'user_interests_select_all'
  ) THEN
    CREATE POLICY user_interests_select_all ON user_interests
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_interests' AND policyname = 'user_interests_all_own'
  ) THEN
    CREATE POLICY user_interests_all_own ON user_interests
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- RPC profil public
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_user_profile(
  p_user_id UUID,
  p_debates_limit INT DEFAULT 20,
  p_debates_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSON;
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'username', p.username,
    'firstName', p.first_name,
    'lastName', p.last_name,
    'avatarUrl', p.avatar_url,
    'bio', p.bio,
    'age', p.age,
    'isPremium', p.is_premium,
    'memberSince', p.created_at
  )
  INTO v_profile
  FROM profiles p
  WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'user', v_profile,
    'interests', COALESCE(
      (
        SELECT json_agg(
          json_build_object('id', i.id, 'name', i.name, 'slug', i.slug)
          ORDER BY i.name
        )
        FROM user_interests ui
        INNER JOIN interests i ON i.id = ui.interest_id
        WHERE ui.user_id = p_user_id
      ),
      '[]'::json
    ),
    'stats', json_build_object(
      'debatesParticipatedCount', (
        SELECT COUNT(DISTINCT dp.debate_id)::int
        FROM debate_participants dp
        WHERE dp.user_id = p_user_id
          AND dp.role = 'participant'
      ),
      'messagesCount', (
        SELECT COUNT(*)::int
        FROM messages m
        WHERE m.user_id = p_user_id
      ),
      'debatesCreatedCount', (
        SELECT COUNT(*)::int
        FROM debates d
        WHERE d.created_by = p_user_id
      ),
      'profileScore', LEAST(
        100,
        (
          SELECT COUNT(*)::int FROM messages m WHERE m.user_id = p_user_id
        ) * 2
        + (
          SELECT COUNT(DISTINCT dp.debate_id)::int
          FROM debate_participants dp
          WHERE dp.user_id = p_user_id AND dp.role = 'participant'
        ) * 10
        + (
          SELECT COUNT(*)::int FROM debates d WHERE d.created_by = p_user_id
        ) * 15
      )
    ),
    'debates', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', sub.id,
            'title', sub.title,
            'theme', sub.theme,
            'status', sub.status,
            'createdAt', sub.created_at,
            'endedAt', sub.ended_at
          )
          ORDER BY sub.created_at DESC
        )
        FROM (
          SELECT
            d.id,
            d.title,
            c.name AS theme,
            d.status::text AS status,
            d.created_at,
            d.ended_at
          FROM debate_participants dp
          INNER JOIN debates d ON d.id = dp.debate_id
          INNER JOIN categories c ON c.id = d.category_id
          WHERE dp.user_id = p_user_id
            AND dp.role = 'participant'
          ORDER BY d.created_at DESC
          LIMIT GREATEST(p_debates_limit, 0)
          OFFSET GREATEST(p_debates_offset, 0)
        ) sub
      ),
      '[]'::json
    ),
    'debatesTotal', (
      SELECT COUNT(DISTINCT dp.debate_id)::int
      FROM debate_participants dp
      WHERE dp.user_id = p_user_id
        AND dp.role = 'participant'
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_user_profile(UUID, INT, INT) TO authenticated, anon, service_role;
