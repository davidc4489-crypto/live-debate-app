import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

@Injectable()
export class NotificationsPushService {
  private server: Server | null = null;

  registerServer(server: Server): void {
    this.server = server;
  }

  notifyUser(userId: string): void {
    this.server?.to(`user:${userId}`).emit("notificationsUpdated");
  }

  notifyUsers(userIds: string[]): void {
    const unique = [...new Set(userIds.filter(Boolean))];
    unique.forEach((id) => this.notifyUser(id));
  }
}
