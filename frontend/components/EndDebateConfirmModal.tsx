"use client";

interface EndDebateConfirmModalProps {
  open: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndDebateConfirmModal({
  open,
  loading = false,
  onConfirm,
  onCancel,
}: EndDebateConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="auth-overlay" onClick={onCancel} role="presentation">
      <div
        className="card auth-modal end-debate-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="end-debate-title"
        aria-modal="true"
      >
        <h2 id="end-debate-title">Mettre fin au débat ?</h2>
        <p className="muted">
          Le débat sera clôturé pour tous les participants. Chacun pourra ensuite rédiger sa
          conclusion sur l&apos;échange.
        </p>
        <div className="notebook-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? "Clôture…" : "Terminer le débat"}
          </button>
        </div>
      </div>
    </div>
  );
}
