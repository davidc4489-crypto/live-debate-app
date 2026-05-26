import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { NotificationsPushService } from "../notifications/notifications-push.service";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateCreationService } from "./debate-creation.service";
import { DebateLifecycleService } from "./debate-lifecycle.service";
import { castSupabaseRow, DebateScheduleProposalRow } from "./debate-db.types";
import { DebateProposedService } from "./debate-proposed.service";
import {
  DebateSchedulingStateDto,
  DebateScheduleProposalDto,
} from "./debates.types";

interface DebateSchedulingRow {
  id: string;
  title: string;
  status: string;
  created_by: string | null;
  interested_user_id: string | null;
  scheduled_at: string | null;
}

const MIN_SCHEDULE_LEAD_MS = 30 * 60 * 1000;

@Injectable()
export class DebateSchedulingService {
  private readonly logger = new Logger(DebateSchedulingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
    private readonly debateCreationService: DebateCreationService,
    private readonly debateLifecycleService: DebateLifecycleService,
    private readonly debateProposedService: DebateProposedService,
    private readonly notificationsPush: NotificationsPushService,
  ) {}

  async getSchedulingState(debateId: string): Promise<DebateSchedulingStateDto> {
    const debate = await this.loadDebate(debateId);
    const proposals = await this.loadProposals(debateId);

    return {
      debateId: debate.id,
      status: debate.status as DebateSchedulingStateDto["status"],
      scheduledAt: debate.scheduled_at ?? null,
      interestedUserId: debate.interested_user_id ?? null,
      createdBy: debate.created_by ?? null,
      pendingProposal: proposals.find((p) => p.status === "pending") ?? null,
      proposals,
    };
  }

  async proposeSchedule(
    accessToken: string,
    debateId: string,
    proposedAtIso: string,
  ): Promise<DebateScheduleProposalDto> {
    const me = await this.authService.getMe(accessToken);
    const debate = await this.loadDebate(debateId);
    const proposedAt = this.parseFutureDate(proposedAtIso);

    this.assertCanNegotiate(debate, me.id);

    const pending = await this.getPendingProposal(debateId);
    if (pending) {
      if (pending.proposed_by === me.id) {
        throw new BadRequestException("Une proposition de votre part est déjà en attente.");
      }
      await this.supersedeProposal(pending.id);
    } else if (!debate.interested_user_id) {
      throw new BadRequestException("En attente qu'un participant se propose.");
    } else if (debate.created_by !== me.id) {
      throw new ForbiddenException("Le créateur doit proposer la première date.");
    }

    const proposal = await this.insertProposal(debateId, me.id, proposedAt);
    const targetId = this.otherPartyId(debate, me.id);
    if (targetId) {
      const name = await this.debateCreationService.getProfileDisplayName(me.id);
      const formatted = this.formatDateFr(proposedAt);
      await this.debateProposedService.insertNotification({
        userId: targetId,
        type: pending ? "schedule_counter" : "schedule_proposed",
        actorId: me.id,
        debateId,
        title: "Proposition de date",
        message: `${name} propose le débat le ${formatted}.`,
      });
      this.notificationsPush.notifyUser(targetId);
    }

    return proposal;
  }

  async respondToSchedule(
    accessToken: string,
    debateId: string,
    action: "accept" | "reject" | "counter",
    counterAtIso?: string,
  ): Promise<{ status: string; scheduledAt?: string; proposal?: DebateScheduleProposalDto }> {
    const me = await this.authService.getMe(accessToken);
    const debate = await this.loadDebate(debateId);
    const pending = await this.getPendingProposal(debateId);

    if (!pending) {
      throw new BadRequestException("Aucune proposition de date en attente.");
    }

    if (pending.proposed_by === me.id) {
      throw new ForbiddenException("Vous ne pouvez pas répondre à votre propre proposition.");
    }

    this.assertParticipant(debate, me.id);

    if (action === "accept") {
      await this.markProposal(pending.id, "accepted");
      const supabase = this.supabaseService.getServiceClient();
      const { error } = await supabase
        .from("debates")
        .update({
          status: "scheduled",
          scheduled_at: pending.proposed_at,
        })
        .eq("id", debateId);

      if (error) {
        throw new BadRequestException(`Impossible de confirmer la date : ${error.message}`);
      }

      const formatted = this.formatDateFr(pending.proposed_at);
      const notifyIds = [debate.created_by, debate.interested_user_id].filter(
        (id): id is string => Boolean(id),
      );
      for (const userId of notifyIds) {
        await this.debateProposedService.insertNotification({
          userId,
          type: "schedule_accepted",
          actorId: me.id,
          debateId,
          title: "Date confirmée",
          message: `Le débat « ${debate.title} » est planifié le ${formatted}.`,
        });
      }
      this.notificationsPush.notifyUsers(notifyIds);

      return { status: "scheduled", scheduledAt: pending.proposed_at };
    }

    if (action === "reject") {
      await this.markProposal(pending.id, "rejected");
      const name = await this.debateCreationService.getProfileDisplayName(me.id);
      await this.debateProposedService.insertNotification({
        userId: pending.proposed_by,
        type: "schedule_proposed",
        actorId: me.id,
        debateId,
        title: "Proposition refusée",
        message: `${name} a refusé la date proposée pour « ${debate.title} ».`,
      });
      this.notificationsPush.notifyUser(pending.proposed_by);
      return { status: "proposed" };
    }

    if (action === "counter") {
      const counterAt = this.parseFutureDate(counterAtIso ?? "");
      await this.markProposal(pending.id, "superseded");
      const proposal = await this.insertProposal(debateId, me.id, counterAt);
      const targetId = pending.proposed_by;
      const name = await this.debateCreationService.getProfileDisplayName(me.id);
      const formatted = this.formatDateFr(counterAt);
      await this.debateProposedService.insertNotification({
        userId: targetId,
        type: "schedule_counter",
        actorId: me.id,
        debateId,
        title: "Contre-proposition de date",
        message: `${name} propose plutôt le ${formatted} pour « ${debate.title} ».`,
      });
      this.notificationsPush.notifyUser(targetId);
      return { status: "proposed", proposal };
    }

    throw new BadRequestException("Action invalide.");
  }

