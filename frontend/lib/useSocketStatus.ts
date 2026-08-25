"use client";

import { useEffect, useState } from "react";
import { getSocket } from "./socket";

export type SocketStatus = "connecting" | "connected" | "offline";

/**
 * État de la connexion temps réel.
 *
 * Le serveur peut être en veille (hébergement à froid), injoignable ou coupé
 * par le réseau. Sans retour visible, l'utilisateur voit une application vide
 * ou figée sans comprendre pourquoi.
 */
export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    const socket = getSocket();
    setStatus(socket.connected ? "connected" : "connecting");

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("connecting");
    // Après plusieurs tentatives infructueuses, on cesse d'annoncer une
    // reconnexion imminente : le serveur est réellement injoignable.
    let failures = 0;
    const onError = () => {
      failures += 1;
      setStatus(failures >= 3 ? "offline" : "connecting");
    };
    const onReconnect = () => {
      failures = 0;
      setStatus("connected");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.io.off("reconnect", onReconnect);
    };
  }, []);

  return status;
}
