"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001", {
      /*
       * `polling` d'abord, puis bascule automatique en `websocket`.
       *
       * En n'autorisant que le WebSocket, la connexion échouait en silence
       * derrière les proxys d'entreprise et sur les réseaux mobiles qui le
       * bloquent : l'application semblait simplement vide. Le repli en long
       * polling garantit que le débat fonctionne partout, un peu plus lentement.
       */
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      timeout: 12_000,
    });
  }
  return socket;
}
