import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { AuthService } from "../auth/auth.service";
import { NotificationsPushService } from "../notifications/notifications-push.service";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateCreationService } from "./debate-creation.service";
import { castSupabaseRow } from "./debate-db.types";
import { ProposedDebateListItemDto, ScheduledDebateListItemDto } from "./debates.types";
import { DebatesService } from "./debates.service";

interface DebateProposedRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  created_by: string | null;
  scheduled_at: string | null;
  interested_user_id: string | null;
  categories: { name: string } | { name: string }[] | null;
  messages: { id: string }[] | null;
  debate_participants: Array<{
    role: string;
    position: number | null;
    user_id: string;
    profiles: {
      id: string;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null;
  }> | null;
  debate_views?: { id: string }[] | null;
}

@Injectable()
export class DebateProposedService {
  private readonly logger = new Logger(DebateProposedService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
    private readonly debateCreationService: DebateCreationService,
    private readonly debatesService: DebatesService,
    private readonly notificationsPush: NotificationsPushService,
  ) {}

  async createProposed(
    accessToken: string,
    title: string,
    turnDuration: number,
  ): Promise<{ id: string; title: string; status: "proposed" }> {
    const me = await this.authService.getMe(accessToken);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new BadRequestException("Le titre du débat est requis.");
    }

    const allowed = [180, 300, 600];
    const maxTurnTime = allowed.includes(turnDuration) ? turnDuration : 180;
    const debateId = uuidv4();
    const supabase = this.supabaseService.getServiceClient();
    const categoryId = await this.debateCreationService.getDefaultCategoryId();

    const row = {
      id: debateId,
      title: trimmedTitle,
      category_id: categoryId,
      status: "proposed" as const,
      created_by: me.id,
      max_turn_time: maxTurnTime,
      max_message_length: 500,
    };

    const { error } = await supabase.from("debates").insert(row);
    if (error) {
      if (/proposed|scheduled_at|interested_user|enum/i.test(error.message)) {
        throw new BadRequestException(
          "La migration 00010 (débats proposés) n'est pas appliquée sur la base.",
        );
      }
      throw new BadRequestException(`Impossible de créer le débat : ${error.message}`);
    }

    await this.debateCreationService.registerParticipant(debateId, me.id, 1);

