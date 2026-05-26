"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth } from "@/lib/auth";
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
      setError(payload.message || "Impossible de creer le debat.");
    }

    function onConnectError() {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setLoading(false);
      setError("Connexion backend impossible. Verifiez que le serveur tourne.");
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

    const accessToken = getStoredAuth()?.session.accessToken;
    if (!accessToken) {
      setError("Vous devez être connecté pour créer un débat.");
      setAuthOpen(true);
      return;
    }

    if (!title.trim()) {
      setError("Le titre du debat est requis.");
      return;
    }

    if (createMode === "proposed") {
      setLoading(true);
      try {
        const created = await createProposedDebate(title.trim(), turnDuration);
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
      setError("Aucune reponse du serveur. Reessayez.");
    }, 6000);

    getSocket().emit("createRoom", {
      title: title.trim(),
      turnDuration,
      accessToken,
    });
  }

  return (
    <div className="stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour a l'accueil
      </Link>

      <section className="card create-debate-card reveal">
        <h1>Creer un nouveau debat</h1>

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
              <label htmlFor="debate-title">Titre du debat</label>
              <input
                id="debate-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: L'IA doit-elle etre strictement regulee ?"
              />

              <label htmlFor="turn-duration">Duree de tour</label>
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

              {error ? <p className="muted">{error}</p> : null}

              <button type="submit" disabled={loading}>
                {loading
                  ? "Creation..."
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
