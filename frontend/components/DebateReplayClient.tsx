"use client";

import { DebateDetail, formatDebateDate } from "@/lib/debate";

interface DebateReplayClientProps {
  debate: DebateDetail;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DebateReplayClient({ debate }: DebateReplayClientProps) {
  return (
    <div className="chat-layout reveal">
      <section className="chat-header card debate-replay-header">
        <div>
          <div className="card-topline">
            <span className="theme-badge">{debate.theme}</span>
            <span className="finished-badge">Débat terminé</span>
          </div>
          <h2>{debate.title}</h2>
          <p className="muted debate-replay-subtitle">
            {debate.endedAt
              ? `Clôturé ${formatDebateDate(debate.endedAt)}`
              : "Relecture de l'échange entre les deux participants"}
          </p>

          <div className="participants debate-replay-participants">
            {debate.participants.map((participant) => (
              <div key={participant} className="participant-pill">
                <span className="avatar">{initials(participant)}</span>
                <span>{participant}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="chat-stream card">
        {debate.messages.length === 0 ? (
          <p className="muted">Aucun message enregistré pour ce débat.</p>
        ) : (
          <div className="chat-messages">
            {debate.messages.map((message) => (
              <article className="chat-bubble" key={message.id}>
                <div className="bubble-head">
                  <strong>{message.author}</strong>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card debate-replay-footer">
        <p className="muted">Ce débat est terminé. La relecture est en lecture seule.</p>
      </section>
    </div>
  );
}
