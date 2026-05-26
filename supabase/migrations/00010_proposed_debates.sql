-- Étape 1 : nouvelles valeurs d'enum (doivent être commitées avant usage — voir 00011)

ALTER TYPE debate_status ADD VALUE IF NOT EXISTS 'proposed';
ALTER TYPE debate_status ADD VALUE IF NOT EXISTS 'scheduled';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'debate_interest';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'schedule_proposed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'schedule_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'schedule_counter';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'debate_scheduled_start';
