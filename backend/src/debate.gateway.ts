import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
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
  SubscribeUserPayload,
  ValidateDebateStartPayload,
} from "./dto/events";
import { AuthService } from "./auth/auth.service";
import { MessageFlagsService } from "./moderation/message-flags.service";
import { ModerationService } from "./moderation/moderation.service";
import { DebateCreationService } from "./debates/debate-creation.service";
import { DebateFinishService } from "./debates/debate-finish.service";
import { DebateLifecycleService } from "./debates/debate-lifecycle.service";
import { RoomsService } from "./rooms.service";
import { HttpException } from "@nestjs/common";

@WebSocketGateway({
  cors: { origin: "*" },
})
export class DebateGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(DebateGateway.name);

  @WebSocketServer()
  server!: Server;

  private turnInterval: NodeJS.Timeout;
  private cancelInterval: NodeJS.Timeout;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly authService: AuthService,
    private readonly moderationService: ModerationService,
    private readonly messageFlagsService: MessageFlagsService,
    private readonly debateCreationService: DebateCreationService,
    private readonly debateFinishService: DebateFinishService,
    private readonly debateLifecycleService: DebateLifecycleService,
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
      void this.debateLifecycleService.cancelExpiredDebates().then((cancelledIds) => {
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
      });
    }, 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.turnInterval);
    clearInterval(this.cancelInterval);
  }

  handleConnection(client: Socket) {
    client.emit("connected", { socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    const room = this.roomsService.leaveRoom(client.id);
    if (!room) {
      this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
      return;
    }

    this.server.to(room.id).emit("roomUpdated", this.roomsService.toPublicRoom(room));
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
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
  getRoomState(@MessageBody() payload: GetRoomStatePayload, @ConnectedSocket() client: Socket) {
    const roomId = payload?.roomId?.trim();
    if (!roomId) {
      client.emit("errorMessage", { message: "Room invalide." });
      return;
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
    if (!roomId || !this.roomsService.roomExists(roomId)) {
      client.emit("errorMessage", { message: "Room introuvable." });
      return;
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

    const meta = await this.debateLifecycleService.getDebateMeta(roomId);
    if (meta && room) {
      this.roomsService.syncFromDbValidation(
        roomId,
        meta.validatedAt,
        meta.opponentJoinedAt,
      );
    }

    const updatedRoom = this.roomsService.getRoom(roomId);
    let opponentJustJoined = false;
    if (
      updatedRoom &&
      updatedRoom.participants.length >= 2 &&
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
      const metaAfter = await this.debateLifecycleService.getDebateMeta(roomId);
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

  @SubscribeMessage("validateDebateStart")
  async validateDebateStart(
    @MessageBody() payload: ValidateDebateStartPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.roomsService.getSession(client.id);
    if (!session) {
      client.emit("errorMessage", { message: "Vous devez rejoindre une room." });
      return;
    }

    const roomId = payload?.roomId?.trim();
    if (!roomId || session.roomId !== roomId) {
      client.emit("errorMessage", { message: "Room invalide." });
      return;
    }

    const accessToken = payload?.accessToken?.trim();
    if (!accessToken) {
      client.emit("errorMessage", {
        message: "Connectez-vous pour démarrer le débat.",
      });
      return;
    }

    let userId: string;
    try {
      userId = (await this.authService.getMe(accessToken)).id;
    } catch {
      client.emit("errorMessage", {
        message: "Session invalide ou expirée.",
      });
      return;
    }

    if (session.userId && session.userId !== userId) {
      client.emit("errorMessage", { message: "Session incohérente." });
      return;
    }

    try {
      await this.debateLifecycleService.validateDebateStart(roomId, userId);
    } catch (err) {
      const message =
        err instanceof HttpException
          ? (err.getResponse() as { message?: string }).message || err.message
          : "Impossible de démarrer le débat.";
      client.emit("errorMessage", {
        message: typeof message === "string" ? message : "Impossible de démarrer le débat.",
      });
      return;
    }

    const room = this.roomsService.startValidatedDebate(roomId);
    if (!room) {
      client.emit("errorMessage", { message: "Room introuvable." });
      return;
    }

    const snapshot = this.roomsService.toPublicRoom(room);
    this.server.to(roomId).emit("debateStarted", snapshot);
    this.server.to(roomId).emit("roomUpdated", snapshot);
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

  @SubscribeMessage("endDebate")
  async endDebate(
    @MessageBody() payload: EndDebatePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.roomsService.getSession(client.id);
    if (!session) {
      client.emit("errorMessage", { message: "Vous devez rejoindre une room." });
      return;
    }

    const roomId = payload?.roomId?.trim();
    if (!roomId || session.roomId !== roomId) {
      client.emit("errorMessage", { message: "Room invalide." });
      return;
    }

    const accessToken = payload?.accessToken?.trim();
    if (!accessToken) {
      client.emit("errorMessage", {
        message: "Connectez-vous pour mettre fin au débat.",
      });
      return;
    }

    let userId: string;
    try {
      userId = (await this.authService.getMe(accessToken)).id;
    } catch {
      client.emit("errorMessage", {
        message: "Session invalide ou expirée.",
      });
      return;
    }

    if (session.userId && session.userId !== userId) {
      client.emit("errorMessage", { message: "Session incohérente." });
      return;
    }

    const room = this.roomsService.getRoom(roomId);
    if (!room) {
      client.emit("errorMessage", { message: "Room introuvable." });
      return;
    }

    try {
      this.debateFinishService.assertCanEndDebate(room, session);
    } catch (err) {
      const message =
        err instanceof HttpException
          ? (err.getResponse() as { message?: string }).message || err.message
          : "Action refusée.";
      client.emit("errorMessage", {
        message: typeof message === "string" ? message : "Action refusée.",
      });
      return;
    }

    try {
      const sessions = this.roomsService.getSessionsInRoom(roomId);
      const { endedAt } = await this.debateFinishService.finishDebate(
        roomId,
        room,
        sessions,
      );
      this.roomsService.finishRoom(roomId, endedAt);
      const snapshot = this.roomsService.getRoomSnapshot(roomId);

      this.server.to(roomId).emit("debateEnded", {
        roomId,
        endedAt,
        snapshot,
      });
      this.server.to(roomId).emit("roomUpdated", snapshot);
      this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
    } catch (err) {
      const message =
        err instanceof HttpException
          ? (err.getResponse() as { message?: string }).message || err.message
          : "Impossible de terminer le débat.";
      client.emit("errorMessage", {
        message: typeof message === "string" ? message : "Impossible de terminer le débat.",
      });
    }
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
