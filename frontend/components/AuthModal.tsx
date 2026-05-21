"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { requestPasswordReset, signIn, signUp } from "../lib/auth";
import { APP_NAME } from "@/lib/brand";

export type AuthModalMode = "signin" | "signup" | "forgot";

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
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInfo(null);
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
  const isForgot = mode === "forgot";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isForgot) {
        const message = await requestPasswordReset(email);
        setInfo(message);
        return;
      }

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

  const title = isForgot
    ? "Mot de passe oublié"
    : isSignUp
      ? "Créer un compte"
      : "Se connecter";

  const subtitle = isForgot
    ? "Indiquez votre email. Vous recevrez un lien pour choisir un nouveau mot de passe."
    : isSignUp
      ? `Rejoignez ${APP_NAME} pour participer aux débats en direct.`
      : "Connectez-vous pour rejoindre et créer des débats.";

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

        <AppLogo href="/" variant="full" size="sm" className="auth-modal-brand" />
        <h2 id="auth-modal-title">{title}</h2>
        <p className="auth-modal-subtitle">{subtitle}</p>

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

          {!isForgot ? (
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
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}
          {info ? <p className="muted">{info}</p> : null}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading
              ? "Chargement…"
              : isForgot
                ? "Envoyer le lien"
                : isSignUp
                  ? "S'inscrire"
                  : "Se connecter"}
          </button>
        </form>

        {mode === "signin" ? (
          <p className="auth-switch">
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => onSwitchMode("forgot")}
            >
              Mot de passe oublié ?
            </button>
          </p>
        ) : null}

        <p className="auth-switch">
          {isForgot ? (
            <>
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => onSwitchMode("signin")}
              >
                Retour à la connexion
              </button>
            </>
          ) : (
            <>
              {isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => onSwitchMode(isSignUp ? "signin" : "signup")}
              >
                {isSignUp ? "Se connecter" : "S'inscrire"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
