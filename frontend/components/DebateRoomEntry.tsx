"use client";

import { useEffect, useState } from "react";
import { DebateDetail } from "@/lib/debate";
import { fetchDebate } from "@/lib/debates-api";
import { DebatePlanningClient } from "./DebatePlanningClient";
import { DebateReplayClient } from "./DebateReplayClient";
import { DebateRoomClient } from "./DebateRoomClient";

interface DebateRoomEntryProps {
  roomId: string;
}

type RoomView = "loading" | "replay" | "planning" | "live";

export function DebateRoomEntry({ roomId }: DebateRoomEntryProps) {
  const [view, setView] = useState<RoomView>("loading");
  const [dbDebate, setDbDebate] = useState<DebateDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveView() {
      setView("loading");
      setDbDebate(null);

      try {
        const debate = await fetchDebate(roomId);
        if (cancelled) return;

        if (debate) {
          setDbDebate(debate);
          if (debate.status === "finished") {
            setView("replay");
            return;
          }
          if (debate.status === "proposed" || debate.status === "scheduled") {
            setView("planning");
            return;
          }
          if (debate.status === "cancelled") {
            setView("live");
            return;
          }
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

  if (view === "replay" && dbDebate) {
    return <DebateReplayClient debate={dbDebate} />;
  }

  if (view === "planning" && dbDebate) {
    return <DebatePlanningClient debate={dbDebate} />;
  }

  return <DebateRoomClient roomId={roomId} dbDebate={dbDebate} />;
}
