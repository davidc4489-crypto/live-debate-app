-- =============================================================================
-- Live Debate — Schéma MVP simplifié
-- =============================================================================
-- Tables essentielles uniquement : débats, participants, messages, catégories.
-- Pas de notes, favoris, IA, modération ni analytics.
-- À utiliser pour prototyper rapidement ; migrer vers 00001 en production.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE mvp_debate_status AS ENUM ('pending', 'active', 'finished');
CREATE TYPE mvp_participant_role AS ENUM ('participant', 'spectator');

CREATE TABLE mvp_categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE mvp_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mvp_debates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  category_id        UUID NOT NULL REFERENCES mvp_categories (id),
  status             mvp_debate_status NOT NULL DEFAULT 'pending',
  turn_user_id       UUID REFERENCES mvp_profiles (id),
  max_turn_time      INT NOT NULL DEFAULT 120,
  max_message_length INT NOT NULL DEFAULT 500,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ
);

CREATE TABLE mvp_debate_participants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES mvp_debates (id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES mvp_profiles (id) ON DELETE CASCADE,
  role      mvp_participant_role NOT NULL,
  position  INT CHECK (position IN (1, 2)),
  UNIQUE (debate_id, user_id)
);

CREATE TABLE mvp_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   UUID NOT NULL REFERENCES mvp_debates (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES mvp_profiles (id),
  content     TEXT NOT NULL,
  turn_number INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mvp_messages_debate_turn_idx ON mvp_messages (debate_id, turn_number);
CREATE INDEX mvp_participants_debate_idx ON mvp_debate_participants (debate_id);

ALTER PUBLICATION supabase_realtime ADD TABLE mvp_debates;
ALTER PUBLICATION supabase_realtime ADD TABLE mvp_messages;
