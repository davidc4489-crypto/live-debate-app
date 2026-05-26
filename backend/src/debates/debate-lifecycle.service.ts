import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { FollowsService } from "../follows/follows.service";
import { SupabaseService } from "../supabase/supabase.service";
import { isMissingPauseMigrationColumnError } from "./debate-db-errors";
import { castSupabaseRow, DebateRow, DebateValidateStartRow } from "./debate-db.types";

const WAITING_DURATION_MS = 60 * 60 * 1000;

@Injectable()
export class DebateLifecycleService {
  private readonly logger = new Logger(DebateLifecycleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
  ) {}

  getExpiresAtIso(): string {
    return new Date(Date.now() + WAITING_DURATION_MS).toISOString();
  }

  async onSecondParticipantJoined(
    debateId: string,
    creatorId: string,
    opponentId: string,
    opponentDisplayName: string,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .from("debates")
      .update({
        opponent_joined_at: new Date().toISOString(),
        turn_user_id: creatorId,
      })
      .eq("id", debateId)
      .eq("status", "pending")
      .is("validated_at", null)
      .is("opponent_joined_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      this.logger.warn(`Mise à jour adversaire ${debateId} : ${error.message}`);
      return false;
    }

    if (!data) {
      return false;
    }

    await this.followsService.notifyCreatorOpponentJoined(
      creatorId,
      opponentId,
      debateId,
      opponentDisplayName,
    );
    return true;
  }

  async validateDebateStart(debateId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    const { data: debate, error: fetchError } = await supabase
      .from("debates")
      .select("id, status, created_by, validated_at, opponent_joined_at")
      .eq("id", debateId)
      .maybeSingle();

    if (fetchError || !debate) {
      throw new ForbiddenException("Débat introuvable.");
    }

    const row = castSupabaseRow<DebateValidateStartRow>(debate);

    if (row.status === "cancelled") {
      throw new ForbiddenException("Ce débat a été annulé.");
    }

    if (row.status === "finished") {
      throw new ForbiddenException("Ce débat est déjà terminé.");
    }

    if (row.validated_at) {
      return;
    }

    if (row.created_by !== userId) {
      throw new ForbiddenException("Seul le créateur peut démarrer le débat.");
    }

    if (!row.opponent_joined_at) {
      throw new ForbiddenException("En attente d'un second participant.");
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("debates")
      .update({
        status: "active",
        started_at: now,
        validated_at: now,
      })
      .eq("id", debateId);

    if (updateError) {
      throw new ForbiddenException(`Impossible de démarrer le débat : ${updateError.message}`);
    }
  }

  async cancelExpiredDebates(): Promise<string[]> {
    const supabase = this.supabaseService.getServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("debates")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .is("validated_at", null)
      .lt("expires_at", now)
      .select("id");

    if (error) {
      this.logger.warn(`Annulation débats expirés : ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => castSupabaseRow<{ id: string }>(row).id);
  }

  async cancelPendingDebate(debateId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    await supabase
      .from("debates")
      .update({ status: "cancelled" })
      .eq("id", debateId)
      .eq("status", "pending");
  }

  /** Persistance DB uniquement — appeler assertCanRequestResume avant. */
  async requestResumeDebate(debateId: string, _userId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const now = new Date().toISOString();
    type ResumeRequestUpdate = Partial<Pick<DebateRow, "resume_requested_at">>;
    const attempts: ResumeRequestUpdate[] = [{ resume_requested_at: now }, {}];

    for (const payload of attempts) {
      const { error } = await supabase.from("debates").update(payload).eq("id", debateId);
      if (!error) return;
      if (!isMissingPauseMigrationColumnError(error)) {
        throw new ForbiddenException(`Impossible de demander la reprise : ${error.message}`);
      }
    }

    this.logger.warn(
      `Demande reprise ${debateId} : persistance DB partielle (migrations 00008/00009).`,
    );
  }

  /** Persistance DB uniquement — appeler assertCanValidateResume avant. */
  async validateResumeDebate(debateId: string, _userId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    type ResumeValidateUpdate = Partial<
      Pick<
        DebateRow,
        "status" | "paused_by_user_id" | "paused_at" | "resume_requested_at"
      >
    >;
    const attempts: ResumeValidateUpdate[] = [
      {
        status: "active",
        paused_by_user_id: null,
        paused_at: null,
        resume_requested_at: null,
      },
      {
        status: "active",
        resume_requested_at: null,
      },
      { status: "active" },
    ];

    for (const payload of attempts) {
      const { error } = await supabase.from("debates").update(payload).eq("id", debateId);
      if (!error) return;
      if (!isMissingPauseMigrationColumnError(error)) {
        throw new ForbiddenException(`Impossible de reprendre le débat : ${error.message}`);
      }
    }

    this.logger.warn(
      `Validation reprise ${debateId} : état actif en direct (migrations 00008/00009 incomplètes).`,
    );
  }
}
