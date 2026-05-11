import { Module } from "@nestjs/common";
import { DebateGateway } from "./debate.gateway";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [],
  controllers: [RoomsController],
  providers: [RoomsService, DebateGateway],
})
export class AppModule {}
