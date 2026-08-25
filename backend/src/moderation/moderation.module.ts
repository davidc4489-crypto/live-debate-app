import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { MessageFlagsService } from "./message-flags.service";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { SpamGuard } from "./spam-guard";
import { DebateInsightsService } from "./debate-insights.service";

@Module({
  imports: [SupabaseModule],
  controllers: [ModerationController],
  providers: [ModerationService, MessageFlagsService, SpamGuard, DebateInsightsService],
  exports: [ModerationService, MessageFlagsService, SpamGuard, DebateInsightsService],
})
export class ModerationModule {}
