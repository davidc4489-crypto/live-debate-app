import type {
  DebatePresenceEvent,
  DebatePresenceKind,
} from "../../shared/debate-presence";

export type { DebatePresenceKind };

export type UserRole = "participantA" | "participantB" | "spectator";

export interface DebateMessage {
  id: string;
  user: string;
  text: string;
}

export type RoomStatus = "waiting" | "active" | "finished" | "cancelled" | "paused";

export interface RoomParticipantSlot {
  userId: string | null;
  displayName: string;
  position: 1 | 2;
}

export interface RoomSnapshot {
  id: string;
  title: string;
  status: RoomStatus;
  endedAt: string | null;
  participants: number;
  spectators: number;
  participantRoster?: RoomParticipantSlot[];
  messages: DebateMessage[];
  turnDuration: number;
  currentSpeaker: string | null;
  currentSpeakerName: string | null;
  turnEndsAt: number | null;
  remainingSeconds: number;
  awaitingValidation?: boolean;
  debateValidated?: boolean;
  creatorUserId?: string | null;
  pausedByUserId?: string | null;
  pausedByDisplayName?: string | null;
  resumeRequestedAt?: string | null;
  absentParticipantUserId?: string | null;
  absentParticipantDisplayName?: string | null;
}

export interface DebatePresencePayload extends DebatePresenceEvent {
  roomId: string;
  snapshot?: RoomSnapshot | null;
}
