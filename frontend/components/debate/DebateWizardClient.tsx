"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { createProposedDebate } from "@/lib/debates-api";
import { getStoredAuth } from "@/lib/auth";
import { MAX_TITLE_LENGTH, MIN_TITLE_LENGTH } from "@/lib/constants";
import { DebateStance, STANCE_LABELS, WIZARD_STEPS } from "@/lib/debate-wizard";
import { getSocket } from "@/lib/socket";
import { useAuthSession } from "@/lib/useAuthSession";

const SUGGESTED_TOPICS = [
  "Faut-il rendre le vote obligatoire ?",
  "Le télétravail est-il l'avenir du travail ?",
  "Faut-il interdire les réseaux sociaux aux mineurs ?",
  "La semaine de quatre jours doit-elle devenir la norme ?",
];

const TURN_OPTIONS = [
  { value: 180, label: "3 minutes", hint: "Rythme soutenu" },
  { value: 300, label: "5 minutes", hint: "Équilibré" },
  { value: 600, label: "10 minutes", hint: "Arguments longs" },
] as const;

export function DebateWizardClient() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuthSession();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [stance, setStance] = useState<DebateStance | null>(null);
  const [turnDuration, setTurnDuration] = useState<180 | 300 | 600>(300);
  const [loading, setLoading] = useState(false);
  const [pendingMode, setPendingMode] = useState<"live" | "proposed" | null>(null);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");

  const trimmedTitle = title.trim();

  function requireAuth(): boolean {
    if (user) return true;
    setAuthMode("signin");
    setAuthOpen(true);
    return false;
  }

  function validateTitle(): string | null {
    if (!trimmedTitle) return "Choisissez ou saisissez un sujet.";
    if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      return `Le sujet doit contenir au moins ${MIN_TITLE_LENGTH} caractères.`;
    }
    return null;
  }

  function next() {
    setError("");
    if (step === 0) {
      const invalid = validateTitle();
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    if (step === 1 && !stance) {
      setError("Choisissez votre position.");
      return;
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function launchLive() {
    if (!requireAuth()) return;

    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setAuthOpen(true);
      return;
    }

    setLoading(true);
    setPendingMode("live");
    setError("");

    try {
      const socket = getSocket();
      if (!socket.connected) socket.connect();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Le serveur ne répond pas. Réessayez dans un instant.")),
          10_000,
        );

        const cleanup = () => {
          clearTimeout(timeout);
          socket.off("roomCreated", onCreated);
          socket.off("errorMessage", onError);
        };
        const onCreated = (room: { id: string }) => {
          cleanup();
          resolve();
          router.push(`/room/${room.id}`);
        };
        const onError = (payload: { message: string }) => {
          cleanup();
          reject(new Error(payload.message));
        };

        socket.on("roomCreated", onCreated);
        socket.on("errorMessage", onError);
        socket.emit("createRoom", {
          title: trimmedTitle,
          turnDuration,
          accessToken,
          creatorStance: stance,
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lancer le débat.");
      setLoading(false);
      setPendingMode(null);
    }
  }

  async function launchProposed() {
    if (!requireAuth() || !stance) return;
    setLoading(true);
    setPendingMode("proposed");
    setError("");
    try {
      const created = await createProposedDebate(trimmedTitle, turnDuration, stance);
      router.push(`/room/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de proposer le sujet.");
      setLoading(false);
      setPendingMode(null);
    }
  }

  return (
    <>
      <div className="wizard-page">
        <Link href="/" className="btn btn-ghost room-back">
          Retour à l&apos;accueil
        </Link>

        <div className="wizard-shell card">
          <StepIndicator steps={[...WIZARD_STEPS]} currentIndex={step} />

          {step === 0 ? (
            <div className="wizard-panel">
              <h1>Quel sujet voulez-vous débattre ?</h1>
              <p className="muted">
                Une question fermée, avec deux camps défendables. « Faut-il… ? » plutôt que
                « Que penser de… ? ».
              </p>
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
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
                  placeholder="Ex : Faut-il rendre le vote obligatoire ?"
                  autoFocus
                />
                <p className="muted field-counter" aria-live="polite">
                  {title.length}/{MAX_TITLE_LENGTH} caractères
                </p>
                <p className="muted wizard-suggestions-label">Ou partez d&apos;une suggestion</p>
                <div className="chips-wrap">
                  {SUGGESTED_TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip${trimmedTitle === t ? " active" : ""}`}
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
              <h1>Quelle position défendez-vous ?</h1>
              <p className="muted">
                Vous tiendrez ce camp pendant tout le débat. Votre adversaire prendra l&apos;autre.
              </p>
              <p className="wizard-topic-recall">{trimmedTitle}</p>
              <div className="stance-picker">
                {(["for", "against"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`stance-card stance-${s} ${stance === s ? "is-selected" : ""}`}
                    onClick={() => setStance(s)}
                    aria-pressed={stance === s}
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
              <h1>Lancer le débat</h1>
              <dl className="wizard-recap">
                <div>
                  <dt>Sujet</dt>
                  <dd>{trimmedTitle}</dd>
                </div>
                <div>
                  <dt>Votre position</dt>
                  <dd>{stance ? STANCE_LABELS[stance] : "—"}</dd>
                </div>
                <div>
                  <dt>Adversaire</dt>
                  <dd>Un autre participant</dd>
                </div>
              </dl>

              <fieldset className="wizard-fieldset">
                <legend>Délai pour répondre à son tour</legend>
                <p className="muted wizard-fieldset-hint">
                  C&apos;est un maximum, pas une durée à consommer : envoyer son message passe
                  la parole immédiatement.
                </p>
                <div className="turn-picker">
                  {TURN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`turn-card${turnDuration === option.value ? " is-selected" : ""}`}
                      onClick={() => setTurnDuration(option.value)}
                      aria-pressed={turnDuration === option.value}
                    >
                      <span className="turn-card-label">{option.label}</span>
                      <span className="turn-card-hint">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="wizard-launch-modes">
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={loading || authLoading}
                  onClick={() => void launchLive()}
                >
                  {pendingMode === "live" ? "Ouverture…" : "Ouvrir la salle maintenant"}
                </button>
                <p className="muted wizard-mode-hint">
                  La salle reste ouverte une heure en attente d&apos;un adversaire, puis se ferme.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  disabled={loading || authLoading}
                  onClick={() => void launchProposed()}
                >
                  {pendingMode === "proposed" ? "Envoi…" : "Proposer le sujet pour plus tard"}
                </button>
                <p className="muted wizard-mode-hint">
                  Le sujet apparaît dans « Débats proposés ». Quand quelqu&apos;un se manifeste,
                  vous convenez d&apos;une date ensemble.
                </p>
              </div>
              <div className="wizard-actions">
                <button type="button" className="btn btn-ghost" onClick={back} disabled={loading}>
                  Retour
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="wizard-error" role="alert">
              {error}
            </p>
          ) : null}
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
