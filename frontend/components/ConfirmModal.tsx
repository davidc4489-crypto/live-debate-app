"use client";

import { useEffect } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Bouton de confirmation en style d'alerte (refus, suppression, etc.) */
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  loading = false,
  confirmDanger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const titleId = "confirm-modal-title";

  return (
    <div className="auth-overlay" onClick={loading ? undefined : onCancel} role="presentation">
      <div
        className="auth-modal confirm-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onCancel}
          disabled={loading}
          aria-label="Fermer"
        >
          ×
        </button>
        <h2 id={titleId}>{title}</h2>
        <p className="muted auth-modal-subtitle">{message}</p>
        <div className="notebook-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmDanger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "En cours…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
