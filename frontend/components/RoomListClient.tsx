"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { RoomSnapshot } from "@/lib/types";

export function RoomListClient() {
  const [rooms, setRooms] = useState<RoomSnapshot[]>([]);
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onRoomsUpdated = (nextRooms: RoomSnapshot[]) => setRooms(nextRooms);
    const onError = (payload: { message: string }) => setError(payload.message);

    socket.on("roomsUpdated", onRoomsUpdated);
    socket.on("errorMessage", onError);

    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}/rooms`)
      .then((response) => response.json())
      .then((data: RoomSnapshot[]) => setRooms(data))
      .catch(() => setError("Impossible de charger les rooms."));

    socket.emit("getRooms");

    return () => {
      socket.off("roomsUpdated", onRoomsUpdated);
      socket.off("errorMessage", onError);
    };
  }, []);

  function handleCreateRoom() {
    setError("");
    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    setLoading(true);
    const socket = getSocket();
    socket.emit("createRoom", { title, roomId: roomId.trim() || undefined });
    setTimeout(() => {
      setLoading(false);
      setTitle("");
      setRoomId("");
    }, 250);
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Créer une room</h2>
        <div className="row">
          <input
            placeholder="Titre de la room"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            placeholder="Room ID (optionnel)"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
          />
          <button onClick={handleCreateRoom} disabled={loading}>
            {loading ? "Création..." : "Créer"}
          </button>
        </div>
        {error ? <p className="muted">{error}</p> : null}
      </section>

      <section className="card stack">
        <h2>Rooms actives</h2>
        {rooms.length === 0 ? <p className="muted">Aucune room active.</p> : null}
        <div className="room-grid">
          {rooms.map((room) => (
            <div key={room.id} className="message">
              <h3>{room.title}</h3>
              <p className="muted">ID: {room.id}</p>
              <p>
                Participants: {room.participants} | Spectateurs: {room.spectators}
              </p>
              <Link href={`/room/${room.id}`} className="link">
                <button>Rejoindre</button>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
