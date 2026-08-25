"use client";

import Link from "next/link";
import { APP_NAME, PRODUCT_POSITIONING } from "@/lib/brand";

/**
 * Aperçu statique d'un échange, à droite du hero.
 *
 * Le hero n'occupait que la moitié gauche de l'écran, l'autre restait vide et
 * le premier aperçu du produit n'arrivait qu'après trois sections de défilement.
 * Ce fragment montre d'emblée ce qu'est un débat ici : deux camps identifiés,
 * un message chacun, un tour en cours.
 */
function HeroDebatePreview() {
  return (
    <aside className="hero-preview" aria-hidden="true">
      <div className="hero-preview-card">
        <div className="hero-preview-head">
          <span className="hero-preview-topic">Faut-il rendre le vote obligatoire ?</span>
          <span className="live-badge">En direct</span>
        </div>

        <div className="hero-preview-thread">
          <div className="hero-preview-msg stance-for">
            <div className="hero-preview-msg-head">
              <span className="stance-badge stance-badge--sm stance-for">Pour</span>
              <span className="hero-preview-author">Alice</span>
            </div>
            <p>Voter est un devoir civique : l&apos;abstention laisse décider une minorité.</p>
          </div>

          <div className="hero-preview-msg stance-against">
            <div className="hero-preview-msg-head">
              <span className="stance-badge stance-badge--sm stance-against">Contre</span>
              <span className="hero-preview-author">Bob</span>
            </div>
            <p>Contraindre le vote produit des bulletins, pas des citoyens informés.</p>
          </div>
        </div>

        <div className="hero-preview-foot">
          <span className="hero-preview-turn">
            <span className="hero-preview-dot" />
            Au tour d&apos;Alice
          </span>
          <span className="hero-preview-timer">04:12</span>
        </div>
      </div>
    </aside>
  );
}

export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="mkt-hero-grid" aria-hidden="true" />
      <div className="mkt-hero-glow" aria-hidden="true" />
      <div className="mkt-container landing-hero-inner">
        <div className="landing-hero-copy">
          <p className="mkt-kicker">{APP_NAME}</p>
          <h1 id="landing-hero-title" className="landing-hero-title">
            Apprenez à argumenter.
            <br />
            <span className="mkt-hero-title-accent">Pas à réagir.</span>
          </h1>
          <p className="landing-hero-lead">{PRODUCT_POSITIONING}</p>
          <div className="landing-hero-actions">
            <Link href="/start" className="btn btn-primary btn-lg landing-cta-primary">
              Lancer un débat
            </Link>
            <Link href="/explore" className="btn btn-secondary btn-lg">
              Explorer les débats
            </Link>
          </div>
          <p className="landing-hero-note">
            Deux participants · Tours de parole · Un message chacun · Modération en direct
          </p>
        </div>

        <HeroDebatePreview />
      </div>
    </section>
  );
}
