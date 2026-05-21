/** Statuts `debate_status` en base (migrations 00001, 00007, 00008). */
export type DebateStatus =
  | "pending"
  | "active"
  | "finished"
  | "cancelled"
  | "paused";

/**
 * Ligne `debates` complète (snake_case, alignée Supabase).
 * Les selects partiels utilisent les types `DebateAuthRow`, `DebateMetaRow`, etc.
 */
export interface DebateRow {
  id: string;
  title: string;
  status: DebateStatus;
  created_by: string | null;
  turn_user_id: string | null;
  max_turn_time: number;
  validated_at: string | null;
  opponent_joined_at: string | null;
  expires_at: string | null;
  paused_by_user_id: string | null;
  paused_at: string | null;
  resume_requested_at: string | null;
  ended_by_user_id: string | null;
  started_at: string | null;
  ended_at: string | null;
}

/** Select repli auth / reprise (00008, 00009 optionnels). */
export type DebateAuthRow = Pick<DebateRow, "id" | "status"> &
  Partial<Pick<DebateRow, "paused_by_user_id" | "resume_requested_at" | "validated_at">>;

/** Select repli métadonnées listing / gateway. */
export type DebateMetaRow = Pick<
  DebateRow,
  "status" | "created_by" | "validated_at" | "opponent_joined_at" | "expires_at"
> &
  Partial<Pick<DebateRow, "paused_by_user_id" | "resume_requested_at" | "turn_user_id">>;

/** Select repli restauration room depuis la DB. */
export type DebateRestoreRow = Pick<DebateRow, "id" | "title" | "status"> &
  Partial<
    Pick<
      DebateRow,
      | "created_by"
      | "max_turn_time"
      | "validated_at"
      | "opponent_joined_at"
      | "paused_by_user_id"
      | "resume_requested_at"
      | "turn_user_id"
    >
  >;

export interface DebateValidateStartRow {
  id: string;
  status: DebateStatus;
  created_by: string | null;
  validated_at: string | null;
  opponent_joined_at: string | null;
}

export interface ProfileEmbedRow {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface DebateParticipantRow {
  user_id: string;
  position: number | null;
  role: string;
  profiles?: ProfileEmbedRow | ProfileEmbedRow[] | null;
}

export interface MessageRow {
  id: string;
  content: string;
  user_id: string;
  turn_number: number;
}

/** Le client Supabase n'infère pas les selects dynamiques (chaînes variables). */
export function castSupabaseRow<T>(data: unknown): T {
  return data as T;
}

export function pickEmbeddedProfile(
  profiles: DebateParticipantRow["profiles"],
): ProfileEmbedRow | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}
