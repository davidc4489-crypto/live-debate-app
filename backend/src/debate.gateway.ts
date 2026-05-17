import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { OnModuleDestroy } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import {
  CreateRoomPayload,
  DeleteMessagePayload,
  GetRoomStatePayload,
  JoinRoomPayload,
  SendMessagePayload,
} from "./dto/events";
import { AuthService } from "./auth/auth.service";
import { MessageFlagsService } from "./moderation/message-flags.service";
import { ModerationService } from "./moderation/moderation.service";
import { RoomsService } from "./rooms.service";

@WebSocketGateway({
  cors: { origin: "*" },
})
export class DebateGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private turnInterval: NodeJS.Timeout;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly authService: AuthService,
    private readonly moderationService: ModerationService,
    private readonly messageFlagsService: MessageFlagsService,
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
  }

  onModuleDestroy() {
    clearInterval(this.turnInterval);
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
    client.emit("roomUpdated", this.roomsService.getRoomSnapshot(roomId));
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

    try {
      await this.authService.getMe(accessToken);
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

    const room = this.roomsService.createRoom(title, payload.roomId, turnDuration);
    client.emit("roomCreated", this.roomsService.toPublicRoom(room));
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

  @SubscribeMessage("joinRoom")
  joinRoom(@MessageBody() payload: JoinRoomPayload, @ConnectedSocket() client: Socket) {
    const roomId = payload?.roomId?.trim();
    if (!roomId || !this.roomsService.roomExists(roomId)) {
      client.emit("errorMessage", { message: "Room introuvable." });
      return;
    }

    client.join(roomId);
    const session = this.roomsService.joinRoom(roomId, client.id, payload?.username);
    const roomSnapshot = this.roomsService.getRoomSnapshot(roomId);

    client.emit("joinedRoom", {
      roomId,
      role: session.role,
      displayName: session.displayName,
    });
    this.server.to(roomId).emit("roomUpdated", roomSnapshot);
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
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

    this.server.to(session.roomId).emit("turnChanged", switchedSnapshot);
    this.server.to(session.roomId).emit("roomUpdated", switchedSnapshot);
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }

  @SubscribeMessage("deleteMessage")
  deleteMessage(@MessageBody() payload: DeleteMessagePayload, @ConnectedSocket() client: Socket) {
    const session = this.roomsService.getSession(client.id);
    if (!session) {
      client.emit("errorMessage", { message: "Vous devez rejoindre une room." });
      return;
    }

    if (session.roomId !== payload?.roomId) {
      client.emit("errorMessage", { message: "Room invalide pour cette suppression." });
      return;
    }

    const deleted = this.roomsService.deleteMessage(payload.roomId, payload.messageId);
    if (!deleted) {
      client.emit("errorMessage", { message: "Message introuvable." });
      return;
    }

    const snapshot = this.roomsService.getRoomSnapshot(payload.roomId);
    this.server.to(payload.roomId).emit("roomUpdated", snapshot);
    this.server.emit("roomsUpdated", this.roomsService.getRoomsSnapshot());
  }
}
