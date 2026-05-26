"use client";

import { LandingHero } from "./LandingHero";
import { HowItWorks } from "./HowItWorks";
import { WhyProduct } from "./WhyProduct";
import { AiSystem } from "./AiSystem";
import { SocialProof } from "./SocialProof";
import { LandingFooter } from "./LandingFooter";
import { HomeProductPreview } from "@/components/marketing/HomeProductPreview";

export function LandingPageClient() {
  return (
    <div className="landing-page">
      <LandingHero />
      <HowItWorks />
      <WhyProduct />
      <AiSystem />
      <HomeProductPreview />
      <SocialProof />
      <section className="landing-cta-band">
        <div className="mkt-container landing-cta-band-inner">
          <h2 className="mkt-section-title">Prêt à tester vos arguments ?</h2>
          <p className="mkt-section-lead">Rejoignez un débat existant ou créez le vôtre en quelques clics.</p>
          <div className="landing-hero-actions">
            <a href="/start" className="btn btn-primary btn-lg">
              Commencer un débat
            </a>
            <a href="/explore" className="btn btn-secondary btn-lg">
              Explorer les débats
            </a>
          </div>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}
