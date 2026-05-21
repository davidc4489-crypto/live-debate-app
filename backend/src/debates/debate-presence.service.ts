import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { RoomState, SocketSession } from "../types";
import { isMissingPauseMigrationColumnError } from "./debate-db-errors";
import { DebateAuthRow, DebateRow } from "./debate-db.types";

@Injectable()
export class DebatePresenceService {
  private readonly logger = new Logger(DebatePresenceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private isPausedEnumError(message: string): boolean {
    return /invalid input value for enum|debate_status/i.test(message);
  }

  async pauseDebate(
    debateId: string,
    userId: string,
    turnUserId: string | null = null,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const now = new Date().toISOString();

    const withTurn = turnUserId ? { turn_user_id: turnUserId } : {};

    type PauseUpdate = Partial<
      Pick<
        DebateRow,
        "status" | "paused_by_user_id" | "paused_at" | "turn_user_id"
      >
    >;

    const attempts: PauseUpdate[] = [
      {
        status: "paused",
        paused_by_user_id: userId,
        paused_at: now,
        ...withTurn,
      },
      {
        status: "paused",
        ...withTurn,
      },
      ...(turnUserId ? [{ turn_user_id: turnUserId }] : []),
    ];

    let lastError: string | null = null;

    for (const payload of attempts) {
      const { error } = await supabase
        .from("debates")
        .update(payload)
        .eq("id", debateId)
        .in("status", ["active", "pending", "paused"]);

      if (!error) {
        if (!("paused_at" in payload)) {
          this.logger.warn(
            `Pause ${debateId} : migration 00008 non appliquée — état actif en base, pause conservée en direct.`,
          );
        }
        return;
      }

      lastError = error.message;
      if (
        !isMissingPauseMigrationColumnError(error) &&
        !this.isPausedEnumError(error.message)
      ) {
        break;
      }
    }

    this.logger.warn(`Pause débat ${debateId} : ${lastError}`);
    throw new BadRequestException(
      `Impossible de mettre le débat en pause : ${lastError}. Appliquez la migration supabase/migrations/00008_debate_pause_leave.sql`,
    );
  }

  async finishDebateByUser(
    debateId: string,
    userId: string,
    endedAt: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    type FinishUpdate = Partial<
      Pick<
        DebateRow,
        | "status"
        | "ended_at"
        | "ended_by_user_id"
        | "turn_user_id"
        | "paused_by_user_id"
        | "paused_at"
      >
    >;

    const attempts: FinishUpdate[] = [
      {
        status: "finished",
        ended_at: endedAt,
        ended_by_user_id: userId,
        turn_user_id: null,
        paused_by_user_id: null,
        paused_at: null,
      },
      {
        status: "finished",
        ended_at: endedAt,
        turn_user_id: null,
      },
    ];

    let lastError: string | null = null;

    for (const payload of attempts) {
      const { error } = await supabase
        .from("debates")
        .update(payload)
        .eq("id", debateId)
        .in("status", ["active", "pending", "paused"]);

      if (!error) {
        if (!("ended_by_user_id" in payload)) {
          this.logger.warn(
            `Fin ${debateId} : colonnes ended_by_user_id absentes (migration 00008).`,
          );
        }
        return;
      }

      lastError = error.message;
      if (!isMissingPauseMigrationColumnError(error)) {
        break;
      }
    }

    throw new BadRequestException(
      `Impossible de terminer le débat : ${lastError}`,
    );
  }

  assertCanManagePresence(room: RoomState, session: SocketSession): void {
    if (room.status === "finished" || room.status === "cancelled") {
      throw new BadRequestException("Ce débat est déjà terminé.");
    }

    if (session.role !== "participantA" && session.role !== "participantB") {
      throw new ForbiddenException("Seuls les participants peuvent effectuer cette action.");
    }

    if (!session.userId) {
      throw new ForbiddenException("Connectez-vous pour quitter le débat.");
    }
  }

  /**
   * Point d'autorité reprise : fusionne l'état live (room) et la ligne DB avant validation.
   */
  private resolveResumeAuthState(
    room: RoomState,
    dbRow: DebateAuthRow | null,
  ): {
    effectiveStatus: string | undefined;
    pausedByUserId: string | null;
    resumeRequestedAt: string | null;
  } {
    const effectiveStatus =
      dbRow?.status === "paused" || room.status === "paused"
        ? "paused"
        : dbRow?.status ?? room.status;

    return {
      effectiveStatus,
      pausedByUserId: dbRow?.paused_by_user_id ?? room.pausedByUserId ?? null,
      resumeRequestedAt: dbRow?.resume_requested_at ?? room.resumeRequestedAt ?? null,
    };
  }

  assertCanRequestResume(
    room: RoomState,
    session: SocketSession,
    dbRow: DebateAuthRow | null,
  ): void {
    if (!session.userId) {
      throw new ForbiddenException("Connectez-vous pour demander la reprise.");
    }

    if (!dbRow && room.status !== "paused") {
      throw new ForbiddenException("Débat introuvable.");
    }

    const { effectiveStatus, pausedByUserId, resumeRequestedAt } =
      this.resolveResumeAuthState(room, dbRow);

    if (effectiveStatus !== "paused") {
      throw new BadRequestException("Ce débat n'est pas en pause.");
    }

    if (pausedByUserId !== session.userId) {
      throw new ForbiddenException(
        "Seul le participant qui a mis le débat en pause peut demander la reprise.",
      );
    }

    if (resumeRequestedAt) {
      throw new BadRequestException("Une demande de reprise est déjà en attente.");
    }
  }

  assertCanValidateResume(
    room: RoomState,
    session: SocketSession,
    dbRow: DebateAuthRow | null,
  ): void {
    if (!session.userId) {
      throw new ForbiddenException("Connectez-vous pour valider la reprise.");
    }

    if (!dbRow && room.status !== "paused") {
      throw new ForbiddenException("Débat introuvable.");
    }

    const { effectiveStatus, pausedByUserId, resumeRequestedAt } =
      this.resolveResumeAuthState(room, dbRow);

    if (effectiveStatus !== "paused") {
      throw new BadRequestException("Ce débat n'est pas en pause.");
    }

    if (pausedByUserId === session.userId) {
      throw new ForbiddenException(
        "L'autre participant doit valider la reprise du débat.",
      );
    }

    if (!resumeRequestedAt) {
      throw new BadRequestException("Aucune demande de reprise en attente.");
    }
  }
}
