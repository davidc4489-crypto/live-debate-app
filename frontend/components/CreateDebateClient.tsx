"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

interface CreatedRoomPayload {
  id: string;
  title: string;
}

export function CreateDebateClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnDuration, setTurnDuration] = useState<180 | 300 | 600>(180);
  const createTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    function onRoomCreated(room: CreatedRoomPayload) {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      router.push(`/room/${room.id}`);
    }

    function onErrorMessage(payload: { message: string }) {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      setError(payload.message || "Impossible de creer le debat.");
    }

    function onConnectError() {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      setError("Connexion backend impossible. Verifiez que le serveur tourne.");
    }

    socket.on("roomCreated", onRoomCreated);
    socket.on("errorMessage", onErrorMessage);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("roomCreated", onRoomCreated);
      socket.off("errorMessage", onErrorMessage);
      socket.off("connect_error", onConnectError);
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
      }
    };
  }, [router]);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Le titre du debat est requis.");
      return;
    }

    setLoading(true);
    createTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError("Aucune reponse du serveur. Reessayez.");
    }, 6000);

    getSocket().emit("createRoom", {
      title: title.trim(),
      roomId: roomId.trim() || undefined,
      turnDuration,
    });
  }

  return (
    <div className="stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour a l'accueil
      </Link>

      <section className="card create-debate-card reveal">
        <h1>Creer un nouveau debat</h1>
        <p className="muted">Donnez un titre, puis lancez la room en direct.</p>

        <form className="create-form" onSubmit={handleCreate}>
          <label htmlFor="debate-title">Titre du debat</label>
          <input
            id="debate-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: L'IA doit-elle etre strictement regulee ?"
          />

          <label htmlFor="room-id">ID room (optionnel)</label>
          <input
            id="room-id"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="Ex: debat-ia-001"
          />

          <label htmlFor="turn-duration">Duree de tour</label>
          <select
            id="turn-duration"
            value={turnDuration}
            onChange={(event) => setTurnDuration(Number(event.target.value) as 180 | 300 | 600)}
          >
            <option value={180}>3 minutes</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
          </select>

          {error ? <p className="muted">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Creation..." : "Creer le debat"}
          </button>
        </form>
      </section>
    </div>
  );
}
