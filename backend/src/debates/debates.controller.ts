import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { DebateProposedService } from "./debate-proposed.service";
import { DebateSchedulingService } from "./debate-scheduling.service";
import { DebatesConclusionsService } from "./debates-conclusions.service";
import { DebatesService } from "./debates.service";
import { CreateProposedDebateDto } from "./dto/create-proposed-debate.dto";
import { ProposeScheduleDto } from "./dto/propose-schedule.dto";
import { RespondScheduleDto } from "./dto/respond-schedule.dto";
import { SubmitConclusionDto } from "./dto/submit-conclusion.dto";

@Controller("debates")
export class DebatesController {
  constructor(
    private readonly debatesService: DebatesService,
    private readonly conclusionsService: DebatesConclusionsService,
    private readonly debateProposedService: DebateProposedService,
    private readonly debateSchedulingService: DebateSchedulingService,
  ) {}

  @Get()
  listDebates() {
    return this.debatesService.listDebates();
  }

  @Get("proposed")
  listProposedDebates() {
    return this.debateProposedService.listProposed();
  }

  @Get("scheduled")
  listScheduledDebates() {
    return this.debateProposedService.listScheduled();
  }

  @Post("proposed")
  createProposedDebate(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateProposedDebateDto,
  ) {
    const allowed = [180, 300, 600];
    const turnDuration = allowed.includes(body.turnDuration ?? 180)
      ? (body.turnDuration as number)
      : 180;
    return this.debateProposedService.createProposed(
      this.extractBearerToken(authorization),
      body.title ?? "",
      turnDuration,
    );
  }

  @Get(":id/scheduling")
  getSchedulingState(@Param("id") id: string) {
    return this.debateSchedulingService.getSchedulingState(id);
  }

  @Post(":id/interest")
  expressInterest(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    return this.debateProposedService.expressInterest(
      this.extractBearerToken(authorization),
      id,
    );
  }

  @Post(":id/interest/reject")
  rejectInterest(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    return this.debateProposedService.rejectInterest(
      this.extractBearerToken(authorization),
      id,
    );
  }

  @Post(":id/schedule")
  proposeSchedule(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ProposeScheduleDto,
  ) {
    return this.debateSchedulingService.proposeSchedule(
      this.extractBearerToken(authorization),
      id,
      body.proposedAt ?? "",
    );
  }

  @Post(":id/schedule/respond")
  respondToSchedule(
    @Param("id") id: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: RespondScheduleDto,
  ) {
    const action = body.action ?? "accept";
    if (!["accept", "reject", "counter"].includes(action)) {
      throw new BadRequestException("Action invalide.");
    }
    return this.debateSchedulingService.respondToSchedule(
      this.extractBearerToken(authorization),
      id,
      action,
      body.proposedAt,
    );
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