  /** Débats planifiés dont l'heure est passée — à activer (room live). */
  async findDebatesToActivate(): Promise<
    Array<{
      id: string;
      title: string;
      created_by: string;
      interested_user_id: string;
      max_turn_time: number;
    }>
  > {
    const supabase = this.supabaseService.getServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("debates")
      .select("id, title, created_by, interested_user_id, max_turn_time")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (error) {
      if (/scheduled|enum/i.test(error.message)) {
        return [];
      }
      this.logger.warn(`Recherche débats à activer : ${error.message}`);
      return [];
    }

    return (data ?? [])
      .filter(
        (row) =>
          row.created_by &&
          row.interested_user_id &&
          [180, 300, 600].includes(row.max_turn_time),
      )
      .map((row) =>
        castSupabaseRow<{
          id: string;
          title: string;
          created_by: string;
          interested_user_id: string;
          max_turn_time: number;
        }>(row),
      );
  }

  async markActivated(debateId: string, createdBy: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const expiresAt = this.debateLifecycleService.getExpiresAtIso();

    const { error } = await supabase
      .from("debates")
      .update({
        status: "pending",
        expires_at: expiresAt,
        turn_user_id: createdBy,
      })
      .eq("id", debateId)
      .eq("status", "scheduled");

    if (error) {
      this.logger.warn(`Activation débat ${debateId} : ${error.message}`);
    }
  }

  async notifyDebateStarting(
    debateId: string,
    title: string,
    userIds: string[],
  ): Promise<void> {
    for (const userId of userIds) {
      await this.debateProposedService.insertNotification({
        userId,
        type: "debate_scheduled_start",
        actorId: userId,
        debateId,
        title: "C'est l'heure du débat",
        message: `Le débat « ${title} » commence maintenant. Rejoignez la salle.`,
      });
    }
    this.notificationsPush.notifyUsers(userIds);
  }

  private async loadDebate(debateId: string): Promise<DebateSchedulingRow> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select("id, title, status, created_by, interested_user_id, scheduled_at")
      .eq("id", debateId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException("Débat introuvable.");
    }

    return castSupabaseRow<DebateSchedulingRow>(data);
  }

  private async loadProposals(debateId: string): Promise<DebateScheduleProposalDto[]> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debate_schedule_proposals")
      .select("id, proposed_by, proposed_at, status, created_at")
      .eq("debate_id", debateId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      if (/debate_schedule_proposals/i.test(error.message)) {
        return [];
      }
      return [];
    }

    return (data as DebateScheduleProposalRow[]).map((row) => this.toProposalDto(row));
  }

  private async getPendingProposal(
    debateId: string,
  ): Promise<DebateScheduleProposalRow | null> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debate_schedule_proposals")
      .select("id, debate_id, proposed_by, proposed_at, status, created_at")
      .eq("debate_id", debateId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return castSupabaseRow<DebateScheduleProposalRow>(data);
  }

  private async insertProposal(
    debateId: string,
    userId: string,
    proposedAt: string,
  ): Promise<DebateScheduleProposalDto> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debate_schedule_proposals")
      .insert({
        debate_id: debateId,
        proposed_by: userId,
        proposed_at: proposedAt,
        status: "pending",
      })
      .select("id, proposed_by, proposed_at, status, created_at")
      .single();

    if (error) {
      throw new BadRequestException(`Impossible d'enregistrer la proposition : ${error.message}`);
    }

    return this.toProposalDto(castSupabaseRow<DebateScheduleProposalRow>(data));
  }

  private async markProposal(
    id: string,
    status: "accepted" | "rejected" | "superseded",
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    await supabase.from("debate_schedule_proposals").update({ status }).eq("id", id);
  }

  private async supersedeProposal(id: string): Promise<void> {
    await this.markProposal(id, "superseded");
  }

  private assertCanNegotiate(debate: DebateSchedulingRow, userId: string): void {
    if (debate.status !== "proposed") {
      throw new BadRequestException("La planification n'est plus possible pour ce débat.");
    }
    this.assertParticipant(debate, userId);
  }

  private assertParticipant(debate: DebateSchedulingRow, userId: string): void {
    const isCreator = debate.created_by === userId;
    const isInterested = debate.interested_user_id === userId;
    if (!isCreator && !isInterested) {
      throw new ForbiddenException("Vous n'êtes pas participant à ce débat.");
    }
  }

  private otherPartyId(debate: DebateSchedulingRow, userId: string): string | null {
    if (debate.created_by === userId) return debate.interested_user_id;
    if (debate.interested_user_id === userId) return debate.created_by;
    return null;
  }

  private parseFutureDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Date invalide.");
    }
    if (date.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) {
      throw new BadRequestException("La date doit être au moins 30 minutes dans le futur.");
    }
    return date.toISOString();
  }

  private formatDateFr(iso: string): string {
    return new Date(iso).toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private toProposalDto(row: DebateScheduleProposalRow): DebateScheduleProposalDto {
    return {
      id: row.id,
      proposedBy: row.proposed_by,
      proposedAt: row.proposed_at,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
