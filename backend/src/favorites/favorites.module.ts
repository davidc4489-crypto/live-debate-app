import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DebatesModule } from "../debates/debates.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  imports: [SupabaseModule, AuthModule, DebatesModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
