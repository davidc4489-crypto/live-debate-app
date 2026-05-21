export type UserRole = "participantA" | "participantB" | "spectator";

export type RoomStatus = "waiting" | "active" | "finished" | "cancelled" | "paused";

export interface ParticipantSlot {
  userId: string;
  displayName: string;
  role: "participantA" | "participantB";
  socketId: string | null;
}

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
  pausedByUserId?: string | null;
  pausedByDisplayName?: string | null;
  endedByUserId?: string | null;
  absentParticipantUserId?: string | null;
  absentParticipantDisplayName?: string | null;
  participantSlots?: [ParticipantSlot | null, ParticipantSlot | null];
  resumeRequestedAt?: string | null;
  /** userId du participant qui avait la parole à la pause */
  turnUserId?: string | null;
}

export interface SocketSession {
  socketId: string;
  roomId: string;
  displayName: string;
  role: UserRole;
  userId?: string;
}
