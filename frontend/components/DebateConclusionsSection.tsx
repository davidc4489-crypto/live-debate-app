"use client";

import { DebateConclusion } from "@/lib/debate";

interface DebateConclusionsSectionProps {
  conclusions: DebateConclusion[];
}

export function DebateConclusionsSection({ conclusions }: DebateConclusionsSectionProps) {
  if (conclusions.length === 0) {
    return (
      <section className="card debate-conclusions-section">
        <h3>Conclusions des participants</h3>
        <p className="muted">Aucune conclusion publiée pour le moment.</p>
      </section>
    );
  }

  return (
    <section className="card debate-conclusions-section">
      <h3>Conclusions des participants</h3>
      <div className="debate-conclusions-list">
        {conclusions.map((conclusion) => (
          <article key={conclusion.id} className="debate-conclusion-item">
            <div className="bubble-head">
              <strong>{conclusion.displayName}</strong>
            </div>
            <p>{conclusion.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
