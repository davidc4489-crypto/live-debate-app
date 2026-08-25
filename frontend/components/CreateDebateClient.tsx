"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth } from "@/lib/auth";
import { MAX_TITLE_LENGTH, MIN_TITLE_LENGTH } from "@/lib/constants";
import { useAuthSession } from "@/lib/useAuthSession";
import { createProposedDebate } from "@/lib/debates-api";
import { getSocket } from "@/lib/socket";
import { AuthModal, AuthModalMode } from "./AuthModal";

interface CreatedRoomPayload {
  id: string;
  title: string;
}

export function CreateDebateClient() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnDuration, setTurnDuration] = useState<180 | 300 | 600>(180);
  const [createMode, setCreateMode] = useState<"live" | "proposed">("live");
  const createTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    function onRoomCreated(room: CreatedRoomPayload) {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      router.push(`/room/${room.id}`);
    }

    function onErrorMessage(payload: { message: string }) {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      setError(payload.message || "Impossible de créer le débat.");
    }

    function onConnectError() {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      setError("Connexion au serveur impossible. Vérifiez que le backend est démarré.");
    }

    socket.on("roomCreated", onRoomCreated);
    socket.on("errorMessage", onErrorMessage);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("roomCreated", onRoomCreated);
      socket.off("errorMessage", onErrorMessage);
      socket.off("connect_error", onConnectError);
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
      }
    };
  }, [router]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const accessToken = getStoredAuth()?.session?.accessToken;
    if (!accessToken) {
      setError("Vous devez être connecté pour créer un débat.");
      setAuthOpen(true);
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Le titre du débat est requis.");
      return;
    }

    if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      setError(`Le titre doit contenir au moins ${MIN_TITLE_LENGTH} caractères.`);
      return;
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setError(`Le titre ne peut pas dépasser ${MAX_TITLE_LENGTH} caractères.`);
      return;
    }

    if (createMode === "proposed") {
      setLoading(true);
      try {
        const created = await createProposedDebate(trimmedTitle, turnDuration);
        router.push(`/room/${created.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de proposer le débat.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    createTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError("Aucune réponse du serveur. Réessayez.");
    }, 6000);

    getSocket().emit("createRoom", {
      title: trimmedTitle,
      turnDuration,
      accessToken,
    });
  }

  return (
    <div className="stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour à l'accueil
      </Link>

      <section className="card create-debate-card reveal">
        <h1>Créer un nouveau débat</h1>

        {authLoading ? (
          <p className="muted">Verification de la session…</p>
        ) : !user ? (
          <>
            <p className="muted">
              Connectez-vous pour lancer un débat en direct.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAuthMode("signin");
                setAuthOpen(true);
              }}
            >
              Se connecter
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Lancez un débat immédiatement ou proposez un sujet à planifier plus tard.
            </p>

            <div className="hero-cta" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className={`btn ${createMode === "live" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCreateMode("live")}
              >
                Lancer maintenant
              </button>
              <button
                type="button"
                className={`btn ${createMode === "proposed" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCreateMode("proposed")}
              >
                Proposer un sujet
              </button>
            </div>

            {createMode === "live" ? (
              <p className="muted create-debate-notice">
                Si aucun participant ne rejoint dans l&apos;heure, le débat sera automatiquement
                fermé.
              </p>
            ) : (
              <p className="muted create-debate-notice">
                Votre sujet apparaîtra dans « Débats proposés ». Quand un participant se manifeste,
                vous pourrez négocier une date ensemble.
              </p>
            )}

            <form className="create-form" onSubmit={(e) => void handleCreate(e)}>
              <label htmlFor="debate-title">Titre du débat</label>
              <input
                id="debate-title"
                value={title}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))}
                placeholder="Ex : l'IA doit-elle être strictement régulée ?"
              />

              <p className="muted" aria-live="polite">
                {title.length}/{MAX_TITLE_LENGTH} caractères
              </p>

              <label htmlFor="turn-duration">Durée d&apos;un tour</label>
              <select
                id="turn-duration"
                value={turnDuration}
                onChange={(event) =>
                  setTurnDuration(Number(event.target.value) as 180 | 300 | 600)
                }
              >
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
              </select>
              <p className="muted">
                Délai maximum pour répondre à son tour. Le débat alterne un message chacun :
                envoyer son argument passe la parole à l&apos;autre participant.
              </p>

              {error ? <p className="muted">{error}</p> : null}

              <button type="submit" disabled={loading}>
                {loading
                  ? "Création…"
                  : createMode === "proposed"
                    ? "Proposer le sujet"
                    : "Creer le debat"}
              </button>
            </form>
          </>
        )}
      </section>

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
