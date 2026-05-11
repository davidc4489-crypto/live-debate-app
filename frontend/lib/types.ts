export type UserRole = "participantA" | "participantB" | "spectator";

export interface DebateMessage {
  id: string;
  user: string;
  text: string;
}

export interface RoomSnapshot {
  id: string;
  title: string;
  participants: number;
  spectators: number;
  messages: DebateMessage[];
  turnDuration: number;
  currentSpeaker: string | null;
  currentSpeakerName: string | null;
  turnEndsAt: number | null;
  remainingSeconds: number;
}
