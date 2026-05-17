import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FollowsModule } from "../follows/follows.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [SupabaseModule, AuthModule, FollowsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
