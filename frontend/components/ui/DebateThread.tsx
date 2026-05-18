"use client";

import { DebateMessageBubble, ThreadMessage } from "./DebateMessageBubble";

interface DebateThreadProps {
  messages: ThreadMessage[];
  currentUserLabel?: string;
  emptyLabel?: string;
  renderHeaderAction?: (message: ThreadMessage) => React.ReactNode;
}

export function DebateThread({
  messages,
  currentUserLabel,
  emptyLabel = "Aucun message pour le moment. L'échange commencera dès que les participants prendront la parole.",
  renderHeaderAction,
}: DebateThreadProps) {
  if (messages.length === 0) {
    return <p className="muted py-8 text-center text-sm leading-relaxed">{emptyLabel}</p>;
  }

  return (
    <div className="debate-thread">
      {messages.map((message, index) => {
        const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
        const isSelf = Boolean(currentUserLabel && message.author === currentUserLabel);
        const turnNumber = Math.floor(index / 2) + 1;
        const turnLabel = `Tour ${turnNumber} · ${message.author}`;

        return (
          <DebateMessageBubble
            key={message.id}
            message={message}
            side={side}
            isSelf={isSelf}
            turnLabel={turnLabel}
            headerAction={renderHeaderAction?.(message)}
          />
        );
      })}
    </div>
  );
}
