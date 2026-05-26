-- Position argumentée (pour / contre) et mode adversaire (humain / IA)

CREATE TYPE debate_stance AS ENUM ('for', 'against');
CREATE TYPE debate_opponent_mode AS ENUM ('human', 'ai');

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS creator_stance debate_stance,
  ADD COLUMN IF NOT EXISTS opponent_mode debate_opponent_mode NOT NULL DEFAULT 'human';
