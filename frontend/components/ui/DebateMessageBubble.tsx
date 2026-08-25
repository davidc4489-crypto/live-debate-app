"use client";

import { DebateStance, STANCE_LABEL, stanceClass } from "@/lib/debate";

export interface ThreadMessage {
  id: string;
  author: string;
  /** Identité de l'auteur, quand elle est connue (homonymes). */
  authorUserId?: string | null;
  /** Camp défendu par l'auteur : colore la bulle et son en-tête. */
  authorStance?: DebateStance | null;
  text: string;
  turnIndex?: number;
}

interface DebateMessageBubbleProps {
  message: ThreadMessage;
  side: "left" | "right";
  isSelf?: boolean;
  showTurnBadge?: boolean;
  turnLabel?: string;
  headerAction?: React.ReactNode;
}

export function DebateMessageBubble({
  message,
  side,
  isSelf = false,
  showTurnBadge = true,
  turnLabel,
  headerAction,
}: DebateMessageBubbleProps) {
  const sideClass = side === "right" ? "debate-message--right" : "debate-message--left";
  const selfClass = isSelf ? "debate-message--self" : "";
  const stance = message.authorStance ?? null;

  return (
    <article
      className={`debate-message ${sideClass} ${selfClass} ${stanceClass(stance)}`.trim()}
    >
      <div className="debate-message-meta">
        <strong className="text-ink-secondary">{message.author}</strong>
        {stance ? (
          <span className={`stance-badge stance-badge--sm ${stanceClass(stance)}`}>
            {STANCE_LABEL[stance]}
          </span>
        ) : null}
        {showTurnBadge && turnLabel ? (
          <span className="turn-badge">{turnLabel}</span>
        ) : null}
        {headerAction}
      </div>
      <div className="debate-message-card">
        <p className="m-0 whitespace-pre-wrap">{message.text}</p>
      </div>
    </article>
  );
}
