import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { ModerationResult } from "./moderation.types";

@Injectable()
export class MessageFlagsService {
  private readonly logger = new Logger(MessageFlagsService.name);
  /** Passe en mode "colonnes v1" si la migration 00014 n'est pas appliquée. */
  private legacySchema = false;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Persiste le flag si le message existe en base (débats Supabase).
   * Les messages socket-only sont ignorés silencieusement.
   */
  async saveFlag(
    messageId: string,
    result: ModerationResult,
    qualityScore?: number | null,
  ): Promise<void> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

    const supabase = this.supabaseService.getServiceClient();

    const { data: message } = await supabase
      .from("messages")
      .select("id")
      .eq("id", messageId)
      .maybeSingle();

    if (!message) {
      return;
    }

    const reason =
      result.reason ??
      JSON.stringify({
        insult: result.insult,
        threat: result.threat,
        identity_hate: result.identity_hate,
        source: result.source,
      });

    const base = {
      message_id: messageId,
      toxicity_score: result.toxicity,
      is_blocked: result.action === "block",
      reason,
      reviewed_at: result.action === "allow" ? new Date().toISOString() : null,
    };

    const enriched = {
      ...base,
      action: result.action,
      categories: result.categories ?? [],
      severity: result.severity ?? 0,
      language: result.language ?? null,
      models: result.models ?? [result.source],
      quality_score: qualityScore ?? null,
    };

    const payload = this.legacySchema ? base : enriched;
    const { error } = await supabase
      .from("message_flags")
      .upsert(payload, { onConflict: "message_id" });

    if (!error) return;

    // Migration 00014 absente : on retombe une fois sur le schéma d'origine.
    if (!this.legacySchema && /column .* does not exist|schema cache/i.test(error.message)) {
      this.legacySchema = true;
      this.logger.warn(
        "message_flags : colonnes v2 absentes (migration 00014_moderation_v2.sql non appliquée) — repli sur le schéma v1",
      );
      const retry = await supabase
        .from("message_flags")
        .upsert(base, { onConflict: "message_id" });
      if (retry.error) {
        this.logger.warn(`message_flags insert failed: ${retry.error.message}`);
      }
      return;
    }

    this.logger.warn(`message_flags insert failed: ${error.message}`);
  }
}
