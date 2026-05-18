import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { DebateMessage, RoomState, SocketSession, UserRole } from "./types";

export const MAX_MESSAGE_LENGTH = 500;

@Injectable()
export class RoomsService {
  private readonly rooms: Record<string, RoomState> = {};
  private readonly sessions = new Map<string, SocketSession>();

  createRoom(
    title: string,
    turnDuration: 180 | 300 | 600 = 180,
    creatorUserId?: string,
  ): RoomState {
    const id = uuidv4();
    this.rooms[id] = {
      id,
      title: title.trim(),
      status: "active",
      creatorUserId,
      participants: [],
      spectators: [],
      messages: [],
      turnDuration,
      currentSpeaker: null,
      turnEndsAt: null,
    };
    return this.rooms[id];
  }

  getSessionsInRoom(roomId: string): SocketSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.roomId === roomId);
  }

  finishRoom(roomId: string, endedAt: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room) return null;
    room.status = "finished";
    room.endedAt = endedAt;
    room.currentSpeaker = null;
    room.turnEndsAt = null;
    return room;
  }

  roomExists(roomId: string): boolean {
    return Boolean(this.rooms[roomId]);
  }

  joinRoom(
    roomId: string,
    socketId: string,
    options?: { username?: string; userId?: string; displayName?: string },
  ): SocketSession {
    const room = this.rooms[roomId];
    const sanitizedName = (options?.username || "Anonymous").trim() || "Anonymous";

    let role: UserRole = "spectator";
    let displayName = options?.displayName?.trim() || sanitizedName;
    let slotAssigned = false;

    if (options?.userId) {
      const existing = this.getSessionsInRoom(roomId).find(
        (s) => s.userId === options.userId,
      );
      if (existing) {
        role = existing.role;
        displayName = existing.displayName;
        if (role === "participantA" || role === "participantB") {
          const idx = room.participants.indexOf(existing.socketId);
          if (idx >= 0) room.participants[idx] = socketId;
        } else {
          room.spectators = room.spectators.filter((id) => id !== existing.socketId);
          room.spectators.push(socketId);
        }
        this.sessions.delete(existing.socketId);
        slotAssigned = true;
      }
    }

    if (!slotAssigned) {
      if (room.participants.length < 2) {
        if (room.participants.length === 0) {
          role = "participantA";
          room.participants.push(socketId);
        } else {
          role = "participantB";
          room.participants.push(socketId);
        }
      } else {
        room.spectators.push(socketId);
        role = "spectator";
      }
    }

    const session: SocketSession = {
      socketId,
      roomId,
      displayName,
      role,
      userId: options?.userId,
    };

    this.sessions.set(socketId, session);

    if (room.participants.length === 2) {
      room.currentSpeaker = room.participants[0];
      room.turnEndsAt = Date.now() + room.turnDuration * 1000;
    } else if (room.participants.length < 2) {
      room.currentSpeaker = null;
      room.turnEndsAt = null;
    }
    return session;
  }

  getSession(socketId: string): SocketSession | undefined {
    return this.sessions.get(socketId);
  }

  sendMessage(socketId: string, text: string): { message: DebateMessage | null; error?: string } {
    const session = this.sessions.get(socketId);
    if (!session) return { message: null, error: "Session introuvable." };

    if (session.role === "spectator") {
      return { message: null, error: "Les spectateurs ne peuvent pas envoyer de message." };
    }

    const cleaned = text.trim();
    if (!cleaned) {
      return { message: null, error: "Le message ne peut pas etre vide." };
    }

    if (cleaned.length > MAX_MESSAGE_LENGTH) {
      return {
        message: null,
        error: `Le message ne peut pas depasser ${MAX_MESSAGE_LENGTH} caracteres.`,
      };
    }

    const room = this.rooms[session.roomId];
    if (!room) return { message: null, error: "Room introuvable." };

    if (room.status === "finished") {
      return { message: null, error: "Ce débat est terminé." };
    }

    if (room.participants.length < 2) {
      return {
        message: null,
        error: "En attente d'un second participant pour commencer le débat.",
      };
    }

    if (!room.currentSpeaker || room.currentSpeaker !== socketId) {
      return { message: null, error: "Ce n'est pas votre tour de parole." };
    }

    if (!room.turnEndsAt || Date.now() >= room.turnEndsAt) {
      return { message: null, error: "Le tour est termine, veuillez attendre le prochain." };
    }

    const message: DebateMessage = {
      id: uuidv4(),
      user: session.displayName,
      text: cleaned,
      userId: session.userId ?? null,
    };

    room.messages.push(message);
    return { message };
  }

  leaveRoom(socketId: string): RoomState | null {
    const session = this.sessions.get(socketId);
    if (!session) return null;

    const room = this.rooms[session.roomId];
    if (!room) {
      this.sessions.delete(socketId);
      return null;
    }

    room.participants = room.participants.filter((id) => id !== socketId);
    room.spectators = room.spectators.filter((id) => id !== socketId);
    this.sessions.delete(socketId);

    if (room.currentSpeaker === socketId) {
      this.switchTurn(room.id);
    }

    if (room.participants.length === 0 && room.spectators.length === 0) {
      delete this.rooms[room.id];
      return null;
    }

    return room;
  }

  getRoom(roomId: string): RoomState | null {
    return this.rooms[roomId] || null;
  }

  listRooms(): RoomState[] {
    return Object.values(this.rooms);
  }

  getParticipantRoster(roomId: string): Array<{
    userId: string | null;
    displayName: string;
    position: 1 | 2;
  }> {
    const room = this.rooms[roomId];
    if (!room) return [];

    const slots: Array<{
      userId: string | null;
      displayName: string;
      position: 1 | 2;
    }> = [];

    room.participants.forEach((socketId, index) => {
      const session = this.sessions.get(socketId);
      const position = (index === 0 ? 1 : 2) as 1 | 2;
      slots.push({
        userId: session?.userId ?? null,
        displayName: session?.displayName ?? "En attente d'un participant",
        position,
      });
    });

    return slots;
  }

  toPublicRoom(room: RoomState) {
    const currentSpeakerSession = room.currentSpeaker ? this.sessions.get(room.currentSpeaker) : undefined;
    const remainingSeconds = room.turnEndsAt ? Math.max(0, Math.ceil((room.turnEndsAt - Date.now()) / 1000)) : 0;
    const participantRoster = this.getParticipantRoster(room.id);

    return {
      id: room.id,
      title: room.title,
      status: room.status,
      endedAt: room.endedAt ?? null,
      participants: room.participants.length,
      spectators: room.spectators.length,
      participantRoster,
      messages: room.messages,
      turnDuration: room.turnDuration,
      currentSpeaker: room.currentSpeaker,
      currentSpeakerName: currentSpeakerSession?.displayName || null,
      turnEndsAt: room.turnEndsAt,
      remainingSeconds,
    };
  }

  getRoomSnapshot(roomId: string) {
    const room = this.rooms[roomId];
    if (!room) return null;
    return this.toPublicRoom(room);
  }

  getRoomsSnapshot() {
    return this.listRooms().map((room) => this.toPublicRoom(room));
  }

  tickTurns(): string[] {
    const changedRoomIds: string[] = [];
    const now = Date.now();
    Object.values(this.rooms).forEach((room) => {
      if (room.status === "finished") return;
      if (!room.currentSpeaker || !room.turnEndsAt) return;
      if (room.participants.length < 2) return;
      if (now >= room.turnEndsAt) {
        this.switchTurn(room.id);
        changedRoomIds.push(room.id);
      }
    });
    return changedRoomIds;
  }

  switchTurn(roomId: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room) return null;

    if (room.participants.length === 0) {
      room.currentSpeaker = null;
      room.turnEndsAt = null;
      return room;
    }

    if (room.participants.length === 1) {
      room.currentSpeaker = null;
      room.turnEndsAt = null;
      return room;
    }

    if (!room.currentSpeaker || !room.participants.includes(room.currentSpeaker)) {
      room.currentSpeaker = room.participants[0];
      room.turnEndsAt = Date.now() + room.turnDuration * 1000;
      return room;
    }

    const currentIndex = room.participants.indexOf(room.currentSpeaker);
    const nextIndex = (currentIndex + 1) % room.participants.length;
    room.currentSpeaker = room.participants[nextIndex];
    room.turnEndsAt = Date.now() + room.turnDuration * 1000;
    return room;
  }
}
