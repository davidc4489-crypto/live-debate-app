"use client";

import { useEffect, useState } from "react";
import { AI_ROLES, APP_NAME } from "@/lib/brand";

const STORAGE_KEY = "argumen:onboarding-done";

interface OnboardingModalProps {
  onComplete?: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function finish() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    onComplete?.();
  }

  if (!open) return null;

  const slides = [
    {
      title: `Bienvenue sur ${APP_NAME}`,
      body: "Ce n'est pas un chat. C'est un espace pour structurer vos idées, défendre une position et apprendre de la confrontation d'arguments.",
    },
    {
      title: "Choisissez un sujet et un camp",
      body: "Pour ou contre — puis affrontez un humain ou (bientôt) l'IA. Chaque tour est chronométré pour garder le débat lisible.",
    },
    {
      title: "Trois rôles IA",
      body: `${AI_ROLES.opponent.shortTitle} · ${AI_ROLES.judge.shortTitle} · ${AI_ROLES.coach.shortTitle} — l'IA vous aide à penser, pas à publier à votre place.`,
    },
  ];

  const current = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div className="auth-overlay" role="presentation">
      <div
        className="auth-modal onboarding-modal"
        role="dialog"
        aria-labelledby="onboarding-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mkt-kicker">Premiers pas</p>
        <h2 id="onboarding-title">{current.title}</h2>
        <p className="muted onboarding-body">{current.body}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {slides.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? "is-active" : ""}`} />
          ))}
        </div>
        <div className="notebook-form-actions">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Retour
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={finish}>
              Passer
            </button>
          )}
          {isLast ? (
            <button type="button" className="btn btn-primary" onClick={finish}>
              Commencer
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Suivant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
