import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
  DebateMessage,
  ParticipantSlot,
  RoomState,
  SocketSession,
  UserRole,
} from "./types";

export const MAX_MESSAGE_LENGTH = 500;
/** Délai avant de considérer un participant comme parti (reload, wifi, arrière-plan mobile). */
export const DISCONNECT_GRACE_MS = 18_000;
/** Délai avant pause auto quand les deux participants sont déconnectés sans résolution. */
export const BOTH_ABSENT_AUTO_PAUSE_MS = 30 * 60 * 1000;

export interface RestoreRoomPayload {
  id: string;
  title: string;
  status: string;
  createdBy: string | null;
  maxTurnTime: number;
  validatedAt: string | null;
  opponentJoinedAt: string | null;
  pausedByUserId: string | null;
  resumeRequestedAt: string | null;
  turnUserId: string | null;
  participants: Array<{
    userId: string;
    position: 1 | 2;
    displayName: string;
  }>;
  messages: DebateMessage[];
}

export type DisconnectGraceOutcome =
  | { type: "reconnected" }
  | {
      type: "abrupt_leave";
      roomId: string;
      absentUserId: string;
      absentDisplayName: string;
      room: RoomState;
    };

interface GraceEntry {
  roomId: string;
  userId: string;
  displayName: string;
  role: UserRole;
  timer: NodeJS.Timeout;
}

@Injectable()
export class RoomsService implements OnModuleDestroy {
  private readonly rooms: Record<string, RoomState> = {};
  private readonly sessions = new Map<string, SocketSession>();
  private readonly disconnectGrace = new Map<string, GraceEntry>();
  private readonly bothAbsentTimers = new Map<string, NodeJS.Timeout>();

  onModuleDestroy() {
    for (const entry of this.disconnectGrace.values()) {
      clearTimeout(entry.timer);
    }
    this.disconnectGrace.clear();
    for (const timer of this.bothAbsentTimers.values()) {
      clearTimeout(timer);
    }
    this.bothAbsentTimers.clear();
  }

  createRoom(
    title: string,
    turnDuration: 180 | 300 | 600 = 180,
    creatorUserId?: string,
    roomId?: string,
  ): RoomState {
    const id = roomId ?? uuidv4();
    if (this.rooms[id]) {
      return this.rooms[id];
    }
    this.rooms[id] = {
      id,
      title: title.trim(),
      status: "waiting",
      creatorUserId,
      participants: [],
      spectators: [],
      messages: [],
      turnDuration,
      currentSpeaker: null,
      turnEndsAt: null,
      awaitingValidation: false,
      debateValidated: false,
      participantSlots: [null, null],
    };
    return this.rooms[id];
  }

