export type UserRole = "participantA" | "participantB" | "spectator";

export type RoomStatus = "active" | "finished";

export interface DebateMessage {
  id: string;
  user: string;
  text: string;
  userId?: string | null;
}

export interface RoomState {
  id: string;
  title: string;
  status: RoomStatus;
  creatorUserId?: string;
  participants: string[];
  spectators: string[];
  messages: DebateMessage[];
  turnDuration: number;
  currentSpeaker: string | null;
  turnEndsAt: number | null;
  endedAt?: string | null;
}

export interface SocketSession {
  socketId: string;
  roomId: string;
  displayName: string;
  role: UserRole;
  userId?: string;
}
