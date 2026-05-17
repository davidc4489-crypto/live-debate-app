import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfilesService } from "./profiles.service";

@Controller()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("interests")
  listInterests() {
    return this.profilesService.listInterests();
  }

  @Get("users/:userId/profile")
  getPublicProfile(
    @Param("userId") userId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.profilesService.getPublicProfile(userId, {
      limit: limit ? Math.min(Number(limit) || 20, 50) : 20,
      offset: offset ? Math.max(Number(offset) || 0, 0) : 0,
    });
  }

  @Patch("users/me/profile")
  updateOwnProfile(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: UpdateProfileDto,
  ) {
    return this.profilesService.updateOwnProfile(this.extractBearerToken(authorization), body);
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }

    return token;
  }
}
