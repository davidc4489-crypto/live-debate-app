"use client";

import { MessageInsight, isPositiveSignal, scoreTone, signalLabel } from "@/lib/moderation";

interface MessageInsightHintProps {
  insight: MessageInsight | null;
  onDismiss: () => void;
}

/**
 * Retour privé à l'auteur après l'envoi : score d'argumentation et pistes
 * d'amélioration. Jamais bloquant — le message est déjà publié.
 */
export function MessageInsightHint({ insight, onDismiss }: MessageInsightHintProps) {
  if (!insight) return null;

  const tone = scoreTone(insight.qualityScore);
  const signals = insight.signals.slice(0, 3);

  return (
    <aside className={`message-insight message-insight-${tone}`} aria-live="polite">
      <div className="message-insight-head">
        <span className="message-insight-score">{insight.qualityScore}</span>
        <div>
          <p className="message-insight-title">Argumentation : {insight.qualityLabel}</p>
          {signals.length > 0 ? (
            <ul className="message-insight-signals">
              {signals.map((signal) => (
                <li
                  key={signal}
                  className={isPositiveSignal(signal) ? "signal-positive" : "signal-negative"}
                >
                  {isPositiveSignal(signal) ? "✓" : "!"} {signalLabel(signal)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          className="message-insight-close"
          onClick={onDismiss}
          aria-label="Masquer le retour sur mon message"
        >
          ×
        </button>
      </div>
      {insight.tips.length > 0 ? (
        <ul className="message-insight-tips">
          {insight.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
