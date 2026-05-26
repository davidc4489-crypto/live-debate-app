import { Global, Module } from "@nestjs/common";
import { NotificationsPushService } from "./notifications-push.service";

@Global()
@Module({
  providers: [NotificationsPushService],
  exports: [NotificationsPushService],
})
export class NotificationsModule {}
