import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
