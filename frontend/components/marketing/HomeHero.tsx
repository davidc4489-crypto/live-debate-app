"use client";

import { APP_NAME } from "@/lib/brand";

interface HomeHeroProps {
  onCreateDebate: () => void;
}

export function HomeHero({ onCreateDebate }: HomeHeroProps) {
  return (
    <section className="mkt-hero" aria-labelledby="home-hero-title">
      <div className="mkt-hero-glow" aria-hidden="true" />
      <div className="mkt-container mkt-hero-inner">
        <p className="mkt-kicker">{APP_NAME}</p>
        <h1 id="home-hero-title" className="mkt-hero-title">
          Penser avant
          <br />
          de répondre.
        </h1>
        <p className="mkt-hero-lead">
          Débats structurés en direct : tours de parole, modération attentive et conclusions
          partagées. Une alternative sobre au bruit des réseaux sociaux.
        </p>
        <div className="mkt-hero-actions">
          <a href="#debates" className="btn btn-primary btn-lg">
            Explorer les débats
          </a>
          <button type="button" className="btn btn-secondary btn-lg" onClick={onCreateDebate}>
            Lancer un débat
          </button>
        </div>
        <div className="mkt-hero-metrics" aria-label="Points clés">
          <div className="mkt-metric">
            <span className="mkt-metric-value">Tours</span>
            <span className="mkt-metric-label">Parole chronométrée</span>
          </div>
          <div className="mkt-metric-divider" aria-hidden="true" />
          <div className="mkt-metric">
            <span className="mkt-metric-value">Planifié</span>
            <span className="mkt-metric-label">Ou en direct</span>
          </div>
          <div className="mkt-metric-divider" aria-hidden="true" />
          <div className="mkt-metric">
            <span className="mkt-metric-value">Conclusions</span>
            <span className="mkt-metric-label">Synthèse de fin</span>
          </div>
        </div>
      </div>
    </section>
  );
}
