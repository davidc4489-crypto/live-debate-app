import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { DebatesController } from "./debates.controller";
import { DebatesService } from "./debates.service";

@Module({
  imports: [SupabaseModule],
  controllers: [DebatesController],
  providers: [DebatesService],
})
export class DebatesModule {}