    return { id: debateId, title: trimmedTitle, status: "proposed" };
  }

  async listProposed(): Promise<ProposedDebateListItemDto[]> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select(
        `
        id,
        title,
        status,
        created_at,
        created_by,
        scheduled_at,
        interested_user_id,
        categories ( name ),
        messages ( id ),
        debate_participants (
          role,
          position,
          user_id,
          profiles ( id, username, first_name, last_name, email )
        ),
        debate_views ( id )
      `,
      )
      .eq("status", "proposed")
      .order("created_at", { ascending: false });

    if (error) {
      if (/proposed|enum/i.test(error.message)) {
        this.logger.warn("Statut proposed absent — liste vide.");
        return [];
      }
      throw new BadRequestException(`Impossible de charger les débats proposés : ${error.message}`);
    }

    return (data as unknown as DebateProposedRow[]).map((row) => {
      const item = this.debatesService.rowsToListItems([row as never])[0];
      return {
        ...item,
        interestedUserId: row.interested_user_id ?? null,
        scheduledAt: row.scheduled_at ?? null,
      };
    });
  }

  async listScheduled(): Promise<ScheduledDebateListItemDto[]> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select(
        `
        id,
        title,
        status,
        created_at,
        created_by,
        scheduled_at,
        interested_user_id,
        categories ( name ),
        messages ( id ),
        debate_participants (
          role,
          position,
          user_id,
          profiles ( id, username, first_name, last_name, email )
        ),
        debate_views ( id )
      `,
      )
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: true });

    if (error) {
      if (/scheduled|enum/i.test(error.message)) {
        this.logger.warn("Statut scheduled absent — liste vide.");
        return [];
      }
      throw new BadRequestException(
        `Impossible de charger les débats planifiés : ${error.message}`,
      );
    }

    return (data as unknown as DebateProposedRow[])
      .filter((row) => row.scheduled_at)
      .map((row) => {
        const item = this.debatesService.rowsToListItems([row as never])[0];
        return {
          ...item,
          interestedUserId: row.interested_user_id ?? null,
          scheduledAt: row.scheduled_at as string,
        };
      });
  }

  async expressInterest(accessToken: string, debateId: string): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data: debate, error: fetchError } = await supabase
      .from("debates")
      .select("id, status, created_by, interested_user_id, title")
      .eq("id", debateId)
      .maybeSingle();

    if (fetchError || !debate) {
      throw new NotFoundException("Débat introuvable.");
    }

    const row = castSupabaseRow<{
      id: string;
      status: string;
      created_by: string | null;
      interested_user_id: string | null;
      title: string;
    }>(debate);

    if (row.status !== "proposed") {
      throw new BadRequestException("Ce débat n'accepte plus de candidatures.");
    }

    if (row.created_by === me.id) {
      throw new BadRequestException("Vous ne pouvez pas vous proposer sur votre propre débat.");
    }

    if (row.interested_user_id) {
      throw new BadRequestException("Un participant s'est déjà proposé pour ce débat.");
    }

    const { data: updated, error: updateError } = await supabase
      .from("debates")
      .update({ interested_user_id: me.id })
      .eq("id", debateId)
      .eq("status", "proposed")
      .is("interested_user_id", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      throw new BadRequestException("Impossible d'enregistrer votre candidature.");
    }

    await this.debateCreationService.registerParticipant(debateId, me.id, 2);

    const displayName = await this.debateCreationService.getProfileDisplayName(me.id);
    if (row.created_by) {
      await this.insertNotification({
        userId: row.created_by,
        type: "debate_interest",
        actorId: me.id,
        debateId,
        title: "Nouveau participant intéressé",
        message: `${displayName} souhaite participer à votre débat « ${row.title} ». Proposez une date pour planifier.`,
      });
      this.notificationsPush.notifyUser(row.created_by);
    }

    return { success: true };
  }

  async rejectInterest(accessToken: string, debateId: string): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data: debate, error: fetchError } = await supabase
      .from("debates")
      .select("id, status, created_by, interested_user_id, title")
      .eq("id", debateId)
      .maybeSingle();

    if (fetchError || !debate) {
      throw new NotFoundException("Débat introuvable.");
    }

    const row = castSupabaseRow<{
      id: string;
      status: string;
      created_by: string | null;
      interested_user_id: string | null;
      title: string;
    }>(debate);

    if (row.created_by !== me.id) {
      throw new ForbiddenException("Seul le créateur peut refuser une candidature.");
    }

    if (row.status !== "proposed") {
      throw new BadRequestException("Ce débat n'accepte plus de refus de candidature.");
    }

    if (!row.interested_user_id) {
      throw new BadRequestException("Aucun participant en attente à refuser.");
    }

    const rejectedUserId = row.interested_user_id;
    const creatorName = await this.debateCreationService.getProfileDisplayName(me.id);

    const { data: updated, error: updateError } = await supabase
      .from("debates")
      .update({ interested_user_id: null })
      .eq("id", debateId)
      .eq("status", "proposed")
      .eq("interested_user_id", rejectedUserId)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      throw new BadRequestException("Impossible de refuser cette candidature.");
    }

    await supabase
      .from("debate_participants")
      .delete()
      .eq("debate_id", debateId)
      .eq("user_id", rejectedUserId)
      .eq("role", "participant");

    await supabase
      .from("debate_schedule_proposals")
      .update({ status: "superseded" })
      .eq("debate_id", debateId)
      .eq("status", "pending");

    await this.insertNotification({
      userId: rejectedUserId,
      type: "debate_interest_rejected",
      actorId: me.id,
      debateId,
      title: "Candidature refusée",
      message: `${creatorName} a repoussé votre proposition de participer au débat « ${row.title} ».`,
    });
    this.notificationsPush.notifyUser(rejectedUserId);

    return { success: true };
  }

  async insertNotification(payload: {
    userId: string;
    type: string;
    actorId: string;
    debateId: string;
    title: string;
    message: string;
  }): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase.from("notifications").insert({
      user_id: payload.userId,
      type: payload.type,
      actor_id: payload.actorId,
      debate_id: payload.debateId,
      room_id: payload.debateId,
      title: payload.title,
      message: payload.message,
    });
    if (error) {
      this.logger.warn(`Notification non envoyée : ${error.message}`);
    }
  }
}
