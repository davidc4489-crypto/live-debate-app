import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { DebateMessage, RoomState, SocketSession, UserRole } from "./types";

@Injectable()
export class RoomsService {
  private readonly rooms: Record<string, RoomState> = {};
  private readonly sessions = new Map<string, SocketSession>();

  createRoom(title: string, requestedId?: string, turnDuration: 180 | 300 | 600 = 180): RoomState {
    const id = (requestedId || uuidv4()).trim();
    if (!this.rooms[id]) {
      this.rooms[id] = {
        id,
        title: title.trim(),
        participants: [],
        spectators: [],
        messages: [],
        turnDuration,
        currentSpeaker: null,
        turnEndsAt: null,
      };
    }
    return this.rooms[id];
  }

  roomExists(roomId: string): boolean {
    return Boolean(this.rooms[roomId]);
  }

  joinRoom(roomId: string, socketId: string, username?: string): SocketSession {
    const room = this.rooms[roomId];
    const sanitizedName = (username || "Anonymous").trim() || "Anonymous";

    let role: UserRole = "spectator";
    let displayName = sanitizedName;

    if (room.participants.length === 0) {
      role = "participantA";
      displayName = "Participant A";
      room.participants.push(socketId);
    } else if (room.participants.length === 1) {
      role = "participantB";
      displayName = "Participant B";
      room.participants.push(socketId);
    } else {
      room.spectators.push(socketId);
    }

    const session: SocketSession = {
      socketId,
      roomId,
      displayName,
      role,
    };

    this.sessions.set(socketId, session);

    if (!room.currentSpeaker && room.participants.length > 0) {
      room.currentSpeaker = room.participants[0];
      room.turnEndsAt = Date.now() + room.turnDuration * 1000;
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

    const room = this.rooms[session.roomId];
    if (!room) return { message: null, error: "Room introuvable." };

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
    };

    room.messages.push(message);
    return { message };
  }

  deleteMessage(roomId: string, messageId: string): boolean {
    const room = this.rooms[roomId];
    if (!room) return false;

    const before = room.messages.length;
    room.messages = room.messages.filter((message) => message.id !== messageId);
    return room.messages.length < before;
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

  toPublicRoom(room: RoomState) {
    const currentSpeakerSession = room.currentSpeaker ? this.sessions.get(room.currentSpeaker) : undefined;
    const remainingSeconds = room.turnEndsAt ? Math.max(0, Math.ceil((room.turnEndsAt - Date.now()) / 1000)) : 0;

    return {
      id: room.id,
      title: room.title,
      participants: room.participants.length,
      spectators: room.spectators.length,
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
      room.currentSpeaker = room.participants[0];
      room.turnEndsAt = Date.now() + room.turnDuration * 1000;
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
