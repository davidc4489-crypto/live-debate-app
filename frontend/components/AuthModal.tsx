"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, signUp } from "../lib/auth";

export type AuthModalMode = "signin" | "signup";

interface AuthModalProps {
  open: boolean;
  mode: AuthModalMode;
  onClose: () => void;
  onSuccess: () => void;
  onSwitchMode: (mode: AuthModalMode) => void;
}

export function AuthModal({
  open,
  mode,
  onClose,
  onSuccess,
  onSwitchMode,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const isSignUp = mode === "signup";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await signUp({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });
      } else {
        await signIn({ email, password });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose} role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        <h2 id="auth-modal-title">{isSignUp ? "Créer un compte" : "Se connecter"}</h2>
        <p className="auth-modal-subtitle">
          {isSignUp
            ? "Rejoignez Debately pour participer aux débats en direct."
            : "Connectez-vous pour rejoindre et créer des débats."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <div className="auth-form-row">
              <label>
                Prénom
                <input
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Jean"
                />
              </label>
              <label>
                Nom
                <input
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Dupont"
                />
              </label>
            </div>
          ) : null}

          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@exemple.com"
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? "Chargement…" : isSignUp ? "S'inscrire" : "Se connecter"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <button
            type="button"
            className="auth-switch-link"
            onClick={() => onSwitchMode(isSignUp ? "signin" : "signup")}
          >
            {isSignUp ? "Se connecter" : "S'inscrire"}
          </button>
        </p>
      </div>
    </div>
  );
}
