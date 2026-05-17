import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { ModerationResult } from "./moderation.types";

@Injectable()
export class MessageFlagsService {
  private readonly logger = new Logger(MessageFlagsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Persiste le flag si le message existe en base (débats Supabase).
   * Les messages socket-only sont ignorés silencieusement.
   */
  async saveFlag(messageId: string, result: ModerationResult): Promise<void> {
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

    const { error } = await supabase.from("message_flags").upsert(
      {
        message_id: messageId,
        toxicity_score: result.toxicity,
        is_blocked: result.action === "block",
        reason,
        reviewed_at: result.action === "allow" ? new Date().toISOString() : null,
      },
      { onConflict: "message_id" },
    );

    if (error) {
      this.logger.warn(`message_flags insert failed: ${error.message}`);
    }
  }
}
