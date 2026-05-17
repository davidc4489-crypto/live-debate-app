import { Injectable, Logger } from "@nestjs/common";
import { FollowsService } from "../follows/follows.service";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class DebateCreationService {
  private readonly logger = new Logger(DebateCreationService.name);
  private defaultCategoryId: string | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
  ) {}

  async onLiveDebateCreated(
    creatorId: string,
    roomId: string,
    title: string,
    turnDuration: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    try {
      const categoryId = await this.getDefaultCategoryId();
      const { error } = await supabase.from("debates").upsert(
        {
          id: roomId,
          title,
          category_id: categoryId,
          status: "pending",
          created_by: creatorId,
          max_turn_time: turnDuration,
          max_message_length: 500,
        },
        { onConflict: "id" },
      );

      if (error) {
        this.logger.warn(`Persistance débat ignorée : ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`Persistance débat : ${err instanceof Error ? err.message : err}`);
    }

    await this.followsService.notifyFollowersNewDebate(creatorId, roomId, title);
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
