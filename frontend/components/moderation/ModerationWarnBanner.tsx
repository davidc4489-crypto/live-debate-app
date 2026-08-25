"use client";

import { ModerationWarnPayload, categoryLabel } from "@/lib/moderation";

interface ModerationWarnBannerProps {
  warn: ModerationWarnPayload;
  onEdit: () => void;
  onSendAnyway: () => void;
}

/**
 * Avertissement de modération : explique *pourquoi* le message est signalé et
 * propose une reformulation, plutôt que de se contenter d'un refus opaque.
 */
export function ModerationWarnBanner({ warn, onEdit, onSendAnyway }: ModerationWarnBannerProps) {
  const categories = warn.categories ?? [];
  const severity = Math.round((warn.severity ?? warn.scores?.toxicity ?? 0) * 100);

  return (
    <section className="card moderation-warn-banner" role="alert" aria-live="assertive">
      <div className="moderation-warn-head">
        <span aria-hidden="true" className="moderation-warn-icon">
          ⚠️
        </span>
        <p className="moderation-warn-title">{warn.message}</p>
      </div>

      {categories.length > 0 ? (
        <ul className="moderation-chips" aria-label="Signaux détectés">
          {categories.map((category) => (
            <li key={category} className="moderation-chip">
              {categoryLabel(category)}
            </li>
          ))}
        </ul>
      ) : null}

      {warn.suggestion ? <p className="moderation-warn-tip">💡 {warn.suggestion}</p> : null}

      {severity > 0 ? (
        <div
          className="moderation-severity"
          role="meter"
          aria-valuenow={severity}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Gravité estimée du message"
        >
          <span className="moderation-severity-label">Gravité estimée</span>
          <div className="moderation-severity-track">
            <div className="moderation-severity-fill" style={{ width: `${severity}%` }} />
          </div>
          <span className="moderation-severity-value">{severity}%</span>
        </div>
      ) : null}

      <div className="moderation-warn-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>
          Reformuler
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSendAnyway}>
          Envoyer quand même
        </button>
      </div>
    </section>
  );
}
