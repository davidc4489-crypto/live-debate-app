import { Body, Controller, Post } from "@nestjs/common";
import { ModerationService } from "./moderation.service";

class ModerateBodyDto {
  text!: string;
}

@Controller("moderation")
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /** Endpoint de test / debug (même contrat que le microservice Python). */
  @Post("check")
  async check(@Body() body: ModerateBodyDto) {
    return this.moderationService.moderateText(body.text);
  }
}
