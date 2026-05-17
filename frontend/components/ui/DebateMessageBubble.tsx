"use client";

export interface ThreadMessage {
  id: string;
  author: string;
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

  return (
    <article className={`debate-message ${sideClass} ${selfClass}`.trim()}>
      <div className="debate-message-meta">
        <strong className="text-ink-secondary">{message.author}</strong>
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
