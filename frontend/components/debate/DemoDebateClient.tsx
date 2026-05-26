"use client";

import Link from "next/link";
import { useState } from "react";
import { AI_ROLES } from "@/lib/brand";
import { StepIndicator } from "@/components/ui/StepIndicator";

const DEMO_STEPS = [
  { id: "setup", label: "Sujet" },
  { id: "stance", label: "Position" },
  { id: "debate", label: "Débat" },
  { id: "result", label: "Analyse" },
];

const AI_REPLIES = [
  "Votre argument soulève un point valide, mais il sous-estime les coûts de mise en œuvre à grande échelle.",
  "Prenons un contre-exemple historique : dans des contextes similaires, la régulation excessive a freiné l'innovation utile.",
  "Vous concentrez l'échange sur les intentions ; il faudrait aussi peser les effets pervers mesurables.",
];

export function DemoDebateClient() {
  const [phase, setPhase] = useState(2);
  const [userMessage, setUserMessage] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "ai"; text: string; label: string }>
  >([
    {
      role: "ai",
      label: "AI Opponent",
      text: "Je suis votre adversaire IA. Vous défendez la thèse — présentez votre premier argument structuré.",
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [turn, setTurn] = useState(1);

  function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = userMessage.trim();
    if (!text || thinking) return;

    setMessages((m) => [...m, { role: "user", label: "Vous (Pour)", text }]);
    setUserMessage("");
    setThinking(true);

    setTimeout(() => {
      const reply = AI_REPLIES[Math.min(turn - 1, AI_REPLIES.length - 1)];
      setMessages((m) => [...m, { role: "ai", label: "AI Opponent", text: reply }]);
      setThinking(false);
      setTurn((t) => t + 1);
      if (turn >= 3) {
        setTimeout(() => setPhase(3), 1200);
      }
    }, 1400);
  }

  return (
    <div className="demo-page">
      <Link href="/" className="btn btn-ghost room-back">
        Retour à l&apos;accueil
      </Link>

      <div className="demo-banner">
        <span className="live-badge">Démo interactive</span>
        <p className="muted">
          Simulation locale — pas un débat enregistré. Pour un vrai échange,{" "}
          <Link href="/start">lancez un débat</Link>.
        </p>
      </div>

      <div className="wizard-shell card">
        <StepIndicator steps={DEMO_STEPS} currentIndex={phase} />

        {phase < 3 ? (
          <>
            <div className="demo-thread">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`demo-bubble demo-bubble--${msg.role}`}
                >
                  <span className="demo-bubble-label">{msg.label}</span>
                  <p>{msg.text}</p>
                </div>
              ))}
              {thinking ? (
                <div className="ai-thinking" role="status" aria-live="polite">
                  <span className="ai-thinking-dots" aria-hidden="true" />
                  AI Opponent réfléchit…
                </div>
              ) : null}
            </div>
            {phase === 3 ? null : (
              <form className="create-form" onSubmit={sendMessage}>
                <label htmlFor="demo-msg">Votre argument</label>
                <textarea
                  id="demo-msg"
                  rows={3}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Structurez : thèse → preuve → conclusion…"
                  disabled={thinking}
                />
                <button type="submit" className="btn btn-primary" disabled={thinking}>
                  Envoyer
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="wizard-panel">
            <h1>Analyse — {AI_ROLES.judge.shortTitle}</h1>
            <p className="muted">
              Exemple de retour en fin d&apos;échange (non généré par un vrai modèle dans cette
              démo).
            </p>
            <div className="demo-analysis card">
              <p>
                <strong>Clarté :</strong> Bonne structure globale ; précisez vos définitions en
                début de tour.
              </p>
              <p>
                <strong>Pertinence :</strong> Les exemples sont pertinents ; approfondir les
                effets à long terme renforcerait votre camp.
              </p>
              <p className="demo-coach-label">{AI_ROLES.coach.shortTitle}</p>
              <p>
                Essayez la formule : claim → warrant → impact pour chaque réponse.
              </p>
            </div>
            <div className="landing-hero-actions">
              <Link href="/start" className="btn btn-primary">
                Lancer un vrai débat
              </Link>
              <Link href="/explore" className="btn btn-secondary">
                Explorer les débats
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
