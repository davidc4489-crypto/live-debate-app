"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthModal, AuthModalMode } from "@/components/AuthModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DebateDetail, DebateSchedulingState, formatScheduledDate } from "@/lib/debate";
import {
  expressDebateInterest,
  rejectDebateInterest,
  fetchSchedulingState,
  proposeDebateSchedule,
  respondToDebateSchedule,
} from "@/lib/debates-api";
import { useAuthSession } from "@/lib/useAuthSession";

interface DebatePlanningClientProps {
  debate: DebateDetail;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DebatePlanningClient({ debate }: DebatePlanningClientProps) {
  const { user, loading: authLoading, refresh } = useAuthSession();
  const [scheduling, setScheduling] = useState<DebateSchedulingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [proposedAt, setProposedAt] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const state = await fetchSchedulingState(debate.id);
      setScheduling(state);
    } catch {
      setError("Impossible de charger la planification.");
    }
  }, [debate.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const state = await fetchSchedulingState(debate.id);
        if (!cancelled) setScheduling(state);
      } catch {
        if (!cancelled) setError("Impossible de charger la planification.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debate.id]);

  const isCreator = user?.id === debate.createdBy;
  const isInterested = user?.id === scheduling?.interestedUserId;
  const isParticipant = isCreator || isInterested;
  const pending = scheduling?.pendingProposal ?? null;
  const canRespond =
    pending && user?.id && pending.proposedBy !== user.id && isParticipant;

  async function runAction(fn: () => Promise<void>) {
    setError("");
    setActionLoading(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleInterest() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    void runAction(() => expressDebateInterest(debate.id));
  }

  function handleRejectInterestClick() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setRejectConfirmOpen(true);
  }

  function handleRejectInterestConfirm() {
    void runAction(async () => {
      await rejectDebateInterest(debate.id);
      setRejectConfirmOpen(false);
    });
  }

  function handlePropose(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!proposedAt) {
      setError("Choisissez une date et une heure.");
      return;
    }
    const iso = new Date(proposedAt).toISOString();
    void runAction(() => proposeDebateSchedule(debate.id, iso));
  }

  function handleRespond(action: "accept" | "reject" | "counter") {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (action === "counter") {
      if (!proposedAt) {
        setError("Choisissez une date pour la contre-proposition.");
        return;
      }
      const iso = new Date(proposedAt).toISOString();
      void runAction(() => respondToDebateSchedule(debate.id, "counter", iso));
      return;
    }
    void runAction(() => respondToDebateSchedule(debate.id, action));
  }

  if (loading || authLoading) {
    return <p className="muted">Chargement de la planification…</p>;
  }

  return (
    <div className="stack">
      <section className="card create-debate-card reveal">
        <span className="theme-badge">{debate.theme}</span>
        <h1>{debate.title}</h1>

        {debate.status === "proposed" ? (
          <p className="muted">
            Ce débat est proposé sans date fixée. Un participant peut manifester son intérêt, puis
            vous négociez ensemble une date de passage en direct.
          </p>
        ) : null}

        {debate.status === "scheduled" && scheduling?.scheduledAt ? (
          <p className="muted">
            Débat planifié le <strong>{formatScheduledDate(scheduling.scheduledAt)}</strong>. La
            salle s&apos;ouvrira à l&apos;heure prévue ; vous aurez 1 h pour rejoindre tous les
            deux avant fermeture automatique.
          </p>
        ) : null}

        {error ? <p className="muted">{error}</p> : null}

        {debate.status === "proposed" && !scheduling?.interestedUserId && !isCreator ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={actionLoading}
            onClick={handleInterest}
          >
            {actionLoading ? "Envoi…" : "Je souhaite participer"}
          </button>
        ) : null}

        {debate.status === "proposed" && scheduling?.interestedUserId && !pending ? (
          <p className="muted">
            {isCreator
              ? "Un participant s'est proposé. Proposez une date ci-dessous, ou refusez sa candidature si vous ne souhaitez pas débattre avec cette personne."
              : isInterested
                ? "En attente que le créateur propose une date."
                : "Un participant est intéressé ; la planification est en cours."}
          </p>
        ) : null}

        {pending ? (
          <div className="card" style={{ marginTop: "1rem" }}>
            <p>
              Proposition en attente :{" "}
              <strong>{formatScheduledDate(pending.proposedAt)}</strong>
            </p>
            {canRespond ? (
              <div className="hero-cta" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={actionLoading}
                  onClick={() => handleRespond("accept")}
                >
                  Accepter
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={actionLoading}
                  onClick={() => handleRespond("reject")}
                >
                  Refuser
                </button>
              </div>
            ) : null}
            {canRespond ? (
              <form
                className="create-form"
                style={{ marginTop: "1rem" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRespond("counter");
                }}
              >
                <label htmlFor="counter-date">Contre-proposer une autre date</label>
                <input
                  id="counter-date"
                  type="datetime-local"
                  value={proposedAt}
                  onChange={(e) => setProposedAt(e.target.value)}
                />
                <button type="submit" className="btn btn-ghost" disabled={actionLoading}>
                  Envoyer la contre-proposition
                </button>
              </form>
            ) : null}
            {pending && user?.id === pending.proposedBy ? (
              <p className="muted">En attente de la réponse de l&apos;autre participant.</p>
            ) : null}
          </div>
        ) : null}

        {debate.status === "proposed" &&
        scheduling?.interestedUserId &&
        isCreator &&
        !pending ? (
          <>
            <form className="create-form" onSubmit={handlePropose}>
              <label htmlFor="schedule-date">Date et heure proposées</label>
              <input
                id="schedule-date"
                type="datetime-local"
                value={proposedAt}
                onChange={(e) => setProposedAt(e.target.value)}
                min={toDatetimeLocalValue(new Date(Date.now() + 30 * 60_000).toISOString())}
              />
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                {actionLoading ? "Envoi…" : "Proposer cette date"}
              </button>
            </form>
            <div className="hero-cta" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={actionLoading}
                onClick={handleRejectInterestClick}
              >
                Refuser ce participant
              </button>
            </div>
          </>
        ) : null}

        {debate.status === "proposed" &&
        scheduling?.interestedUserId &&
        isCreator &&
        pending ? (
          <div className="hero-cta" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={actionLoading}
              onClick={handleRejectInterestClick}
            >
              Refuser ce participant
            </button>
          </div>
        ) : null}

        {debate.status === "scheduled" ? (
          <Link href={`/room/${debate.id}`} className="btn btn-primary">
            Voir la salle (bientôt ouverte)
          </Link>
        ) : null}
      </section>

      <ConfirmModal
        open={rejectConfirmOpen}
        title="Refuser cette candidature ?"
        message="Le participant sera notifié que vous ne souhaitez pas débattre avec lui sur ce sujet. Il pourra éventuellement se proposer à nouveau plus tard, ou un autre utilisateur pourra candidater."
        confirmLabel="Refuser le participant"
        cancelLabel="Annuler"
        loading={actionLoading}
        confirmDanger
        onConfirm={handleRejectInterestConfirm}
        onCancel={() => setRejectConfirmOpen(false)}
      />

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => void refresh()}
        onSwitchMode={setAuthMode}
      />
    </div>
  );
}
