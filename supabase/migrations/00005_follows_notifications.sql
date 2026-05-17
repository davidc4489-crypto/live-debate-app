-- =============================================================================
-- Abonnements (follows), notifications, visibilité liste « abonnements »
-- =============================================================================

CREATE TYPE following_list_visibility AS ENUM ('public', 'private');

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS following_list_visibility following_list_visibility NOT NULL DEFAULT 'public';

-- -----------------------------------------------------------------------------
-- Suivis : follower suit following
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx ON user_follows (follower_id);
CREATE INDEX IF NOT EXISTS user_follows_following_id_idx ON user_follows (following_id);
CREATE INDEX IF NOT EXISTS user_follows_following_created_idx ON user_follows (following_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Notifications in-app
-- -----------------------------------------------------------------------------
CREATE TYPE notification_type AS ENUM ('new_debate');

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  actor_id   UUID REFERENCES profiles (id) ON DELETE SET NULL,
  debate_id  UUID REFERENCES debates (id) ON DELETE CASCADE,
  room_id    TEXT,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, created_at DESC)
  WHERE read = false;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_follows' AND policyname = 'user_follows_select_all'
  ) THEN
    CREATE POLICY user_follows_select_all ON user_follows FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_follows' AND policyname = 'user_follows_insert_own'
  ) THEN
    CREATE POLICY user_follows_insert_own ON user_follows
      FOR INSERT TO authenticated
      WITH CHECK (follower_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_follows' AND policyname = 'user_follows_delete_own'
  ) THEN
    CREATE POLICY user_follows_delete_own ON user_follows
      FOR DELETE TO authenticated
      USING (follower_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_select_own'
  ) THEN
    CREATE POLICY notifications_select_own ON notifications
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_update_own'
  ) THEN
    CREATE POLICY notifications_update_own ON notifications
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
