import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ModerationService } from "./moderation.service";

/** Longueur maximale acceptée par le service Python (`MOD_MAX_TEXT_LENGTH`). */
const TEXT_MAX = 5_000;

class ModerateBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TEXT_MAX)
  text!: string;
}

class ModerateBatchDto {
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  @MaxLength(TEXT_MAX, { each: true })
  texts!: string[];
}

class ClassifyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TEXT_MAX)
  text!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  candidates?: string[];
}

@Controller("moderation")
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /** Endpoint de test / debug (même contrat que le microservice Python). */
  @Post("check")
  async check(@Body() body: ModerateBodyDto) {
    return this.moderationService.moderateText(body.text);
  }

  /** Modération par lot (re-scoring d'un historique, outils d'admin). */
  @Post("batch")
  async batch(@Body() body: ModerateBatchDto) {
    const results = await this.moderationService.moderateBatch(body.texts);
    return { results, count: results.length };
  }

  /** Analyse qualitative d'un message (indice d'argumentation + ton). */
  @Post("analyze")
  async analyze(@Body() body: ModerateBodyDto) {
    const analysis = await this.moderationService.analyzeText(body.text);
    return analysis ?? { available: false };
  }

  /** Classification thématique d'un sujet de débat (zero-shot). */
  @Post("classify")
  async classify(@Body() body: ClassifyDto) {
    const result = await this.moderationService.classifyTopic(body.text, body.candidates);
    return result ?? { topic: null, confidence: 0, available: false };
  }

  /** Compteurs de modération côté NestJS (actions, latence, circuit). */
  @Get("stats")
  stats() {
    return this.moderationService.getStats();
  }

  /** Disponibilité du microservice Python. */
  @Get("health")
  async health() {
    return this.moderationService.getServiceHealth();
  }
}
