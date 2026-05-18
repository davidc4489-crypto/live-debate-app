export type UserRole = "participantA" | "participantB" | "spectator";

export interface DebateMessage {
  id: string;
  user: string;
  text: string;
}

export type RoomStatus = "active" | "finished";

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
}
