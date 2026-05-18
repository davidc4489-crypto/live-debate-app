import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { FollowsService } from "./follows.service";

@Controller()
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get("users/:userId/follow-stats")
  getFollowStats(
    @Param("userId") userId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.followsService.getFollowStats(userId, this.optionalBearer(authorization));
  }

  @Get("users/:userId/following")
  listFollowing(
    @Param("userId") userId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.followsService.listFollowing(userId, this.optionalBearer(authorization));
  }

  @Get("users/me/following")
  listMyFollowing(@Headers("authorization") authorization?: string) {
    return this.followsService.listMyFollowing(this.extractBearer(authorization));
  }

  @Post("users/:userId/follow")
  followUser(
    @Param("userId") userId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.followsService.followUser(this.extractBearer(authorization), userId);
  }

  @Delete("users/:userId/follow")
  unfollowUser(
    @Param("userId") userId: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.followsService.unfollowUser(this.extractBearer(authorization), userId);
  }

  @Get("users/me/notifications")
  listNotifications(@Headers("authorization") authorization?: string) {
    return this.followsService.listNotifications(this.extractBearer(authorization));
  }

  @Patch("users/me/notifications/read-all")
  markAllRead(@Headers("authorization") authorization?: string) {
    return this.followsService.markAllNotificationsRead(this.extractBearer(authorization));
  }

  @Patch("users/me/notifications/:id/read")
  markRead(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.followsService.markNotificationRead(this.extractBearer(authorization), id);
  }

  @Delete("users/me/notifications/:id")
  deleteNotification(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.followsService.deleteNotification(this.extractBearer(authorization), id);
  }

  @Delete("users/me/notifications")
  deleteAllNotifications(@Headers("authorization") authorization?: string) {
    return this.followsService.deleteAllNotifications(this.extractBearer(authorization));
  }

  private extractBearer(authorization?: string): string {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }
    const token = authorization.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }
    return token;
  }

  private optionalBearer(authorization?: string): string | undefined {
    if (!authorization?.startsWith("Bearer ")) return undefined;
    const token = authorization.slice(7).trim();
    return token || undefined;
  }
}
