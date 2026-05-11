export type UserRole = "participantA" | "participantB" | "spectator";

export interface DebateMessage {
  id: string;
  user: string;
  text: string;
}

export interface RoomState {
  id: string;
  title: string;
  participants: string[];
  spectators: string[];
  messages: DebateMessage[];
  turnDuration: number;
  currentSpeaker: string | null;
  turnEndsAt: number | null;
}

export interface SocketSession {
  socketId: string;
  roomId: string;
  displayName: string;
  role: UserRole;
}
