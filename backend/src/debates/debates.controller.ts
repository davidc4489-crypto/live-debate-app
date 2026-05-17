import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { DebatesConclusionsService } from "./debates-conclusions.service";
import { DebatesService } from "./debates.service";
import { SubmitConclusionDto } from "./dto/submit-conclusion.dto";

@Controller("debates")
export class DebatesController {
  constructor(
    private readonly debatesService: DebatesService,
    private readonly conclusionsService: DebatesConclusionsService,
  ) {}

  @Get()
  listDebates() {
    return this.debatesService.listDebates();
  }

  @Get(":id")
  getDebate(@Param("id") id: string) {
    return this.debatesService.getDebateById(id);
  }

  @Post(":id/conclusions")
  submitConclusion(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: SubmitConclusionDto,
  ) {
    return this.conclusionsService.submitConclusion(
      this.extractBearerToken(authorization),
      id,
      body.content ?? "",
      Boolean(body.confirmWarn),
    );
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authorization Bearer requis");
    }
    return authorization.slice(7).trim();
  }
}
