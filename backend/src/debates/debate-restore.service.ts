import { Injectable, Logger } from "@nestjs/common";
import { buildDisplayName } from "../profiles/profile.utils";
import { RestoreRoomPayload } from "../rooms.service";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateMessage } from "../types";
import { isMissingPauseMigrationColumnError } from "./debate-db-errors";
import {
  castSupabaseRow,
  DebateAuthRow,
  DebateMetaRow,
  DebateParticipantRow,
  DebateRestoreRow,
  MessageRow,
  pickEmbeddedProfile,
} from "./debate-db.types";

export interface DebateMeta {
  status: string;
  createdBy: string | null;
  validatedAt: string | null;
  opponentJoinedAt: string | null;
  expiresAt: string | null;
  pausedByUserId: string | null;
  resumeRequestedAt: string | null;
  turnUserId: string | null;
}

@Injectable()
export class DebateRestoreService {
  private readonly logger = new Logger(DebateRestoreService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async fetchDebateRow(debateId: string): Promise<DebateAuthRow | null> {
    const supabase = this.supabaseService.getServiceClient();
    const selects = [
      "id, status, paused_by_user_id, resume_requested_at, validated_at",
      "id, status, paused_by_user_id",
      "id, status",
    ];

    for (const fields of selects) {
      const { data, error } = await supabase
        .from("debates")
        .select(fields)
        .eq("id", debateId)
        .maybeSingle();

      if (!error && data) {
        return castSupabaseRow<DebateAuthRow>(data);
      }

      if (error && !isMissingPauseMigrationColumnError(error)) {
        this.logger.warn(`fetchDebateRow ${debateId} : ${error.message}`);
        return null;
      }
    }

    return null;
  }

  /** Ligne debates pour l'autorisation reprise (fusionnée avec la room par DebatePresenceService). */
  async getDebateAuthRow(debateId: string): Promise<DebateAuthRow | null> {
    return this.fetchDebateRow(debateId);
  }

  /**
   * Métadonnées DB d'un débat (requêtes avec repli si migrations pause/reprise absentes).
   *
   * Attention : `pausedByUserId` / `resumeRequestedAt` à `null` signifie soit « pas en pause »,
   * soit « colonnes 00008/00009 non appliquées » (select de repli sans ces champs). Les deux cas
   * sont indistinguables ici. Les appelants (gateway, reprise) doivent compléter avec l'état live
   * de la room (`syncPauseFromDb`) et ne pas interpréter `null` comme preuve
   * que le débat n'est pas en pause.
   */
  async getDebateMeta(debateId: string): Promise<DebateMeta | null> {
    const supabase = this.supabaseService.getServiceClient();
    const selects = [
      "status, created_by, validated_at, opponent_joined_at, expires_at, paused_by_user_id, resume_requested_at, turn_user_id",
      "status, created_by, validated_at, opponent_joined_at, expires_at, turn_user_id",
      "status, created_by, validated_at, opponent_joined_at, expires_at",
    ];

    for (const fields of selects) {
      const { data, error } = await supabase
        .from("debates")
        .select(fields)
        .eq("id", debateId)
        .maybeSingle();

      if (!error && data) {
        const row = castSupabaseRow<DebateMetaRow>(data);
        return {
          status: row.status,
          createdBy: row.created_by,
          validatedAt: row.validated_at,
          opponentJoinedAt: row.opponent_joined_at,
          expiresAt: row.expires_at,
          pausedByUserId: row.paused_by_user_id ?? null,
          resumeRequestedAt: row.resume_requested_at ?? null,
          turnUserId: row.turn_user_id ?? null,
        };
      }

      if (error && !isMissingPauseMigrationColumnError(error)) {
        return null;
      }
    }

    return null;
  }

  private async fetchDebateForRestore(debateId: string): Promise<DebateRestoreRow | null> {
    const supabase = this.supabaseService.getServiceClient();
    const selects = [
      "id, title, status, created_by, max_turn_time, validated_at, opponent_joined_at, paused_by_user_id, resume_requested_at, turn_user_id",
      "id, title, status, created_by, max_turn_time, validated_at, opponent_joined_at, turn_user_id",
      "id, title, status, created_by, max_turn_time, validated_at, opponent_joined_at",
      "id, title, status, created_by, max_turn_time",
      "id, title, status, created_by",
      "id, title, status",
    ];

    for (const fields of selects) {
      const { data, error } = await supabase
        .from("debates")
        .select(fields)
        .eq("id", debateId)
        .maybeSingle();

      if (!error && data) {
        return castSupabaseRow<DebateRestoreRow>(data);
      }

      if (error && !isMissingPauseMigrationColumnError(error)) {
        this.logger.warn(`fetchDebateForRestore ${debateId} : ${error.message}`);
        return null;
      }
    }

    return null;
  }

  private async fetchRestoreParticipants(
    debateId: string,
  ): Promise<RestoreRoomPayload["participants"]> {
    const supabase = this.supabaseService.getServiceClient();
    const selects = [
      "user_id, position, role, profiles ( username, first_name, last_name, email )",
      "user_id, position, role",
    ];

    for (const fields of selects) {
      const { data, error } = await supabase
        .from("debate_participants")
        .select(fields)
        .eq("debate_id", debateId)
        .eq("role", "participant");

      if (!error && data) {
        const rows = castSupabaseRow<DebateParticipantRow[]>(data);

        return rows
          .filter((r) => r.position === 1 || r.position === 2)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((r) => {
            const profile = pickEmbeddedProfile(r.profiles);
            const name = profile
              ? buildDisplayName({
                  username: profile.username,
                  firstName: profile.first_name,
                  lastName: profile.last_name,
                  email: profile.email,
                })
              : "Participant";
            return {
              userId: r.user_id,
              position: r.position as 1 | 2,
              displayName: name,
            };
          });
      }

      if (error && !/profiles|schema cache|Could not find/i.test(error.message)) {
        this.logger.warn(`fetchRestoreParticipants ${debateId} : ${error.message}`);
        return [];
      }
    }

    return [];
  }

  private async fetchRestoreMessages(
    debateId: string,
    participants: Array<{ userId: string; displayName: string }>,
  ): Promise<DebateMessage[]> {
    const supabase = this.supabaseService.getServiceClient();
    const nameByUserId = new Map(participants.map((p) => [p.userId, p.displayName]));

    const { data, error } = await supabase
      .from("messages")
      .select("id, content, user_id, turn_number")
      .eq("debate_id", debateId)
      .order("turn_number", { ascending: true });

    if (error) {
      this.logger.warn(`fetchRestoreMessages ${debateId} : ${error.message}`);
      return [];
    }

    const rows = castSupabaseRow<MessageRow[]>(data ?? []);

    return rows.map((row) => ({
      id: row.id,
      user: nameByUserId.get(row.user_id) ?? "Participant",
      text: row.content,
      userId: row.user_id,
    }));
  }

  async getDebateRestorePayload(debateId: string): Promise<RestoreRoomPayload | null> {
    const row = await this.fetchDebateForRestore(debateId);
    if (!row) {
      this.logger.warn(`Restauration impossible : débat ${debateId} absent en base.`);
      return null;
    }

    const participants = await this.fetchRestoreParticipants(debateId);
    const messages = await this.fetchRestoreMessages(debateId, participants);

    return {
      id: row.id,
      title: row.title || "Débat",
      status: row.status,
      createdBy: row.created_by ?? null,
      maxTurnTime: row.max_turn_time ?? 180,
      validatedAt: row.validated_at ?? null,
      opponentJoinedAt: row.opponent_joined_at ?? null,
      pausedByUserId: row.paused_by_user_id ?? null,
      resumeRequestedAt: row.resume_requested_at ?? null,
      turnUserId: row.turn_user_id ?? null,
      participants,
      messages,
    };
  }
}
