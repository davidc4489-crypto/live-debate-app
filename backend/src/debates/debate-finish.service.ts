import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { buildDisplayName } from "../profiles/profile.utils";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateMessage, RoomState, SocketSession } from "../types";

interface ProfileRow {
  id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

@Injectable()
export class DebateFinishService {
  private readonly logger = new Logger(DebateFinishService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfileDisplayName(userId: string): Promise<string> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, username, first_name, last_name")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return "Utilisateur";
    }

    const row = data as ProfileRow;
    return buildDisplayName({
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
    });
  }

  async markDebateActive(debateId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase
      .from("debates")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", debateId)
      .eq("status", "pending");

    if (error) {
      this.logger.warn(`Activation débat ${debateId} : ${error.message}`);
    }
  }

  async finishDebate(
    debateId: string,
    room: RoomState,
    sessions: SocketSession[],
  ): Promise<{ endedAt: string }> {
    const supabase = this.supabaseService.getServiceClient();
    const endedAt = new Date().toISOString();

    const { data: debate, error: debateError } = await supabase
      .from("debates")
      .select("id, status, created_by, started_at")
      .eq("id", debateId)
      .maybeSingle();

    if (debateError || !debate) {
      throw new NotFoundException("Débat introuvable");
    }

    if (debate.status === "finished") {
      return { endedAt };
    }

    const participantSessions = sessions.filter(
      (s) => s.role === "participantA" || s.role === "participantB",
    );

    await this.syncParticipants(debateId, participantSessions);
    await this.persistRoomMessages(debateId, room.messages, participantSessions);

    const { error: updateError } = await supabase
      .from("debates")
      .update({
        status: "finished",
        ended_at: endedAt,
        started_at: debate.started_at ?? endedAt,
        turn_user_id: null,
      })
      .eq("id", debateId);

    if (updateError) {
      throw new BadRequestException(`Impossible de clôturer le débat : ${updateError.message}`);
    }

    return { endedAt };
  }

  private async syncParticipants(
    debateId: string,
    participantSessions: SocketSession[],
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    for (const session of participantSessions) {
      if (!session.userId) continue;

      const position = session.role === "participantA" ? 1 : 2;
      const { error } = await supabase.from("debate_participants").upsert(
        {
          debate_id: debateId,
          user_id: session.userId,
          role: "participant",
          position,
        },
        { onConflict: "debate_id,user_id" },
      );

      if (error) {
        this.logger.warn(`Participant ${session.userId} : ${error.message}`);
      }
    }
  }

  async persistRoomMessages(
    debateId: string,
    messages: DebateMessage[],
    participantSessions: SocketSession[],
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    const displayToUserId = new Map<string, string>();
    for (const session of participantSessions) {
      if (session.userId) {
        displayToUserId.set(session.displayName, session.userId);
      }
    }

    let turnNumber = 0;
    for (const message of messages) {
      const userId =
        message.userId ?? displayToUserId.get(message.user) ?? participantSessions[0]?.userId;

      if (!userId) continue;

      turnNumber += 1;
      const { error } = await supabase.from("messages").upsert(
        {
          id: message.id,
          debate_id: debateId,
          user_id: userId,
          content: message.text,
          turn_number: turnNumber,
        },
        { onConflict: "id" },
      );

      if (error) {
        this.logger.warn(`Message ${message.id} : ${error.message}`);
      }
    }
  }

  assertCanEndDebate(room: RoomState, session: SocketSession): void {
    if (room.status === "finished") {
      throw new BadRequestException("Ce débat est déjà terminé.");
    }

    const isParticipant =
      session.role === "participantA" || session.role === "participantB";

    if (!isParticipant) {
      throw new ForbiddenException(
        "Seuls les participants peuvent mettre fin au débat.",
      );
    }

    if (!session.userId) {
      throw new ForbiddenException(
        "Connectez-vous pour mettre fin au débat.",
      );
    }
  }
}
