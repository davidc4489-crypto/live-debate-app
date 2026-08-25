"use client";

import { DebateInsights, scoreTone } from "@/lib/moderation";

interface DebateInsightsBarProps {
  insights: DebateInsights | null;
}

const TREND_LABEL: Record<DebateInsights["trend"], string> = {
  up: "↗︎ en progression",
  down: "↘︎ en baisse",
  stable: "→ stable",
};

function Gauge({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className={`insight-gauge insight-gauge-${scoreTone(value)}`}>
      <div className="insight-gauge-head">
        <span className="insight-gauge-label">{label}</span>
        <span className="insight-gauge-value">{value}</span>
      </div>
      <div
        className="insight-gauge-track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} : ${value} sur 100`}
      >
        <div className="insight-gauge-fill" style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <p className="insight-gauge-hint">{hint}</p>
    </div>
  );
}

/**
 * Indicateurs live du débat : civilité (modération) et qualité argumentative
 * (analyse linguistique). Ils rendent visible ce que la modération mesure, au
 * lieu de n'agir qu'en cas de blocage.
 */
export function DebateInsightsBar({ insights }: DebateInsightsBarProps) {
  if (!insights || insights.messagesAnalyzed === 0) return null;

  return (
    <section className="card debate-insights" aria-label="Indicateurs du débat">
      <header className="debate-insights-head">
        <h3>Climat du débat</h3>
        <span className="debate-insights-meta">
          {insights.messagesAnalyzed} message{insights.messagesAnalyzed > 1 ? "s" : ""} analysé
          {insights.messagesAnalyzed > 1 ? "s" : ""} · {TREND_LABEL[insights.trend]}
        </span>
      </header>
      <div className="debate-insights-gauges">
        <Gauge
          label="Civilité"
          value={insights.civilityScore}
          hint="Absence de propos toxiques détectés"
        />
        <Gauge
          label="Qualité des arguments"
          value={insights.qualityScore}
          hint="Structure, preuves et nuance des messages"
        />
      </div>
    </section>
  );
}
