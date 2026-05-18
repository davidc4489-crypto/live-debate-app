import { Injectable, Logger } from "@nestjs/common";
import { buildDisplayName } from "../profiles/profile.utils";
import { FollowsService } from "../follows/follows.service";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateLifecycleService } from "./debate-lifecycle.service";

@Injectable()
export class DebateCreationService {
  private readonly logger = new Logger(DebateCreationService.name);
  private defaultCategoryId: string | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
    private readonly debateLifecycleService: DebateLifecycleService,
  ) {}

  async onLiveDebateCreated(
    creatorId: string,
    roomId: string,
    title: string,
    turnDuration: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const categoryId = await this.getDefaultCategoryId();

    const baseRow = {
      id: roomId,
      title,
      category_id: categoryId,
      status: "pending" as const,
      created_by: creatorId,
      max_turn_time: turnDuration,
      max_message_length: 500,
    };

    const withExpiry = {
      ...baseRow,
      expires_at: this.debateLifecycleService.getExpiresAtIso(),
    };

    let insertError = (
      await supabase.from("debates").upsert(withExpiry, { onConflict: "id" })
    ).error;

    if (
      insertError &&
      /expires_at|validated_at|opponent_joined_at|column/i.test(insertError.message)
    ) {
      this.logger.warn(
        `Colonne lifecycle absente — persistance sans expiration. Appliquez la migration 00007.`,
      );
      insertError = (
        await supabase.from("debates").upsert(baseRow, { onConflict: "id" })
      ).error;
    }

    if (insertError) {
      this.logger.error(`Échec persistance débat ${roomId} : ${insertError.message}`);
      throw new Error(insertError.message);
    }

    await this.registerParticipant(roomId, creatorId, 1);
    await this.followsService.notifyFollowersNewDebate(creatorId, roomId, title);
  }

  async registerParticipant(
    debateId: string,
    userId: string,
    position: 1 | 2,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase.from("debate_participants").upsert(
      {
        debate_id: debateId,
        user_id: userId,
        role: "participant",
        position,
      },
      { onConflict: "debate_id,user_id" },
    );

    if (error) {
      this.logger.warn(
        `Participant ${userId} (pos ${position}) sur ${debateId} : ${error.message}`,
      );
    }
  }

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

    return buildDisplayName({
      username: data.username,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
    });
  }

  private async getDefaultCategoryId(): Promise<string> {
    if (this.defaultCategoryId) return this.defaultCategoryId;

    const supabase = this.supabaseService.getServiceClient();
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "general")
      .maybeSingle();

    if (existing?.id) {
      this.defaultCategoryId = existing.id;
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name: "Général", slug: "general" })
      .select("id")
      .single();

    if (error || !created) {
      throw new Error(`Catégorie par défaut introuvable : ${error?.message}`);
    }

    this.defaultCategoryId = created.id;
    return created.id;
  }
}
