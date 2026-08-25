"use client";

import { DebateMessageBubble, ThreadMessage } from "./DebateMessageBubble";

/** Identifie un auteur : son id s'il en a un, sinon son nom affiché. */
function authorKey(message: ThreadMessage): string {
  return message.authorUserId ?? `name:${message.author}`;
}

function firstAuthorKey(messages: ThreadMessage[]): string {
  return authorKey(messages[0]);
}

interface DebateThreadProps {
  messages: ThreadMessage[];
  currentUserLabel?: string;
  /** Identité du lecteur — prioritaire sur le nom affiché (homonymes). */
  currentUserId?: string | null;
  emptyLabel?: string;
  renderHeaderAction?: (message: ThreadMessage) => React.ReactNode;
}

export function DebateThread({
  messages,
  currentUserLabel,
  currentUserId,
  emptyLabel = "Aucun message pour le moment. L'échange commencera dès que les participants prendront la parole.",
  renderHeaderAction,
}: DebateThreadProps) {
  if (messages.length === 0) {
    return <p className="muted py-8 text-center text-sm leading-relaxed">{emptyLabel}</p>;
  }

  // Chaque auteur compte ses propres tours : le tour N est le N-ième message
  // de cet auteur, indépendamment de ce qu'a fait (ou non) son adversaire.
  const perAuthorCount = new Map<string, number>();
  const turnNumbers = messages.map((message) => {
    const key = authorKey(message);
    const next = (perAuthorCount.get(key) ?? 0) + 1;
    perAuthorCount.set(key, next);
    return next;
  });

  return (
    <div className="debate-thread">
      {messages.map((message, index) => {
        const isSelf =
          currentUserId && message.authorUserId
            ? message.authorUserId === currentUserId
            : Boolean(currentUserLabel && message.author === currentUserLabel);

        // Côté et numéro de tour déduits de l'auteur, pas de la parité de
        // l'index : un tour écoulé sans message faisait basculer un même
        // auteur d'un côté à l'autre et dédoublait le numéro de tour.
        const previous = index > 0 ? messages[index - 1] : null;
        const side: "left" | "right" = firstAuthorKey(messages) === authorKey(message)
          ? "left"
          : "right";
        const turnNumber =
          previous && authorKey(previous) === authorKey(message)
            ? turnNumbers[index - 1]
            : turnNumbers[index];
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
