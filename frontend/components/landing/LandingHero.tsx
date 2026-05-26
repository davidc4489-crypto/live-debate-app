"use client";

import Link from "next/link";
import { APP_NAME, PRODUCT_POSITIONING } from "@/lib/brand";

export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="mkt-hero-grid" aria-hidden="true" />
      <div className="mkt-hero-glow" aria-hidden="true" />
      <div className="mkt-container landing-hero-inner">
        <p className="mkt-kicker">{APP_NAME}</p>
        <h1 id="landing-hero-title" className="landing-hero-title">
          Apprenez à argumenter.
          <br />
          <span className="mkt-hero-title-accent">Pas à réagir.</span>
        </h1>
        <p className="landing-hero-lead">{PRODUCT_POSITIONING}</p>
        <div className="landing-hero-actions">
          <Link href="/start" className="btn btn-primary btn-lg landing-cta-primary">
            Commencer un débat
          </Link>
          <Link href="/demo" className="btn btn-secondary btn-lg">
            Essayer la démo
          </Link>
        </div>
        <p className="landing-hero-note">
          Débats structurés · Tours de parole · Humain ou IA · Pas un simple chatbot
        </p>
      </div>
    </section>
  );
}
