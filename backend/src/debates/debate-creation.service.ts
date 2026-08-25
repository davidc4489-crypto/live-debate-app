import { Injectable, Logger } from "@nestjs/common";
import { buildDisplayName } from "../profiles/profile.utils";
import { FollowsService } from "../follows/follows.service";
import { ModerationService } from "../moderation/moderation.service";
import { SupabaseService } from "../supabase/supabase.service";
import { DebateLifecycleService } from "./debate-lifecycle.service";

/** Thèmes proposés au classifieur zero-shot (alignés sur `frontend/lib/debate.ts`). */
const DEBATE_THEMES = [
  "Politique",
  "Technologie",
  "Sport",
  "Philosophie",
  "Société",
  "Économie",
] as const;

/** En dessous, on préfère « Général » à un thème inventé. */
const MIN_TOPIC_CONFIDENCE = Number(process.env.DEBATE_TOPIC_MIN_CONFIDENCE || 0.45);

@Injectable()
export class DebateCreationService {
  private readonly logger = new Logger(DebateCreationService.name);
  private defaultCategoryId: string | null = null;
  private readonly categoryIdsByName = new Map<string, string>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
    private readonly debateLifecycleService: DebateLifecycleService,
    private readonly moderationService: ModerationService,
  ) {}

  async onLiveDebateCreated(
    creatorId: string,
    roomId: string,
    title: string,
    turnDuration: number,
    options?: { creatorStance?: "for" | "against"; opponentMode?: "human" | "ai" },
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const categoryId = await this.getDefaultCategoryId();

    const baseRow: Record<string, unknown> = {
      id: roomId,
      title,
      category_id: categoryId,
      status: "pending" as const,
      created_by: creatorId,
      max_turn_time: turnDuration,
      max_message_length: 500,
    };

    if (options?.creatorStance) {
      baseRow.creator_stance = options.creatorStance;
    }
    if (options?.opponentMode) {
      baseRow.opponent_mode = options.opponentMode;
    }

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

    // Thème déduit du titre, hors du chemin critique de la création.
    void this.assignCategoryFromTitle(roomId, title).catch(() => undefined);
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

  /**
   * Classe le débat par thème à partir de son intitulé, **après** sa création.
   *
   * Sans ce classement, tous les débats atterrissaient dans « Général » et les
   * filtres par thème de l'accueil et de l'exploration ne servaient à rien.
   * L'inférence zero-shot coûte ~3 s sur CPU : elle tourne donc hors du chemin
   * critique, et le thème est mis à jour quelques secondes après la création.
   * Si le modèle est désactivé, indisponible ou hésitant, le débat reste dans
   * « Général » — la création ne dépend jamais du modèle.
   */
  async assignCategoryFromTitle(debateId: string, title: string): Promise<void> {
    const categoryId = await this.resolveCategoryId(title);
    if (!categoryId || categoryId === (await this.getDefaultCategoryId())) return;

    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase
      .from("debates")
      .update({ category_id: categoryId })
      .eq("id", debateId);

    if (error) {
      this.logger.warn(`Thème non enregistré pour ${debateId} : ${error.message}`);
    }
  }

  /** Catégorie déduite de l'intitulé, ou catégorie par défaut. */
  async resolveCategoryId(title: string): Promise<string> {
    try {
      const classification = await this.moderationService.classifyTopic(title, [
        ...DEBATE_THEMES,
      ]);

      if (
        classification?.topic &&
        classification.confidence >= MIN_TOPIC_CONFIDENCE &&
        (DEBATE_THEMES as readonly string[]).includes(classification.topic)
      ) {
        const categoryId = await this.getCategoryIdByName(classification.topic);
        if (categoryId) {
          this.logger.log(
            `Thème « ${classification.topic} » attribué automatiquement (${Math.round(
              classification.confidence * 100,
            )}%) — "${title.slice(0, 60)}"`,
          );
          return categoryId;
        }
      }
    } catch (error) {
      this.logger.debug(
        `Classification thématique indisponible : ${
          error instanceof Error ? error.message : "erreur"
        }`,
      );
    }

    return this.getDefaultCategoryId();
  }

  /** Récupère (ou crée) la catégorie portant ce nom. */
  private async getCategoryIdByName(name: string): Promise<string | null> {
    const cached = this.categoryIdsByName.get(name);
    if (cached) return cached;

    const supabase = this.supabaseService.getServiceClient();
    const slug = this.slugify(name);

    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing?.id) {
      this.categoryIdsByName.set(name, existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name, slug })
      .select("id")
      .single();

    if (error || !created) {
      this.logger.warn(`Catégorie « ${name} » indisponible : ${error?.message}`);
      return null;
    }

    this.categoryIdsByName.set(name, created.id);
    return created.id;
  }

  private slugify(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async getDefaultCategoryId(): Promise<string> {
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
