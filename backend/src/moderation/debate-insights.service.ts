import { Injectable } from "@nestjs/common";
import { ModerationService } from "./moderation.service";
import { MessageAnalysis, ModerationResult } from "./moderation.types";

export interface AuthorInsight {
  messageId: string;
  qualityScore: number;
  qualityLabel: string;
  tips: string[];
  signals: string[];
  sentiment: { label: string; score: number } | null;
}

export interface RoomInsight {
  roomId: string;
  /** Moyenne glissante de la qualité argumentative des messages du débat (0-100). */
  qualityScore: number;
  /** Indice de civilité du débat (0-100) : 100 = aucun signal toxique. */
  civilityScore: number;
  messagesAnalyzed: number;
  /** Tendance sur les 5 derniers messages par rapport aux précédents. */
  trend: "up" | "down" | "stable";
}

interface RoomState {
  qualityScores: number[];
  toxicityScores: number[];
}

const WINDOW = 20;
const RECENT = 5;

/**
 * Agrège la qualité et la civilité d'un débat à partir des analyses de messages.
 *
 * Volontairement en mémoire et hors du chemin critique : si le service Python
 * est indisponible, le débat continue simplement sans indicateurs.
 */
@Injectable()
export class DebateInsightsService {
  private readonly rooms = new Map<string, RoomState>();

  constructor(private readonly moderationService: ModerationService) {}

  async analyzeMessage(
    roomId: string,
    messageId: string,
    text: string,
    moderation: ModerationResult,
  ): Promise<{ qualityScore: number; forAuthor: AuthorInsight; forRoom: RoomInsight } | null> {
    const analysis: MessageAnalysis | null = await this.moderationService.analyzeText(text);
    if (!analysis) return null;

    const state = this.rooms.get(roomId) ?? { qualityScores: [], toxicityScores: [] };
    state.qualityScores.push(analysis.quality_score);
    state.toxicityScores.push(moderation.severity ?? moderation.toxicity);
    if (state.qualityScores.length > WINDOW) state.qualityScores.shift();
    if (state.toxicityScores.length > WINDOW) state.toxicityScores.shift();
    this.rooms.set(roomId, state);

    return {
      qualityScore: analysis.quality_score,
      forAuthor: {
        messageId,
        qualityScore: analysis.quality_score,
        qualityLabel: analysis.quality_label,
        tips: analysis.tips,
        signals: analysis.breakdown.signals,
        sentiment: analysis.sentiment,
      },
      forRoom: this.buildRoomInsight(roomId, state),
    };
  }

  getRoomInsight(roomId: string): RoomInsight | null {
    const state = this.rooms.get(roomId);
    if (!state || state.qualityScores.length === 0) return null;
    return this.buildRoomInsight(roomId, state);
  }

  forgetRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  private buildRoomInsight(roomId: string, state: RoomState): RoomInsight {
    const quality = this.average(state.qualityScores);
    const toxicity = this.average(state.toxicityScores);

    const recent = state.qualityScores.slice(-RECENT);
    const previous = state.qualityScores.slice(0, -RECENT);
    let trend: RoomInsight["trend"] = "stable";
    if (previous.length >= RECENT) {
      const delta = this.average(recent) - this.average(previous);
      if (delta >= 5) trend = "up";
      else if (delta <= -5) trend = "down";
    }

    return {
      roomId,
      qualityScore: Math.round(quality),
      civilityScore: Math.round(Math.max(0, 100 - toxicity * 100)),
      messagesAnalyzed: state.qualityScores.length,
      trend,
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}
