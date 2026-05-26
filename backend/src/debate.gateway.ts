import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger, OnModuleDestroy } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import {
  CreateRoomPayload,
  EndDebatePayload,
  GetRoomStatePayload,
  JoinRoomPayload,
  SendMessagePayload,
  LeaveDebatePayload,
  RequestResumeDebatePayload,
  ResolveAbsentDebatePayload,
  SubscribeUserPayload,
  ValidateDebateStartPayload,
  ValidateResumeDebatePayload,
  DebatePresenceEvent,
} from "./dto/events";
import { AuthService } from "./auth/auth.service";
import { MessageFlagsService } from "./moderation/message-flags.service";
import { ModerationService } from "./moderation/moderation.service";
import { DebateCreationService } from "./debates/debate-creation.service";
import { DebateFinishService } from "./debates/debate-finish.service";
import { DebateLifecycleService } from "./debates/debate-lifecycle.service";
import { DebatePresenceService } from "./debates/debate-presence.service";
import { DebateRestoreService } from "./debates/debate-restore.service";
import { DebateSchedulingService } from "./debates/debate-scheduling.service";
import { NotificationsPushService } from "./notifications/notifications-push.service";
import { RoomsService } from "./rooms.service";
import {
  httpExceptionMessage,
  runEmittingHttpErrors,
  withAuthenticatedRoomSession,
} from "./debate-gateway-session.helper";
import type { GatewaySessionDeps } from "./debate-gateway-session.helper";

