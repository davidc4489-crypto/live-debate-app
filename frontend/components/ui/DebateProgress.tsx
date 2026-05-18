"use client";

interface DebateProgressProps {
  messageCount: number;
  status: "pending" | "active" | "finished";
  participantCount?: number;
  currentSpeakerName?: string | null;
}

export function DebateProgress({
  messageCount,
  status,
  participantCount = 0,
  currentSpeakerName,
}: DebateProgressProps) {
  const targetMessages = 12;
  const progress = Math.min(100, Math.round((messageCount / targetMessages) * 100));

  const statusLabel =
    status === "finished"
      ? "Débat terminé"
      : status === "pending"
        ? participantCount < 2
          ? "En attente du second participant"
          : "En attente de validation du créateur"
        : currentSpeakerName
          ? `Tour de ${currentSpeakerName}`
          : "Échange en cours";

  return (
    <div className="debate-progress" aria-label="Progression du débat">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-ink-secondary">{statusLabel}</span>
        <span className="text-ink-muted">
          {messageCount} message{messageCount !== 1 ? "s" : ""}
          {status !== "finished" ? ` · ${progress}%` : ""}
        </span>
      </div>
      {status !== "finished" ? (
        <div className="debate-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="debate-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}
