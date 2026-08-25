import { Module } from "@nestjs/common";
import { RateLimitGuard } from "../common/rate-limit.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, RateLimitGuard],
  exports: [AuthService],
})
export class AuthModule {}
