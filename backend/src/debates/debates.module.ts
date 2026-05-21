import { Module } from "@nestjs/common";
import { FollowsModule } from "../follows/follows.module";
import { ModerationModule } from "../moderation/moderation.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { DebateCreationService } from "./debate-creation.service";
import { DebateFinishService } from "./debate-finish.service";
import { DebateLifecycleService } from "./debate-lifecycle.service";
import { DebatePresenceService } from "./debate-presence.service";
import { DebateRestoreService } from "./debate-restore.service";
import { DebatesConclusionsService } from "./debates-conclusions.service";
import { DebatesController } from "./debates.controller";
import { DebatesService } from "./debates.service";

@Module({
  imports: [SupabaseModule, FollowsModule, ModerationModule],
  controllers: [DebatesController],
  providers: [
    DebatesService,
    DebateCreationService,
    DebateFinishService,
    DebateLifecycleService,
    DebateRestoreService,
    DebatePresenceService,
    DebatesConclusionsService,
  ],
  exports: [
    DebatesService,
    DebateCreationService,
    DebateFinishService,
    DebateLifecycleService,
    DebateRestoreService,
    DebatePresenceService,
    DebatesConclusionsService,
  ],
})
export class DebatesModule {}
