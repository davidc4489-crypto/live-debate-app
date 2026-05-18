export type UserRole = "participantA" | "participantB" | "spectator";

export type RoomStatus = "waiting" | "active" | "finished" | "cancelled";

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
  /** userId du participant dont le tour est en pause (déconnexion temporaire) */
  pendingSpeakerUserId?: string | null;
  /** true quand 2 participants sont présents mais le créateur n'a pas encore validé */
  awaitingValidation?: boolean;
  /** true une fois le débat démarré par validation du créateur */
  debateValidated?: boolean;
  endedAt?: string | null;
}

export interface SocketSession {
  socketId: string;
  roomId: string;
  displayName: string;
  role: UserRole;
  userId?: string;
}
