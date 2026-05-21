import { HttpException } from "@nestjs/common";
import { Socket } from "socket.io";
import { AuthService } from "./auth/auth.service";
import { SocketSession } from "./types";

export interface AuthenticatedRoomContext<TPayload> {
  client: Socket;
  session: SocketSession;
  userId: string;
  roomId: string;
  payload: TPayload;
}

export interface WithAuthenticatedRoomOptions<TPayload> {
  missingTokenMessage?: string;
  /** Comme validateDebateStart : session sans userId autorisée si le token correspond. */
  allowGuestSession?: boolean;
  /** Validation métier avant getMe (ex. action pause|finish + token). */
  validateBeforeAuth?: (payload: TPayload) => string | null;
}

export interface GatewaySessionDeps {
  authService: AuthService;
  getSession: (socketId: string) => SocketSession | undefined;
  emitError: (client: Socket, message: string) => void;
}

export function httpExceptionMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpException) {
    const response = err.getResponse() as { message?: string };
    const message = response?.message || err.message;
    return typeof message === "string" ? message : fallback;
  }
  return fallback;
}

export async function withAuthenticatedRoomSession<
  TPayload extends { roomId?: string; accessToken?: string },
>(
  deps: GatewaySessionDeps,
  client: Socket,
  payload: TPayload | undefined,
  options: WithAuthenticatedRoomOptions<TPayload>,
  handler: (ctx: AuthenticatedRoomContext<TPayload>) => void | Promise<void>,
): Promise<void> {
  const session = deps.getSession(client.id);
  if (!session) {
    deps.emitError(client, "Vous devez rejoindre une room.");
    return;
  }

  const roomId = payload?.roomId?.trim();
  if (!roomId || session.roomId !== roomId) {
    deps.emitError(client, "Room invalide.");
    return;
  }

  if (options.validateBeforeAuth) {
    const validationError = options.validateBeforeAuth(payload as TPayload);
    if (validationError) {
      deps.emitError(client, validationError);
      return;
    }
  }

  const accessToken = payload?.accessToken?.trim();
  if (!accessToken) {
    deps.emitError(
      client,
      options.missingTokenMessage ??
        "Connectez-vous pour effectuer cette action.",
    );
    return;
  }

  let userId: string;
  try {
    userId = (await deps.authService.getMe(accessToken)).id;
  } catch {
    deps.emitError(client, "Session invalide ou expirée.");
    return;
  }

  if (options.allowGuestSession) {
    if (session.userId && session.userId !== userId) {
      deps.emitError(client, "Session incohérente.");
      return;
    }
  } else if (session.userId !== userId) {
    deps.emitError(client, "Session incohérente.");
    return;
  }

  await handler({
    client,
    session,
    userId,
    roomId,
    payload: payload as TPayload,
  });
}

export async function runEmittingHttpErrors(
  emitError: (client: Socket, message: string) => void,
  client: Socket,
  fallback: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    emitError(client, httpExceptionMessage(err, fallback));
  }
}
