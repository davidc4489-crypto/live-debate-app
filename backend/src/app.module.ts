import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { DebatesModule } from "./debates/debates.module";
import { ModerationModule } from "./moderation/moderation.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { FollowsModule } from "./follows/follows.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { NotesModule } from "./notes/notes.module";
import { DebateGateway } from "./debate.gateway";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { SupabaseModule } from "./supabase/supabase.module";

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    DebatesModule,
    NotesModule,
    FavoritesModule,
    FollowsModule,
    ProfilesModule,
    ModerationModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, DebateGateway],
})
export class AppModule {}
