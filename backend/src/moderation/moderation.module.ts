import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { MessageFlagsService } from "./message-flags.service";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";

@Module({
  imports: [SupabaseModule],
  controllers: [ModerationController],
  providers: [ModerationService, MessageFlagsService],
  exports: [ModerationService, MessageFlagsService],
})
export class ModerationModule {}
