"use client";

import { useEffect, useState } from "react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ParticipantPill } from "@/components/ParticipantPill";
import { DebateConclusionsSection } from "@/components/DebateConclusionsSection";
import { DebateProgress } from "@/components/ui/DebateProgress";
import { DebateThread } from "@/components/ui/DebateThread";
import { DebateDetail, formatDebateDate } from "@/lib/debate";
import { addFavorite, fetchFavoriteIds, removeFavorite } from "@/lib/favorites-api";
import { useAuthSession } from "@/lib/useAuthSession";
import { DebateNoteSection } from "./DebateNoteSection";

interface DebateReplayClientProps {
  debate: DebateDetail;
}

export function DebateReplayClient({ debate }: DebateReplayClientProps) {
  const { user } = useAuthSession();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteMessageId, setNoteMessageId] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsFavorite(false);
      return;
    }

    let cancelled = false;

    async function loadFavoriteState() {
      try {
        const ids = await fetchFavoriteIds();
        if (!cancelled) setIsFavorite(ids.includes(debate.id));
      } catch {
        if (!cancelled) setIsFavorite(false);
      }
    }

    void loadFavoriteState();
    return () => {
      cancelled = true;
    };
  }, [user, debate.id]);

  async function handleFavoriteToggle() {
    if (!user) return;

    const nextFavorite = !isFavorite;
    setFavoriteLoading(true);
    setIsFavorite(nextFavorite);

    try {
      if (nextFavorite) {
        await addFavorite(debate.id);
      } else {
        await removeFavorite(debate.id);
      }
    } catch {
      setIsFavorite(!nextFavorite);
    } finally {
      setFavoriteLoading(false);
    }
  }

  function openNoteForMessage(messageId: string) {
    setNoteMessageId(messageId);
    setNoteOpen(true);
    document.getElementById("debate-note-section")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="chat-layout reveal">
      <section className="chat-header card debate-replay-header">
        <div>
          <div className="card-topline">
            <div className="card-topline-badges">
              <span className="theme-badge">{debate.theme}</span>
              <span className="finished-badge">Débat terminé</span>
            </div>
            {user ? (
              <FavoriteButton
                isFavorite={isFavorite}
                disabled={favoriteLoading}
                onClick={() => void handleFavoriteToggle()}
              />
            ) : null}
          </div>
          <h2>{debate.title}</h2>
          <p className="muted debate-replay-subtitle">
            {debate.endedAt
              ? `Clôturé ${formatDebateDate(debate.endedAt)}`
              : "Relecture de l'échange entre les deux participants"}
          </p>

          <DebateProgress
            messageCount={debate.messages.length}
            status="finished"
            participantCount={2}
          />

          <div className="participants debate-replay-participants">
            {debate.participants.map((participant) => (
              <ParticipantPill
                key={participant.userId ?? participant.displayName}
                participant={participant}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="chat-stream card">
        <DebateThread
          messages={debate.messages.map((message) => ({
            id: message.id,
            author: message.author,
            text: message.text,
          }))}
          emptyLabel="Aucun message enregistré pour ce débat."
          renderHeaderAction={(message) =>
            user ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => openNoteForMessage(message.id)}
              >
                Noter
              </button>
            ) : null
          }
        />
      </section>

      <DebateConclusionsSection conclusions={debate.conclusions ?? []} />

      <DebateNoteSection
        debateId={debate.id}
        debateTitle={debate.title}
        messages={debate.messages}
        open={noteOpen}
        prefillMessageId={noteMessageId}
        onOpenChange={(open) => {
          setNoteOpen(open);
          if (!open) setNoteMessageId("");
        }}
      />

      <section className="card debate-replay-footer">
        <p className="muted">Ce débat est terminé. La relecture est en lecture seule.</p>
      </section>
    </div>
  );
}
