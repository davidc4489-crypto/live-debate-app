"use client";

import { useEffect, useState } from "react";
import { DebateDetail } from "@/lib/debate";
import { fetchDebate } from "@/lib/debates-api";
import { DebateReplayClient } from "./DebateReplayClient";
import { DebateRoomClient } from "./DebateRoomClient";

interface DebateRoomEntryProps {
  roomId: string;
}

type RoomView = "loading" | "replay" | "live";

export function DebateRoomEntry({ roomId }: DebateRoomEntryProps) {
  const [view, setView] = useState<RoomView>("loading");
  const [replayDebate, setReplayDebate] = useState<DebateDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveView() {
      setView("loading");
      setReplayDebate(null);

      try {
        const debate = await fetchDebate(roomId);
        if (cancelled) return;

        if (debate?.status === "finished") {
          setReplayDebate(debate);
          setView("replay");
          return;
        }
      } catch {
        if (cancelled) return;
      }

      setView("live");
    }

    void resolveView();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (view === "loading") {
    return <p className="muted">Chargement du débat…</p>;
  }

  if (view === "replay" && replayDebate) {
    return <DebateReplayClient debate={replayDebate} />;
  }

  return <DebateRoomClient roomId={roomId} />;
}