@WebSocketGateway({
  cors: { origin: "*" },
})
export class DebateGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  private readonly logger = new Logger(DebateGateway.name);

  @WebSocketServer()
  server!: Server;

  private turnInterval: NodeJS.Timeout;
  private cancelInterval: NodeJS.Timeout;
  private scheduledInterval: NodeJS.Timeout;
  private cancelExpiredDebatesRunning = false;
  private activateScheduledRunning = false;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly authService: AuthService,
    private readonly moderationService: ModerationService,
    private readonly messageFlagsService: MessageFlagsService,
    private readonly debateCreationService: DebateCreationService,
    private readonly debateFinishService: DebateFinishService,
    private readonly debateLifecycleService: DebateLifecycleService,
    private readonly debateRestoreService: DebateRestoreService,
    private readonly debatePresenceService: DebatePresenceService,
    private readonly debateSchedulingService: DebateSchedulingService,
    private readonly notificationsPush: NotificationsPushService,
  ) {
    this.turnInterval = setInterval(() => {
      const changedRoomIds = this.roomsService.tickTurns();

      changedRoomIds.forEach((roomId) => {
        const snapshot = this.roomsService.getRoomSnapshot(roomId);
        if (!snapshot) return;
        this.server.to(roomId).emit("turnChanged", snapshot);
        this.server.to(roomId).emit("roomUpdated", snapshot);
      });

      this.roomsService.listRooms().forEach((room) => {
        const snapshot = this.roomsService.getRoomSnapshot(room.id);
        if (!snapshot) return;
        this.server.to(room.id).emit("tick", {
          roomId: room.id,
          remainingSeconds: snapshot.remainingSeconds,
          currentSpeaker: snapshot.currentSpeaker,
          currentSpeakerName: snapshot.currentSpeakerName,
          turnEndsAt: snapshot.turnEndsAt,
        });
      });
    }, 1000);

    this.cancelInterval = setInterval(() => {
      void this.runCancelExpiredDebates();
    }, 60_000);

    this.scheduledInterval = setInterval(() => {
      void this.runActivateScheduledDebates();
    }, 60_000);
  }

  afterInit(server: Server): void {
    this.notificationsPush.registerServer(server);
  }

  private async runActivateScheduledDebates(): Promise<void> {
    if (this.activateScheduledRunning) return;

    this.activateScheduledRunning = true;
    try {
      const due = await this.debateSchedulingService.findDebatesToActivate();
      if (due.length === 0) return;

      for (const debate of due) {
        const turnDuration = debate.max_turn_time as 180 | 300 | 600;
        if (!this.roomsService.getRoomSnapshot(debate.id)) {
          this.roomsService.createRoom(
            debate.title,
            turnDuration,
            debate.created_by,
            debate.id,
          );
        }

        await this.debateSchedulingService.markActivated(debate.id, debate.created_by);
        await this.debateSchedulingService.notifyDebateStarting(debate.id, debate.title, [
          debate.created_by,
          debate.interested_user_id,
        ]);
      }

      this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Échec activation débats planifiés : ${message}`);
    } finally {
      this.activateScheduledRunning = false;
    }
  }

  private async runCancelExpiredDebates(): Promise<void> {
    if (this.cancelExpiredDebatesRunning) {
      this.logger.warn(
        "Annulation des débats expirés ignorée : exécution précédente encore en cours.",
      );
      return;
    }

    this.cancelExpiredDebatesRunning = true;
    try {
      const cancelledIds = await this.debateLifecycleService.cancelExpiredDebates();
      cancelledIds.forEach((roomId) => {
        const room = this.roomsService.cancelRoom(roomId);
        const snapshot = room
          ? this.roomsService.toPublicRoom(room)
          : this.roomsService.getRoomSnapshot(roomId);
        this.server.to(roomId).emit("debateCancelled", { roomId });
        if (snapshot) {
          this.server.to(roomId).emit("roomUpdated", snapshot);
        }
      });
      if (cancelledIds.length > 0) {
        this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Échec annulation débats expirés : ${message}`);
    } finally {
      this.cancelExpiredDebatesRunning = false;
    }
  }

  onModuleDestroy() {
    clearInterval(this.turnInterval);
    clearInterval(this.cancelInterval);
    clearInterval(this.scheduledInterval);
  }

  handleConnection(client: Socket) {
    client.emit("connected", { socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    const session = this.roomsService.getSession(client.id);
    if (!session) {
      this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
      return;
    }

    if (this.roomsService.shouldUseDisconnectGrace(session)) {
      this.roomsService.beginDisconnectGrace(client.id, session, (outcome) => {
        if (outcome.type === "abrupt_leave") {
          this.emitDebatePresence(outcome.roomId, {
            kind: "participant_left",
            actorUserId: outcome.absentUserId,
            actorDisplayName: outcome.absentDisplayName,
            message: `${outcome.absentDisplayName} a quitté le débat.`,
          });
          this.maybeArmBothAbsentAutoPause(outcome.roomId);
        }
        this.broadcastRoomsUpdated();
      });
      return;
    }

    this.finalizeSocketLeave(client.id);
  }

  private finalizeSocketLeave(socketId: string) {
    const room = this.roomsService.leaveRoom(socketId);
    if (!room) {
      this.broadcastRoomsUpdated();
      return;
    }

    const snapshot = this.roomsService.getRoomSnapshot(room.id);
    if (snapshot) {
      this.server.to(room.id).emit("roomUpdated", snapshot);
    }
    this.broadcastRoomsUpdated();
  }

  private broadcastRoomsUpdated() {
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

  private maybeArmBothAbsentAutoPause(roomId: string): void {
    const room = this.roomsService.getRoom(roomId);
    if (!room || !this.roomsService.isBothParticipantsOffline(room)) {
      return;
    }

    this.roomsService.armBothAbsentAutoPause(roomId, () => {
      void this.runBothAbsentAutoPause(roomId);
    });
  }

  private async runBothAbsentAutoPause(roomId: string): Promise<void> {
    const room = this.roomsService.getRoom(roomId);
    if (!room || !this.roomsService.isBothParticipantsOffline(room)) {
      return;
    }

    const actorUserId =
      room.creatorUserId ??
      room.participantSlots?.find(
        (slot) => slot?.userId && !slot.userId.startsWith("guest:"),
      )?.userId;
    if (!actorUserId) {
      return;
    }

    const actorSlot = room.participantSlots?.find((slot) => slot?.userId === actorUserId);
    const actorDisplayName = actorSlot?.displayName ?? "Application";

    const updated = this.roomsService.autoPauseBothAbsentRoom(roomId);
    if (!updated) {
      return;
    }

    try {
      const turnUserId = this.roomsService.getCurrentTurnUserId(updated);
      const sessions = this.roomsService.getSessionsInRoom(roomId);
      await this.debateFinishService.persistRoomMessages(roomId, updated.messages, sessions);
      await this.debatePresenceService.pauseDebate(roomId, actorUserId, turnUserId);
      this.emitDebatePresence(roomId, {
        kind: "paused",
        actorUserId,
        actorDisplayName,
        message:
          "Le débat a été mis en pause automatiquement : les deux participants sont absents depuis 30 minutes.",
      });
      this.broadcastRoomsUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Pause auto (deux absents) ${roomId} : ${message}`);
    }
  }

  private emitDebatePresence(roomId: string, payload: DebatePresenceEvent) {
    const snapshot = this.roomsService.getRoomSnapshot(roomId);
    this.server.to(roomId).emit("debatePresence", {
      roomId,
      ...payload,
      snapshot,
    });
    if (snapshot) {
      this.server.to(roomId).emit("roomUpdated", snapshot);
    }
  }

  @SubscribeMessage("subscribeUser")
  async subscribeUser(
    @MessageBody() payload: SubscribeUserPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const accessToken = payload?.accessToken?.trim();
    if (!accessToken) return;

    try {
      const user = await this.authService.getMe(accessToken);
      client.join(this.userChannel(user.id));
    } catch {
      // ignore invalid token
    }
  }

  @SubscribeMessage("getRooms")
  getRooms(@ConnectedSocket() client: Socket) {
    client.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

  @SubscribeMessage("getRoomState")
  async getRoomState(
    @MessageBody() payload: GetRoomStatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = payload?.roomId?.trim();
    if (!roomId) {
      client.emit("errorMessage", { message: "Room invalide." });
      return;
    }

    if (!this.roomsService.roomExists(roomId)) {
      const restorePayload =
        await this.debateRestoreService.getDebateRestorePayload(roomId);
      if (
        restorePayload &&
        ["pending", "active", "paused"].includes(restorePayload.status)
      ) {
        this.roomsService.ensureRoomFromDb(restorePayload);
      }
    }

    const snapshot = this.roomsService.getRoomSnapshot(roomId);
    if (snapshot) {
      client.emit("roomUpdated", snapshot);
    }
  }

  @SubscribeMessage("createRoom")
  async createRoom(
    @MessageBody() payload: CreateRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const accessToken = payload?.accessToken?.trim();
    if (!accessToken) {
      client.emit("errorMessage", {
        message: "Vous devez être connecté pour créer un débat.",
      });
      return;
    }

    let creator;
    try {
      creator = await this.authService.getMe(accessToken);
    } catch {
      client.emit("errorMessage", {
        message: "Session invalide ou expirée. Reconnectez-vous.",
      });
      return;
    }

    const title = payload?.title?.trim();
    if (!title) {
      client.emit("errorMessage", { message: "Le titre de la room est requis." });
      return;
    }

    const allowedDurations = [180, 300, 600] as const;
    const turnDuration = allowedDurations.includes(payload?.turnDuration || 180)
      ? (payload?.turnDuration as 180 | 300 | 600)
      : 180;

    const creatorDisplayName =
      await this.debateCreationService.getProfileDisplayName(creator.id);

    const room = this.roomsService.createRoom(title, turnDuration, creator.id);
    client.join(room.id);
    client.join(this.userChannel(creator.id));
    this.roomsService.joinRoom(room.id, client.id, {
      userId: creator.id,
      displayName: creatorDisplayName,
    });

    const snapshot = this.roomsService.getRoomSnapshot(room.id);
    client.emit("roomCreated", snapshot);
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());

    try {
      await this.debateCreationService.onLiveDebateCreated(
        creator.id,
        room.id,
        title,
        turnDuration,
        {
          creatorStance: payload?.creatorStance,
          opponentMode: payload?.opponentMode ?? "human",
        },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible d'enregistrer le débat.";
      this.logger.error(`Persistance débat ${room.id} : ${message}`);
      client.emit("errorMessage", {
        message:
          "Le débat est ouvert en direct mais n'a pas pu être enregistré. Vérifiez la base Supabase.",
      });
    }
  }

  @SubscribeMessage("joinRoom")
  async joinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = payload?.roomId?.trim();
    if (!roomId) {
      client.emit("errorMessage", { message: "Room invalide." });
      return;
    }

    if (!this.roomsService.roomExists(roomId)) {
      const restorePayload =
        await this.debateRestoreService.getDebateRestorePayload(roomId);
      const joinable =
        restorePayload &&
        ["pending", "active", "paused"].includes(restorePayload.status);

      if (joinable) {
        this.roomsService.ensureRoomFromDb(restorePayload);
        this.logger.log(`Room ${roomId} restaurée depuis la base pour joinRoom.`);
      } else {
        this.logger.warn(
          `joinRoom refusé pour ${roomId} : room absente en mémoire` +
            (restorePayload
              ? ` (statut DB : ${restorePayload.status})`
              : " (débat absent ou illisible en base)"),
        );
        client.emit("errorMessage", { message: "Room introuvable." });
        return;
      }
    }

    let joinOptions: { username?: string; userId?: string; displayName?: string } = {
      username: payload?.username,
    };

    const accessToken = payload?.accessToken?.trim();
    if (accessToken) {
      try {
        const user = await this.authService.getMe(accessToken);
        client.join(this.userChannel(user.id));
        const profileName = await this.debateCreationService.getProfileDisplayName(user.id);
        joinOptions = {
          userId: user.id,
          displayName: profileName,
        };
      } catch {
        client.emit("errorMessage", {
          message: "Session invalide. Reconnectez-vous pour rejoindre le débat.",
        });
        return;
      }
    }

    client.join(roomId);
    const session = this.roomsService.joinRoom(roomId, client.id, joinOptions);
    const room = this.roomsService.getRoom(roomId);

    if (
      session.userId &&
      (session.role === "participantA" || session.role === "participantB")
    ) {
      const position = session.role === "participantA" ? 1 : 2;
      void this.debateCreationService
        .registerParticipant(roomId, session.userId, position)
        .catch(() => undefined);
    }

    const meta = await this.debateRestoreService.getDebateMeta(roomId);
    if (meta && room) {
      if (meta.status === "paused") {
        this.roomsService.syncPauseFromDb(
          roomId,
          meta.status,
          meta.pausedByUserId,
          meta.resumeRequestedAt,
          meta.validatedAt,
          meta.opponentJoinedAt,
          meta.turnUserId,
        );
      } else {
        this.roomsService.syncFromDbValidation(
          roomId,
          meta.validatedAt,
          meta.opponentJoinedAt,
        );
      }
    }

    const updatedRoom = this.roomsService.getRoom(roomId);
    let opponentJustJoined = false;
    const connectedCount = this.roomsService.getConnectedParticipantCount(roomId);
    if (
      updatedRoom &&
      connectedCount >= 2 &&
      updatedRoom.awaitingValidation &&
      session.role === "participantB" &&
      session.userId &&
      updatedRoom.creatorUserId
    ) {
      try {
        opponentJustJoined = await this.debateLifecycleService.onSecondParticipantJoined(
          roomId,
          updatedRoom.creatorUserId,
          session.userId,
          session.displayName,
        );
      } catch {
        // non bloquant
      }
    }

    if (opponentJustJoined) {
      const metaAfter = await this.debateRestoreService.getDebateMeta(roomId);
      if (metaAfter) {
        this.roomsService.syncFromDbValidation(
          roomId,
          metaAfter.validatedAt,
          metaAfter.opponentJoinedAt,
        );
      }
    }

    const roomSnapshot = this.roomsService.getRoomSnapshot(roomId);

    if (roomSnapshot && roomSnapshot.awaitingValidation) {
      this.server.to(roomId).emit("awaitingValidation", roomSnapshot);
    }

    if (opponentJustJoined && updatedRoom?.creatorUserId) {
      this.server
        .to(this.userChannel(updatedRoom.creatorUserId))
        .emit("notificationsUpdated");
    }

    client.emit("joinedRoom", {
      roomId,
      role: session.role,
      displayName: session.displayName,
      userId: session.userId ?? null,
    });
    if (roomSnapshot) {
      this.server.to(roomId).emit("roomUpdated", roomSnapshot);
    } else {
      this.logger.warn(`roomUpdated ignoré après joinRoom : room ${roomId} introuvable`);
    }
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

  private userChannel(userId: string): string {
    return `user:${userId}`;
  }

  private emitGatewayError(client: Socket, message: string): void {
    client.emit("errorMessage", { message });
  }

  private get gatewaySessionDeps(): GatewaySessionDeps {
    return {
      authService: this.authService,
      getSession: (socketId) => this.roomsService.getSession(socketId),
      emitError: (client, message) => this.emitGatewayError(client, message),
    };
  }

  @SubscribeMessage("validateDebateStart")
  async validateDebateStart(
    @MessageBody() payload: ValidateDebateStartPayload,
    @ConnectedSocket() client: Socket,
  ) {
    await withAuthenticatedRoomSession(
      this.gatewaySessionDeps,
      client,
      payload,
      {
        missingTokenMessage: "Connectez-vous pour démarrer le débat.",
        allowGuestSession: true,
      },
      async ({ client: socket, userId, roomId }) => {
        try {
          await this.debateLifecycleService.validateDebateStart(roomId, userId);
        } catch (err) {
          this.emitGatewayError(
            socket,
            httpExceptionMessage(err, "Impossible de démarrer le débat."),
          );
          return;
        }

        const room = this.roomsService.startValidatedDebate(roomId);
        if (!room) {
          this.emitGatewayError(socket, "Room introuvable.");
          return;
        }

        const snapshot = this.roomsService.toPublicRoom(room);
        this.server.to(roomId).emit("debateStarted", snapshot);
        this.server.to(roomId).emit("roomUpdated", snapshot);
        this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
      },
    );
  }

  @SubscribeMessage("leaveDebate")
  async leaveDebate(
    @MessageBody() payload: LeaveDebatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    await withAuthenticatedRoomSession(
      this.gatewaySessionDeps,
      client,
      payload,
      {
        validateBeforeAuth: (p) => {
          if (!p.accessToken?.trim() || (p.action !== "pause" && p.action !== "finish")) {
            return "Requête invalide.";
          }
          return null;
        },
      },
      async ({ client: socket, session, userId, roomId, payload: p }) => {
        const action = p.action;
        const room = this.roomsService.getRoom(roomId);
        if (!room) {
          this.emitGatewayError(socket, "Room introuvable.");
          return;
        }

        try {
          this.debatePresenceService.assertCanManagePresence(room, session);
        } catch (err) {
          this.emitGatewayError(socket, httpExceptionMessage(err, "Action refusée."));
          return;
        }

        this.roomsService.cancelDisconnectGrace(userId, roomId);

        const meta = await this.debateRestoreService.getDebateMeta(roomId);
        const waitingAlone =
          room.participants.length < 2 &&
          (meta?.status === "pending" || room.status === "waiting") &&
          (session.role === "participantA" || session.role === "participantB");

        if (waitingAlone && action === "finish") {
          await runEmittingHttpErrors(
            this.emitGatewayError.bind(this),
            socket,
            "Impossible de quitter le débat.",
            async () => {
              await this.debateLifecycleService.cancelPendingDebate(roomId);
              this.roomsService.cancelRoom(roomId);
              const snapshot = this.roomsService.getRoomSnapshot(roomId);
              this.server.to(roomId).emit("debateCancelled", { roomId });
              if (snapshot) {
                this.server.to(roomId).emit("roomUpdated", snapshot);
              }
              socket.leave(roomId);
              this.finalizeSocketLeave(socket.id);
              this.broadcastRoomsUpdated();
            },
          );
          return;
        }

        if (waitingAlone && action === "pause") {
          this.emitGatewayError(
            socket,
            "Impossible de mettre en pause : attendez un adversaire ou quittez le débat pour l'annuler.",
          );
          return;
        }

        if (action === "pause") {
          await runEmittingHttpErrors(
            this.emitGatewayError.bind(this),
            socket,
            "Impossible de mettre en pause.",
            async () => {
              const turnUserId = this.roomsService.getCurrentTurnUserId(room);
              const sessions = this.roomsService.getSessionsInRoom(roomId);
              await this.debateFinishService.persistRoomMessages(
                roomId,
                room.messages,
                sessions,
              );
              await this.debatePresenceService.pauseDebate(roomId, userId, turnUserId);
              const updated = this.roomsService.pauseRoom(
                roomId,
                userId,
                session.displayName,
                socket.id,
                turnUserId,
              );
              if (updated) {
                this.emitDebatePresence(roomId, {
                  kind: "paused",
                  actorUserId: userId,
                  actorDisplayName: session.displayName,
                  message: `${session.displayName} a mis le débat en pause.`,
                });
              }
              socket.leave(roomId);
              this.broadcastRoomsUpdated();
            },
          );
          return;
        }

        await runEmittingHttpErrors(
          this.emitGatewayError.bind(this),
          socket,
          "Impossible de terminer le débat.",
          async () => {
            const sessions = this.roomsService.getSessionsInRoom(roomId);
            const { endedAt } = await this.debateFinishService.finishDebate(
              roomId,
              room,
              sessions,
            );
            await this.debatePresenceService.finishDebateByUser(roomId, userId, endedAt);
            this.roomsService.finishRoom(roomId, endedAt, userId);
            const snapshot = this.roomsService.getRoomSnapshot(roomId);

            this.emitDebatePresence(roomId, {
              kind: "finished",
              actorUserId: userId,
              actorDisplayName: session.displayName,
              message: `${session.displayName} a terminé le débat.`,
            });

            this.server.to(roomId).emit("debateEnded", { roomId, endedAt, snapshot });
            socket.leave(roomId);
            this.broadcastRoomsUpdated();
          },
        );
      },
    );
  }

  @SubscribeMessage("requestResumeDebate")
  async requestResumeDebate(
    @MessageBody() payload: RequestResumeDebatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    await withAuthenticatedRoomSession(
      this.gatewaySessionDeps,
      client,
      payload,
      { missingTokenMessage: "Connectez-vous pour reprendre le débat." },
      async ({ client: socket, session, userId, roomId }) => {
        const room = this.roomsService.getRoom(roomId);
        if (!room) {
          this.emitGatewayError(socket, "Room introuvable.");
          return;
        }

        const dbRow = await this.debateRestoreService.getDebateAuthRow(roomId);
        try {
          this.debatePresenceService.assertCanRequestResume(room, session, dbRow);
        } catch (err) {
          this.emitGatewayError(socket, httpExceptionMessage(err, "Action refusée."));
          return;
        }

        await runEmittingHttpErrors(
          this.emitGatewayError.bind(this),
          socket,
          "Impossible de demander la reprise.",
          async () => {
            await this.debateLifecycleService.requestResumeDebate(roomId, userId);
            const updated = this.roomsService.requestResume(roomId, userId);
            if (updated) {
              this.emitDebatePresence(roomId, {
                kind: "resume_requested",
                actorUserId: userId,
                actorDisplayName: session.displayName,
                message: `${session.displayName} souhaite reprendre le débat. L'autre participant doit valider.`,
              });
              this.broadcastRoomsUpdated();
            }
          },
        );
      },
    );
  }

  @SubscribeMessage("validateResumeDebate")
  async validateResumeDebate(
    @MessageBody() payload: ValidateResumeDebatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    await withAuthenticatedRoomSession(
      this.gatewaySessionDeps,
      client,
      payload,
      { missingTokenMessage: "Connectez-vous pour valider la reprise." },
      async ({ client: socket, session, userId, roomId }) => {
        let room = this.roomsService.getRoom(roomId);
        if (!room) {
          const restorePayload =
            await this.debateRestoreService.getDebateRestorePayload(roomId);
          if (restorePayload) {
            this.roomsService.ensureRoomFromDb(restorePayload);
            room = this.roomsService.getRoom(roomId);
          }
        }
        if (!room) {
          this.emitGatewayError(socket, "Room introuvable.");
          return;
        }

        const meta = await this.debateRestoreService.getDebateMeta(roomId);
        if (meta?.status === "paused") {
          this.roomsService.syncPauseFromDb(
            roomId,
            meta.status,
            meta.pausedByUserId,
            meta.resumeRequestedAt,
            meta.validatedAt,
            meta.opponentJoinedAt,
            meta.turnUserId,
          );
          room = this.roomsService.getRoom(roomId) ?? room;
        }

        const dbRow = await this.debateRestoreService.getDebateAuthRow(roomId);
        try {
          this.debatePresenceService.assertCanValidateResume(room, session, dbRow);
        } catch (err) {
          this.emitGatewayError(socket, httpExceptionMessage(err, "Action refusée."));
          return;
        }

        const metaForResume = await this.debateRestoreService.getDebateMeta(roomId);
        const turnUserId = metaForResume?.turnUserId ?? room.turnUserId ?? null;

        await runEmittingHttpErrors(
          this.emitGatewayError.bind(this),
          socket,
          "Impossible de reprendre le débat.",
          async () => {
            await this.debateLifecycleService.validateResumeDebate(roomId, userId);
            const updated = this.roomsService.validateResume(roomId, turnUserId);
            if (updated) {
              const snapshot = this.roomsService.toPublicRoom(updated);
              this.emitDebatePresence(roomId, {
                kind: "resumed",
                actorUserId: userId,
                actorDisplayName: session.displayName,
                message: `${session.displayName} a validé la reprise du débat.`,
              });
              this.server.to(roomId).emit("debateStarted", snapshot);
              this.broadcastRoomsUpdated();
            }
          },
        );
      },
    );
  }

  @SubscribeMessage("resolveAbsentDebate")
  async resolveAbsentDebate(
    @MessageBody() payload: ResolveAbsentDebatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    await withAuthenticatedRoomSession(
      this.gatewaySessionDeps,
      client,
      payload,
      {
        validateBeforeAuth: (p) => {
          if (!p.accessToken?.trim() || (p.action !== "pause" && p.action !== "finish")) {
            return "Requête invalide.";
          }
          return null;
        },
      },
      async ({ client: socket, session, userId, roomId, payload: p }) => {
        const action = p.action;
        const room = this.roomsService.getRoom(roomId);
        if (!room?.absentParticipantUserId) {
          this.emitGatewayError(socket, "Aucun participant absent à traiter.");
          return;
        }

        if (action === "pause") {
          const absentName = room.absentParticipantDisplayName ?? "l'autre participant";
          await runEmittingHttpErrors(
            this.emitGatewayError.bind(this),
            socket,
            "Impossible de mettre en pause.",
            async () => {
              const turnUserId = this.roomsService.getCurrentTurnUserId(room);
              const sessions = this.roomsService.getSessionsInRoom(roomId);
              await this.debateFinishService.persistRoomMessages(
                roomId,
                room.messages,
                sessions,
              );
              await this.debatePresenceService.pauseDebate(roomId, userId, turnUserId);
              this.roomsService.resolveAbsentParticipant(
                roomId,
                "pause",
                userId,
                session.displayName,
              );
              this.emitDebatePresence(roomId, {
                kind: "paused",
                actorUserId: userId,
                actorDisplayName: session.displayName,
                message: `Le débat a été mis en pause suite au départ de ${absentName}.`,
              });
              this.broadcastRoomsUpdated();
            },
          );
          return;
        }

        const absentName = room.absentParticipantDisplayName ?? "l'autre participant";
        await runEmittingHttpErrors(
          this.emitGatewayError.bind(this),
          socket,
          "Impossible de terminer le débat.",
          async () => {
            const sessions = this.roomsService.getSessionsInRoom(roomId);
            const { endedAt } = await this.debateFinishService.finishDebate(
              roomId,
              room,
              sessions,
            );
            await this.debatePresenceService.finishDebateByUser(roomId, userId, endedAt);
            this.roomsService.finishRoom(roomId, endedAt, userId);
            const snapshot = this.roomsService.getRoomSnapshot(roomId);

            this.emitDebatePresence(roomId, {
              kind: "finished",
              actorUserId: userId,
              actorDisplayName: session.displayName,
              message: `Le débat a été terminé suite au départ de ${absentName}.`,
            });

            this.server.to(roomId).emit("debateEnded", { roomId, endedAt, snapshot });
            this.broadcastRoomsUpdated();
          },
        );
      },
    );
  }

  @SubscribeMessage("endDebate")
  async endDebate(
    @MessageBody() payload: EndDebatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    await withAuthenticatedRoomSession(
      this.gatewaySessionDeps,
      client,
      payload,
      { missingTokenMessage: "Connectez-vous pour mettre fin au débat." },
      async ({ client: socket, session, userId, roomId }) => {
        const room = this.roomsService.getRoom(roomId);
        if (!room) {
          this.emitGatewayError(socket, "Room introuvable.");
          return;
        }

        try {
          this.debateFinishService.assertCanEndDebate(room, session);
        } catch (err) {
          this.emitGatewayError(socket, httpExceptionMessage(err, "Action refusée."));
          return;
        }

        await runEmittingHttpErrors(
          this.emitGatewayError.bind(this),
          socket,
          "Impossible de terminer le débat.",
          async () => {
            const sessions = this.roomsService.getSessionsInRoom(roomId);
            const { endedAt } = await this.debateFinishService.finishDebate(
              roomId,
              room,
              sessions,
            );
            this.roomsService.finishRoom(roomId, endedAt, userId);
            const snapshot = this.roomsService.getRoomSnapshot(roomId);

            this.emitDebatePresence(roomId, {
              kind: "finished",
              actorUserId: userId,
              actorDisplayName: session.displayName,
              message: `${session.displayName} a terminé le débat.`,
            });

            this.server.to(roomId).emit("debateEnded", {
              roomId,
              endedAt,
              snapshot,
            });
            this.broadcastRoomsUpdated();
          },
        );
      },
    );
  }

  @SubscribeMessage("sendMessage")
  async sendMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.roomsService.getSession(client.id);
    if (!session) {
      client.emit("errorMessage", { message: "Vous devez rejoindre une room." });
      return;
    }

    if (session.roomId !== payload?.roomId) {
      client.emit("errorMessage", { message: "Room invalide pour ce message." });
      return;
    }

    const text = payload?.text?.trim() ?? "";
    if (!text) {
      client.emit("errorMessage", { message: "Le message ne peut pas etre vide." });
      return;
    }

    const warnAccepted = Boolean(
      payload.warnToken &&
        this.moderationService.consumeWarnToken(payload.warnToken, client.id, text),
    );

    let moderation = warnAccepted
      ? null
      : await this.moderationService.moderateText(text);

    if (moderation?.action === "block") {
      client.emit("errorMessage", {
        message: this.moderationService.getBlockMessage(),
        code: "MODERATION_BLOCK",
      });
      return;
    }

    if (moderation?.action === "warn") {
      const warnToken = this.moderationService.issueWarnToken(client.id, text);
      client.emit("moderationWarn", {
        roomId: session.roomId,
        text,
        warnToken,
        scores: {
          toxicity: moderation.toxicity,
          insult: moderation.insult,
          threat: moderation.threat,
          identity_hate: moderation.identity_hate,
        },
        message: this.moderationService.getWarnMessage(),
      });
      return;
    }

    const result = this.roomsService.sendMessage(client.id, text);
    if (!result.message) {
      client.emit("errorMessage", {
        message: result.error || "Message refuse.",
      });
      return;
    }

    if (!moderation) {
      moderation = await this.moderationService.moderateText(text);
    }
    void this.messageFlagsService.saveFlag(result.message.id, moderation);

    const snapshot = this.roomsService.getRoomSnapshot(session.roomId);
    const switchedRoom = this.roomsService.switchTurn(session.roomId);
    const switchedSnapshot = switchedRoom
      ? this.roomsService.toPublicRoom(switchedRoom)
      : snapshot;

    if (switchedSnapshot) {
      this.server.to(session.roomId).emit("turnChanged", switchedSnapshot);
      this.server.to(session.roomId).emit("roomUpdated", switchedSnapshot);
    }
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

}