  getSessionsInRoom(roomId: string): SocketSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.roomId === roomId);
  }

  finishRoom(roomId: string, endedAt: string, endedByUserId?: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room) return null;
    room.status = "finished";
    room.endedAt = endedAt;
    room.endedByUserId = endedByUserId ?? null;
    room.currentSpeaker = null;
    room.turnEndsAt = null;
    room.pendingSpeakerUserId = null;
    room.pausedByUserId = null;
    room.pausedByDisplayName = null;
    room.absentParticipantUserId = null;
    room.absentParticipantDisplayName = null;
    this.clearBothAbsentAutoPause(roomId);
    return room;
  }

  roomExists(roomId: string): boolean {
    return Boolean(this.rooms[roomId]);
  }

  ensureRoomFromDb(payload: RestoreRoomPayload): RoomState {
    const existing = this.rooms[payload.id];
    if (existing) {
      this.applyDbPauseState(existing, payload);
      if (payload.messages.length > 0) {
        existing.messages = payload.messages;
      }
      return existing;
    }

    const pausedBy = payload.participants.find((p) => p.userId === payload.pausedByUserId);
    const slots: [ParticipantSlot | null, ParticipantSlot | null] = [null, null];

    for (const p of payload.participants) {
      const role = p.position === 1 ? "participantA" : "participantB";
      const slot: ParticipantSlot = {
        userId: p.userId,
        displayName: p.displayName,
        role,
        socketId: null,
      };
      slots[p.position - 1] = slot;
    }

    let status: RoomState["status"] = "waiting";
    if (payload.status === "paused") status = "paused";
    else if (payload.status === "active") status = "active";
    else if (payload.status === "finished") status = "finished";
    else if (payload.status === "cancelled") status = "cancelled";

    const room: RoomState = {
      id: payload.id,
      title: payload.title.trim(),
      status,
      creatorUserId: payload.createdBy ?? undefined,
      participants: [],
      spectators: [],
      messages: [...payload.messages],
      turnDuration: (payload.maxTurnTime as 180 | 300 | 600) || 180,
      currentSpeaker: null,
      turnEndsAt: null,
      awaitingValidation:
        Boolean(payload.opponentJoinedAt) && !payload.validatedAt && status !== "paused",
      debateValidated: Boolean(payload.validatedAt),
      participantSlots: slots,
      pausedByUserId: payload.pausedByUserId,
      pausedByDisplayName: pausedBy?.displayName ?? null,
      resumeRequestedAt: payload.resumeRequestedAt,
      turnUserId: payload.turnUserId,
    };

    this.rooms[payload.id] = room;
    return room;
  }

  private mergeResumeRequestedAt(
    current: string | null | undefined,
    fromDb: string | null,
  ): string | null {
    if (!fromDb) return current ?? null;
    if (!current) return fromDb;
    const dbTime = new Date(fromDb).getTime();
    const memTime = new Date(current).getTime();
    if (Number.isNaN(dbTime)) return current;
    if (Number.isNaN(memTime)) return fromDb;
    return dbTime >= memTime ? fromDb : current;
  }

  private applyDbPauseState(room: RoomState, payload: RestoreRoomPayload): void {
    if (payload.status === "paused") {
      room.status = "paused";
      room.pausedByUserId = payload.pausedByUserId;
      const pausedBy = payload.participants.find((p) => p.userId === payload.pausedByUserId);
      room.pausedByDisplayName = pausedBy?.displayName ?? room.pausedByDisplayName ?? null;
      room.currentSpeaker = null;
      room.turnEndsAt = null;
      room.pendingSpeakerUserId = null;
    }
    room.resumeRequestedAt = this.mergeResumeRequestedAt(
      room.resumeRequestedAt,
      payload.resumeRequestedAt,
    );
    room.turnUserId = payload.turnUserId ?? room.turnUserId ?? null;
    if (payload.messages.length > 0) {
      room.messages = payload.messages;
    }
  }

  syncPauseFromDb(
    roomId: string,
    status: string,
    pausedByUserId: string | null,
    resumeRequestedAt: string | null,
    validatedAt: string | null,
    opponentJoinedAt: string | null,
    turnUserId: string | null = null,
  ): void {
    const room = this.rooms[roomId];
    if (!room) return;

    if (status === "paused") {
      room.status = "paused";
      room.pausedByUserId = pausedByUserId;
      if (pausedByUserId && room.participantSlots) {
        const slot = room.participantSlots.find((s) => s?.userId === pausedByUserId);
        if (slot) room.pausedByDisplayName = slot.displayName;
      }
      room.resumeRequestedAt = this.mergeResumeRequestedAt(
        room.resumeRequestedAt,
        resumeRequestedAt,
      );
      room.currentSpeaker = null;
      room.turnEndsAt = null;
      room.pendingSpeakerUserId = null;
      if (turnUserId) {
        room.turnUserId = turnUserId;
      }
      return;
    }

    room.resumeRequestedAt = this.mergeResumeRequestedAt(
      room.resumeRequestedAt,
      resumeRequestedAt,
    );
    if (turnUserId) {
      room.turnUserId = turnUserId;
    }

    this.syncFromDbValidation(roomId, validatedAt, opponentJoinedAt);
  }

  getCurrentTurnUserId(room: RoomState): string | null {
    if (room.currentSpeaker) {
      const session = this.sessions.get(room.currentSpeaker);
      if (session?.userId) return session.userId;
    }
    if (room.pendingSpeakerUserId) return room.pendingSpeakerUserId;
    if (room.turnUserId) return room.turnUserId;
    return null;
  }

  private resolveSocketIdForUserId(room: RoomState, userId: string): string | null {
    if (room.participantSlots) {
      const slot = room.participantSlots.find((s) => s?.userId === userId);
      if (slot?.socketId) return slot.socketId;
    }
    for (const socketId of room.participants) {
      const session = this.sessions.get(socketId);
      if (session?.userId === userId) return socketId;
    }
    return null;
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

    if (options?.userId && room.participantSlots) {
      const slotIndex = room.participantSlots.findIndex(
        (slot) => slot?.userId === options.userId,
      );
      if (slotIndex >= 0 && room.participantSlots[slotIndex]) {
        const slot = room.participantSlots[slotIndex]!;
        role = slot.role;
        displayName = slot.displayName;
        room.participantSlots[slotIndex] = { ...slot, socketId };
        slotAssigned = true;
      }
    }

    if (options?.userId) {
      const existing = this.getSessionsInRoom(roomId).find(
        (s) => s.userId === options.userId,
      );
      if (existing) {
        role = existing.role;
        displayName = existing.displayName;
        if (role === "participantA" || role === "participantB") {
          if (room.currentSpeaker === existing.socketId) {
            room.currentSpeaker = socketId;
          }
          if (
            room.pendingSpeakerUserId === options.userId &&
            room.turnEndsAt
          ) {
            if (Date.now() >= room.turnEndsAt) {
              room.pendingSpeakerUserId = null;
              this.switchTurn(room.id);
            } else {
              room.currentSpeaker = socketId;
              room.pendingSpeakerUserId = null;
            }
          }
        } else {
          room.spectators = room.spectators.filter((id) => id !== existing.socketId);
          room.spectators.push(socketId);
        }
        this.sessions.delete(existing.socketId);
        slotAssigned = true;
      }
    }

    if (!slotAssigned) {
      const targetIndex = this.findJoinSlotIndex(room, options?.userId);
      if (targetIndex >= 0) {
        role = targetIndex === 0 ? "participantA" : "participantB";
        slotAssigned = true;
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
    this.assignParticipantSlot(room, session);
    this.rebuildParticipantsFromSlots(room);

    if (session.userId && this.cancelDisconnectGrace(session.userId, roomId)) {
      room.absentParticipantUserId = null;
      room.absentParticipantDisplayName = null;
      this.clearBothAbsentAutoPause(roomId);
    }

    const connectedCount = this.countConnectedParticipants(room);
    const registeredCount = this.countRegisteredParticipants(room);

    if (connectedCount >= 2) {
      if (!room.debateValidated) {
        room.awaitingValidation = true;
      } else if (
        room.status !== "paused" &&
        !this.isDebateInProgress(room)
      ) {
        this.startTurns(room);
      }
    } else if (connectedCount < 2 && registeredCount < 2) {
      room.awaitingValidation = false;
      room.currentSpeaker = null;
      room.turnEndsAt = null;
      room.pendingSpeakerUserId = null;
    }
    return session;
  }

  private findJoinSlotIndex(room: RoomState, userId?: string): number {
    if (!room.participantSlots) {
      room.participantSlots = [null, null];
    }

    const slots = room.participantSlots;

    if (userId) {
      const ownIndex = slots.findIndex((slot) => slot?.userId === userId);
      if (ownIndex >= 0) return ownIndex;
    }

    const emptyIndex = slots.findIndex((slot) => !slot);
    if (emptyIndex >= 0) return emptyIndex;

    const offlineIndex = slots.findIndex(
      (slot) =>
        slot &&
        !slot.socketId &&
        (!slot.userId || (userId != null && slot.userId === userId)),
    );
    if (offlineIndex >= 0) return offlineIndex;

    return -1;
  }

  private countConnectedParticipants(room: RoomState): number {
    if (room.participantSlots) {
      return room.participantSlots.filter((slot) => Boolean(slot?.socketId)).length;
    }
    return room.participants.length;
  }

  private countRegisteredParticipants(room: RoomState): number {
    if (room.participantSlots) {
      return room.participantSlots.filter((slot) => Boolean(slot?.userId)).length;
    }
    return room.participants.length;
  }

  private isDebateInProgress(room: RoomState): boolean {
    return room.turnEndsAt !== null || room.messages.length > 0;
  }

  startValidatedDebate(roomId: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room) return null;
    room.debateValidated = true;
    room.awaitingValidation = false;
    room.status = "active";
    if (!this.isDebateInProgress(room)) {
      this.startTurns(room);
    }
    return room;
  }

  syncFromDbValidation(roomId: string, validatedAt: string | null, opponentJoinedAt: string | null): void {
    const room = this.rooms[roomId];
    if (!room || room.status === "paused") return;
    if (validatedAt) {
      room.debateValidated = true;
      room.awaitingValidation = false;
      room.status = "active";
      if (!this.isDebateInProgress(room)) {
        this.startTurns(room);
      }
    } else if (
      opponentJoinedAt &&
      this.countConnectedParticipants(room) >= 2
    ) {
      room.awaitingValidation = true;
      room.debateValidated = false;
    }
  }

  requestResume(roomId: string, userId: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room || room.status !== "paused") return null;
    if (room.pausedByUserId !== userId) return null;
    room.resumeRequestedAt = new Date().toISOString();
    return room;
  }

  validateResume(roomId: string, turnUserId?: string | null): RoomState | null {
    const room = this.rooms[roomId];
    if (!room || room.status !== "paused") return null;
    if (!room.resumeRequestedAt) return null;

    room.status = "active";
    room.pausedByUserId = null;
    room.pausedByDisplayName = null;
    room.resumeRequestedAt = null;
    room.absentParticipantUserId = null;
    room.absentParticipantDisplayName = null;

    const restoreTurnUserId = turnUserId ?? room.turnUserId ?? null;

    if (room.debateValidated && this.countConnectedParticipants(room) >= 1) {
      this.startTurns(room, restoreTurnUserId);
    }
    return room;
  }

  private startTurns(room: RoomState, turnUserId?: string | null): void {
    const userId = turnUserId ?? room.turnUserId ?? null;

    if (userId) {
      const socketId = this.resolveSocketIdForUserId(room, userId);
      room.turnUserId = userId;
      if (socketId) {
        room.currentSpeaker = socketId;
        room.turnEndsAt = Date.now() + room.turnDuration * 1000;
        room.pendingSpeakerUserId = null;
        return;
      }
      room.currentSpeaker = null;
      room.pendingSpeakerUserId = userId;
      room.turnEndsAt = Date.now() + room.turnDuration * 1000;
      return;
    }

    if (room.participants.length > 0) {
      room.currentSpeaker = room.participants[0];
      room.turnEndsAt = Date.now() + room.turnDuration * 1000;
      room.pendingSpeakerUserId = null;
    }
  }

  cancelRoom(roomId: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room) return null;
    this.clearBothAbsentAutoPause(roomId);
    room.status = "cancelled";
    room.currentSpeaker = null;
    room.turnEndsAt = null;
    room.awaitingValidation = false;
    room.debateValidated = false;
    room.pendingSpeakerUserId = null;
    return room;
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

    if (room.status === "finished" || room.status === "cancelled") {
      return { message: null, error: "Ce débat est terminé." };
    }

    if (room.status === "paused") {
      return { message: null, error: "Le débat est en pause." };
    }

    if (room.absentParticipantUserId) {
      return {
        message: null,
        error: "En attente : un participant a quitté le débat.",
      };
    }

    if (room.participants.length < 2) {
      return {
        message: null,
        error: "En attente d'un second participant pour commencer le débat.",
      };
    }

    if (!room.debateValidated || room.awaitingValidation) {
      return {
        message: null,
        error: "Le créateur doit valider le début du débat.",
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
      room.currentSpeaker = null;
      if (session.userId) {
        room.pendingSpeakerUserId = session.userId;
      }
    }

    const keepRoom =
      room.debateValidated &&
      (room.status === "active" || room.status === "paused") &&
      (room.participantSlots?.some((s) => s !== null) ?? false);

    if (room.participants.length === 0 && room.spectators.length === 0 && !keepRoom) {
      delete this.rooms[room.id];
      return null;
    }

    return room;
  }

  private hasDisconnectGraceForRoom(roomId: string): boolean {
    for (const entry of this.disconnectGrace.values()) {
      if (entry.roomId === roomId) return true;
    }
    return false;
  }

  /** Débat validé, deux inscrits, aucun socket connecté, plus de grace en cours. */
  isBothParticipantsOffline(room: RoomState): boolean {
    if (!room.debateValidated) return false;
    if (room.status !== "active") return false;
    if (this.countRegisteredParticipants(room) < 2) return false;
    if (this.countConnectedParticipants(room) > 0) return false;
    if (this.hasDisconnectGraceForRoom(room.id)) return false;
    return true;
  }

  armBothAbsentAutoPause(roomId: string, onExpire: () => void): void {
    if (this.bothAbsentTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      this.bothAbsentTimers.delete(roomId);
      onExpire();
    }, BOTH_ABSENT_AUTO_PAUSE_MS);
    this.bothAbsentTimers.set(roomId, timer);
  }

  clearBothAbsentAutoPause(roomId: string): void {
    const timer = this.bothAbsentTimers.get(roomId);
    if (!timer) return;
    clearTimeout(timer);
    this.bothAbsentTimers.delete(roomId);
  }

  autoPauseBothAbsentRoom(roomId: string): RoomState | null {
    const room = this.rooms[roomId];
    if (!room || !this.isBothParticipantsOffline(room)) return null;

    const pauserId =
      room.creatorUserId ??
      room.participantSlots?.find(
        (slot) => slot?.userId && !slot.userId.startsWith("guest:"),
      )?.userId ??
      null;
    if (!pauserId) return null;

    const pauserSlot = room.participantSlots?.find((slot) => slot?.userId === pauserId);

    room.turnUserId = this.getCurrentTurnUserId(room);
    room.status = "paused";
    room.pausedByUserId = pauserId;
    room.pausedByDisplayName = pauserSlot?.displayName ?? "Participant";
    room.absentParticipantUserId = null;
    room.absentParticipantDisplayName = null;
    room.currentSpeaker = null;
    room.turnEndsAt = null;
    room.pendingSpeakerUserId = null;
    this.clearBothAbsentAutoPause(roomId);
    return room;
  }

  shouldUseDisconnectGrace(session: SocketSession): boolean {
    if (!session.userId) return false;
    if (session.role !== "participantA" && session.role !== "participantB") return false;
    const room = this.rooms[session.roomId];
    if (!room) return false;
    if (!room.debateValidated) return false;
    return room.status === "active" || room.status === "paused";
  }

  beginDisconnectGrace(
    socketId: string,
    session: SocketSession,
    onComplete: (outcome: DisconnectGraceOutcome) => void,
  ): void {
    const room = this.rooms[session.roomId];
    if (!room || !session.userId) return;

    this.detachSocket(socketId);

    const timer = setTimeout(() => {
      this.disconnectGrace.delete(socketId);
      const currentRoom = this.rooms[session.roomId];
      if (!currentRoom || !session.userId) return;

      currentRoom.absentParticipantUserId = session.userId;
      currentRoom.absentParticipantDisplayName = session.displayName;
      currentRoom.currentSpeaker = null;
      currentRoom.turnEndsAt = null;

      this.clearSlotSocket(session.roomId, session.userId);

      onComplete({
        type: "abrupt_leave",
        roomId: session.roomId,
        absentUserId: session.userId,
        absentDisplayName: session.displayName,
        room: currentRoom,
      });
    }, DISCONNECT_GRACE_MS);

    this.disconnectGrace.set(socketId, {
      roomId: session.roomId,
      userId: session.userId,
      displayName: session.displayName,
      role: session.role,
      timer,
    });
  }

  cancelDisconnectGrace(userId: string, roomId: string): boolean {
    for (const [socketId, entry] of this.disconnectGrace.entries()) {
      if (entry.userId === userId && entry.roomId === roomId) {
        clearTimeout(entry.timer);
        this.disconnectGrace.delete(socketId);
        return true;
      }
    }
    return false;
  }

  detachSocket(socketId: string): void {
    const session = this.sessions.get(socketId);
    if (!session) return;

    const room = this.rooms[session.roomId];
    if (!room) {
      this.sessions.delete(socketId);
      return;
    }

    room.participants = room.participants.filter((id) => id !== socketId);
    room.spectators = room.spectators.filter((id) => id !== socketId);
    if (session.userId) {
      this.clearSlotSocket(session.roomId, session.userId);
    }
    if (room.currentSpeaker === socketId) {
      room.currentSpeaker = null;
      if (session.userId) {
        room.pendingSpeakerUserId = session.userId;
      }
    }
    this.sessions.delete(socketId);
  }

  pauseRoom(
    roomId: string,
    userId: string,
    displayName: string,
    socketId: string,
    turnUserId?: string | null,
  ): RoomState | null {
    const room = this.rooms[roomId];
    if (!room) return null;

    room.turnUserId = turnUserId ?? this.getCurrentTurnUserId(room);

    room.status = "paused";
    room.pausedByUserId = userId;
    room.pausedByDisplayName = displayName;
    room.currentSpeaker = null;
    room.turnEndsAt = null;
    room.pendingSpeakerUserId = null;
    room.absentParticipantUserId = null;
    room.absentParticipantDisplayName = null;
    this.clearBothAbsentAutoPause(roomId);

    this.detachSocket(socketId);
    return room;
  }

  resolveAbsentParticipant(
    roomId: string,
    action: "pause" | "finish",
    resolverUserId: string,
    resolverDisplayName: string,
  ): RoomState | null {
    const room = this.rooms[roomId];
    if (!room || !room.absentParticipantUserId) return null;

    this.clearBothAbsentAutoPause(roomId);

    if (action === "pause") {
      room.turnUserId = this.getCurrentTurnUserId(room);
      room.status = "paused";
      room.pausedByUserId = resolverUserId;
      room.pausedByDisplayName = resolverDisplayName;
      room.absentParticipantUserId = null;
      room.absentParticipantDisplayName = null;
      room.currentSpeaker = null;
      room.turnEndsAt = null;
      room.pendingSpeakerUserId = null;
      return room;
    }

    room.absentParticipantUserId = null;
    room.absentParticipantDisplayName = null;
    return room;
  }

  private assignParticipantSlot(room: RoomState, session: SocketSession): void {
    if (session.role !== "participantA" && session.role !== "participantB") {
      return;
    }

    if (!room.participantSlots) {
      room.participantSlots = [null, null];
    }

    if (session.userId) {
      const existingIndex = room.participantSlots.findIndex(
        (slot) => slot?.userId === session.userId,
      );
      if (existingIndex >= 0) {
        const existing = room.participantSlots[existingIndex]!;
        room.participantSlots[existingIndex] = {
          ...existing,
          socketId: session.socketId,
          displayName: session.displayName,
        };
        return;
      }
    }

    const targetIndex =
      session.role === "participantA"
        ? 0
        : session.role === "participantB"
          ? 1
          : this.findJoinSlotIndex(room, session.userId);

    if (targetIndex < 0) return;

    const slotRole = targetIndex === 0 ? "participantA" : "participantB";
    const prior = room.participantSlots[targetIndex];
    room.participantSlots[targetIndex] = {
      userId:
        session.userId ??
        prior?.userId ??
        `guest:${session.socketId}`,
      displayName: session.displayName,
      role: slotRole,
      socketId: session.socketId,
    };
  }

  getConnectedParticipantCount(roomId: string): number {
    const room = this.rooms[roomId];
    if (!room) return 0;
    return this.countConnectedParticipants(room);
  }

  private rebuildParticipantsFromSlots(room: RoomState): void {
    if (!room.participantSlots) return;

    const ids: string[] = [];
    for (const slot of room.participantSlots) {
      if (slot?.socketId && !ids.includes(slot.socketId)) {
        ids.push(slot.socketId);
      }
    }
    room.participants = ids;
  }

  private clearSlotSocket(roomId: string, userId: string): void {
    const room = this.rooms[roomId];
    if (!room?.participantSlots) return;
    room.participantSlots = room.participantSlots.map((slot) =>
      slot?.userId === userId ? { ...slot, socketId: null } : slot,
    ) as [ParticipantSlot | null, ParticipantSlot | null];
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

    if (room.participantSlots) {
      room.participantSlots.forEach((slot, index) => {
        const position = (index === 0 ? 1 : 2) as 1 | 2;
        if (slot) {
          slots.push({
            userId: slot.userId.startsWith("guest:") ? null : slot.userId,
            displayName: slot.displayName,
            position,
          });
          return;
        }
        slots.push({
          userId: null,
          displayName: "En attente d'un participant",
          position,
        });
      });
      return slots;
    }

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
      awaitingValidation: room.awaitingValidation ?? false,
      debateValidated: room.debateValidated ?? false,
      creatorUserId: room.creatorUserId ?? null,
      pausedByUserId: room.pausedByUserId ?? null,
      pausedByDisplayName: room.pausedByDisplayName ?? null,
      resumeRequestedAt: room.resumeRequestedAt ?? null,
      endedByUserId: room.endedByUserId ?? null,
      absentParticipantUserId: room.absentParticipantUserId ?? null,
      absentParticipantDisplayName: room.absentParticipantDisplayName ?? null,
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
      if (room.status === "finished" || room.status === "cancelled" || room.status === "paused") {
        return;
      }
      if (room.absentParticipantUserId) return;
      if (!room.debateValidated) return;
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

    room.pendingSpeakerUserId = null;

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
