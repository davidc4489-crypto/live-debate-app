"use client";

interface ParticipantAbsentModalProps {
  open: boolean;
  absentDisplayName: string;
  loading?: boolean;
  onPause: () => void;
  onFinish: () => void;
}

export function ParticipantAbsentModal({
  open,
  absentDisplayName,
  loading = false,
  onPause,
  onFinish,
}: ParticipantAbsentModalProps) {
  if (!open) return null;

  return (
    <div className="auth-overlay" role="presentation">
      <div
        className="auth-modal participant-absent-modal"
        role="dialog"
        aria-labelledby="absent-debate-title"
        aria-describedby="absent-debate-desc"
        aria-modal="true"
      >
        <h2 id="absent-debate-title">Participant absent</h2>
        <p id="absent-debate-desc" className="muted">
          <strong>{absentDisplayName}</strong> a quitté le débat. Choisissez de mettre en pause pour une
          reprise ultérieure, ou de terminer définitivement l&apos;échange.
        </p>
        <div className="leave-debate-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onPause}
            disabled={loading}
          >
            {loading ? "…" : "Plus tard"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onFinish}
            disabled={loading}
          >
            {loading ? "…" : "Terminer le débat"}
          </button>
        </div>
      </div>
    </div>
  );
}
