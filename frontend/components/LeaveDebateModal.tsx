"use client";

import { useEffect } from "react";

interface LeaveDebateModalProps {
  open: boolean;
  loading?: boolean;
  /** Créateur seul en attente : quitter annule le débat */
  cancelOnly?: boolean;
  onPause: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

export function LeaveDebateModal({
  open,
  loading = false,
  cancelOnly = false,
  onPause,
  onFinish,
  onCancel,
}: LeaveDebateModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="auth-overlay" onClick={onCancel} role="presentation">
      <div
        className="auth-modal leave-debate-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="leave-debate-title"
        aria-modal="true"
      >
        <h2 id="leave-debate-title">Quitter le débat</h2>
        {cancelOnly ? (
          <p className="muted">
            Vous êtes seul en attente d&apos;un adversaire. Si vous quittez, le débat sera
            annulé (il pourra être reproposé plus tard).
          </p>
        ) : (
          <p className="muted">
            Choisissez comment quitter : mettre en pause pour une reprise ultérieure, ou terminer
            définitivement l&apos;échange (conclusions de chaque participant).
          </p>
        )}
        <div className="leave-debate-actions">
          {cancelOnly ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onFinish}
              disabled={loading}
            >
              {loading ? "…" : "Quitter le débat"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onPause}
                disabled={loading}
              >
                {loading ? "…" : "Mettre en pause"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onFinish}
                disabled={loading}
              >
                {loading ? "…" : "Terminer le débat"}
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
