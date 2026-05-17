import { Module } from "@nestjs/common";
import { FollowsModule } from "../follows/follows.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { DebateCreationService } from "./debate-creation.service";
import { DebatesController } from "./debates.controller";
import { DebatesService } from "./debates.service";

@Module({
  imports: [SupabaseModule, FollowsModule],
  controllers: [DebatesController],
  providers: [DebatesService, DebateCreationService],
  exports: [DebatesService, DebateCreationService],
})
export class DebatesModule {}
