import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ModerationService } from "../moderation/moderation.service";
import { buildDisplayName } from "../profiles/profile.utils";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateConclusionDto } from "./debates.types";

export const MAX_CONCLUSION_LENGTH = 3000;

interface ProfileRow {
  id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

@Injectable()
export class DebatesConclusionsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly moderationService: ModerationService,
  ) {}

  async submitConclusion(
    accessToken: string,
    debateId: string,
    content: string,
    warnAccepted = false,
  ): Promise<DebateConclusionDto> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException("La conclusion ne peut pas être vide.");
    }
    if (trimmed.length > MAX_CONCLUSION_LENGTH) {
      throw new BadRequestException(
        `La conclusion ne peut pas dépasser ${MAX_CONCLUSION_LENGTH} caractères.`,
      );
    }

    const user = await this.getUserFromToken(accessToken);
    await this.assertParticipantOnFinishedDebate(debateId, user.id);

    if (!warnAccepted) {
      const moderation = await this.moderationService.moderateText(trimmed);
      if (moderation.action === "block") {
        throw new HttpException(
          {
            message: this.moderationService.getBlockMessage(),
            code: "MODERATION_BLOCK",
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (moderation.action === "warn") {
        throw new HttpException(
          {
            message: this.moderationService.getWarnMessage(),
            code: "MODERATION_WARN",
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debate_conclusions")
      .upsert(
        {
          debate_id: debateId,
          user_id: user.id,
          content: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "debate_id,user_id" },
      )
      .select(
        `
        id,
        content,
        created_at,
        updated_at,
        user_id,
        profiles ( id, username, first_name, last_name, email )
      `,
      )
      .single();

    if (error || !data) {
      throw new ConflictException(
        error?.message || "Impossible d'enregistrer la conclusion.",
      );
    }

    return this.mapRow(data);
  }

  private async assertParticipantOnFinishedDebate(
    debateId: string,
    userId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    const { data: debate, error: debateError } = await supabase
      .from("debates")
      .select("id, status")
      .eq("id", debateId)
      .single();

    if (debateError || !debate) {
      throw new NotFoundException("Débat introuvable");
    }

    if (debate.status !== "finished") {
      throw new BadRequestException(
        "Les conclusions ne peuvent être soumises qu'une fois le débat terminé.",
      );
    }

    const { data: participant, error: partError } = await supabase
      .from("debate_participants")
      .select("id")
      .eq("debate_id", debateId)
      .eq("user_id", userId)
      .eq("role", "participant")
      .maybeSingle();

    if (partError || !participant) {
      throw new ForbiddenException(
        "Seuls les participants du débat peuvent rédiger une conclusion.",
      );
    }
  }

  private async getUserFromToken(accessToken: string): Promise<{ id: string }> {
    const supabase = this.supabaseService.getClientWithToken(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new ForbiddenException("Session invalide ou expirée");
    }
    return { id: data.user.id };
  }

  private mapRow(row: {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    profiles: ProfileRow | ProfileRow[] | null;
  }): DebateConclusionDto {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const displayName = profile
      ? buildDisplayName({
          username: profile.username,
          firstName: profile.first_name,
          lastName: profile.last_name,
          email: profile.email,
        })
      : "Participant";

    return {
      id: row.id,
      userId: row.user_id,
      displayName,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
