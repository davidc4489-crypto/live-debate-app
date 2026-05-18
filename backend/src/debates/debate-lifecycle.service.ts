import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { FollowsService } from "../follows/follows.service";
import { SupabaseService } from "../supabase/supabase.service";

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

    if (debate.status === "cancelled") {
      throw new ForbiddenException("Ce débat a été annulé.");
    }

    if (debate.status === "finished") {
      throw new ForbiddenException("Ce débat est déjà terminé.");
    }

    if (debate.validated_at) {
      return;
    }

    if (debate.created_by !== userId) {
      throw new ForbiddenException("Seul le créateur peut démarrer le débat.");
    }

    if (!debate.opponent_joined_at) {
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
      .is("opponent_joined_at", null)
      .lt("expires_at", now)
      .select("id");

    if (error) {
      this.logger.warn(`Annulation débats expirés : ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => row.id as string);
  }

  async getDebateMeta(debateId: string): Promise<{
    status: string;
    createdBy: string | null;
    validatedAt: string | null;
    opponentJoinedAt: string | null;
    expiresAt: string | null;
  } | null> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select("status, created_by, validated_at, opponent_joined_at, expires_at")
      .eq("id", debateId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      status: data.status as string,
      createdBy: data.created_by as string | null,
      validatedAt: data.validated_at as string | null,
      opponentJoinedAt: data.opponent_joined_at as string | null,
      expiresAt: data.expires_at as string | null,
    };
  }
}
