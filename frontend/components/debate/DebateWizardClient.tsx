"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { createProposedDebate } from "@/lib/debates-api";
import { getStoredAuth } from "@/lib/auth";
import {
  DebateStance,
  OPPONENT_LABELS,
  OpponentMode,
  STANCE_LABELS,
  WIZARD_STEPS,
} from "@/lib/debate-wizard";
import { getSocket } from "@/lib/socket";
import { useAuthSession } from "@/lib/useAuthSession";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

const SUGGESTED_TOPICS = [
  "L'IA doit-elle être strictement régulée ?",
  "Le télétravail est-il l'avenir du travail ?",
  "Faut-il interdire les réseaux sociaux aux mineurs ?",
];

export function DebateWizardClient() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuthSession();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [stance, setStance] = useState<DebateStance | null>(null);
  const [opponentMode, setOpponentMode] = useState<OpponentMode | null>(null);
  const [turnDuration, setTurnDuration] = useState<180 | 300 | 600>(180);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");

  function requireAuth(): boolean {
    if (user) return true;
    setAuthOpen(true);
    return false;
  }

  function next() {
    setError("");
    if (step === 0 && !title.trim()) {
      setError("Choisissez ou saisissez un sujet.");
      return;
    }
    if (step === 1 && !stance) {
      setError("Choisissez votre position.");
      return;
    }
    if (step === 2 && !opponentMode) {
      setError("Choisissez un type d'adversaire.");
      return;
    }
    if (step === 2 && opponentMode === "ai") {
      router.push("/demo");
      return;
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function launchHuman() {
    if (!requireAuth()) return;

    const accessToken = getStoredAuth()?.session.accessToken;
    if (!accessToken) {
      setAuthOpen(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (opponentMode === "human") {
        const socket = getSocket();
        if (!socket.connected) socket.connect();

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Délai dépassé.")), 8000);

          const onCreated = (room: { id: string }) => {
            clearTimeout(timeout);
            socket.off("roomCreated", onCreated);
            socket.off("errorMessage", onError);
            resolve();
            router.push(`/room/${room.id}`);
          };
          const onError = (payload: { message: string }) => {
            clearTimeout(timeout);
            socket.off("roomCreated", onCreated);
            socket.off("errorMessage", onError);
            reject(new Error(payload.message));
          };

          socket.on("roomCreated", onCreated);
          socket.on("errorMessage", onError);
          socket.emit("createRoom", {
            title: title.trim(),
            turnDuration,
            accessToken,
            creatorStance: stance,
            opponentMode: "human",
          });
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lancer le débat.");
      setLoading(false);
    }
  }

  async function launchProposed() {
    if (!requireAuth() || !stance) return;
    setLoading(true);
    setError("");
    try {
      const created = await createProposedDebate(title.trim(), turnDuration, stance, "human");
      router.push(`/room/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
      setLoading(false);
    }
  }

  return (
    <>
      <OnboardingModal />
      <div className="wizard-page">
        <Link href="/" className="btn btn-ghost room-back">
          Retour
        </Link>

        <div className="wizard-shell card">
          <StepIndicator steps={[...WIZARD_STEPS]} currentIndex={step} />

          {step === 0 ? (
            <div className="wizard-panel">
              <h1>Quel sujet voulez-vous débattre ?</h1>
              <p className="muted">Une question claire, ouverte, avec deux camps possibles.</p>
              <form
                className="create-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
              >
                <label htmlFor="wizard-title">Votre question</label>
                <input
                  id="wizard-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Faut-il rendre le vote obligatoire ?"
                />
                <p className="muted wizard-suggestions-label">Suggestions</p>
                <div className="chips-wrap">
                  {SUGGESTED_TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      onClick={() => setTitle(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary">
                  Continuer
                </button>
              </form>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="wizard-panel">
              <h1>Quelle est votre position ?</h1>
              <p className="muted">Vous défendrez ce camp pendant tout le débat.</p>
              <div className="stance-picker">
                {(["for", "against"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`stance-card ${stance === s ? "is-selected" : ""}`}
                    onClick={() => setStance(s)}
                  >
                    <span className="stance-card-label">{STANCE_LABELS[s]}</span>
                    <span className="stance-card-hint">
                      {s === "for" ? "Je défends la thèse" : "Je conteste la thèse"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="wizard-actions">
                <button type="button" className="btn btn-ghost" onClick={back}>
                  Retour
                </button>
                <button type="button" className="btn btn-primary" onClick={next}>
                  Continuer
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="wizard-panel">
              <h1>Contre qui débattez-vous ?</h1>
              <p className="muted">Humain en direct ou entraînement IA (démo disponible).</p>
              <div className="stance-picker">
                {(["human", "ai"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`stance-card ${opponentMode === mode ? "is-selected" : ""}`}
                    onClick={() => setOpponentMode(mode)}
                  >
                    <span className="stance-card-label">{OPPONENT_LABELS[mode]}</span>
                    <span className="stance-card-hint">
                      {mode === "human"
                        ? "Un participant rejoint votre salle"
                        : "AI Opponent — voir la démo interactive"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="wizard-actions">
                <button type="button" className="btn btn-ghost" onClick={back}>
                  Retour
                </button>
                <button type="button" className="btn btn-primary" onClick={next}>
                  Continuer
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 && opponentMode === "human" ? (
            <div className="wizard-panel">
              <h1>Lancer le débat</h1>
              <dl className="wizard-recap">
                <div>
                  <dt>Sujet</dt>
                  <dd>{title}</dd>
                </div>
                <div>
                  <dt>Position</dt>
                  <dd>{stance ? STANCE_LABELS[stance] : "—"}</dd>
                </div>
                <div>
                  <dt>Adversaire</dt>
                  <dd>Utilisateur humain</dd>
                </div>
              </dl>
              <label htmlFor="turn-dur">Durée par tour</label>
              <select
                id="turn-dur"
                value={turnDuration}
                onChange={(e) => setTurnDuration(Number(e.target.value) as 180 | 300 | 600)}
              >
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
              </select>
              <div className="wizard-launch-modes">
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={loading || authLoading}
                  onClick={() => void launchHuman()}
                >
                  {loading ? "Ouverture…" : "Ouvrir la salle maintenant"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  disabled={loading}
                  onClick={() => void launchProposed()}
                >
                  Proposer le sujet (planifier)
                </button>
              </div>
              <div className="wizard-actions">
                <button type="button" className="btn btn-ghost" onClick={back}>
                  Retour
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="wizard-error muted">{error}</p> : null}
        </div>
      </div>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => void refresh()}
        onSwitchMode={setAuthMode}
      />
    </>
  );
}
