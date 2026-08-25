"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { requestPasswordReset, signIn, signUp } from "../lib/auth";
import { APP_NAME } from "@/lib/brand";

export type AuthModalMode = "signin" | "signup" | "forgot";

/** Aligné sur `SignUpDto` côté backend (MinLength(8)). */
const PASSWORD_MIN_LENGTH = 8;

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
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInfo(null);
    setLoading(false);
    setShowPassword(false);
  }, [open, mode]);

  // Le focus entre dans la boîte de dialogue à l'ouverture, et y reste tant
  // qu'elle est ouverte : sans piège à focus, la tabulation part derrière le
  // voile sur des contrôles invisibles.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, mode]);

  const switchMode = useCallback(
    (next: AuthModalMode) => {
      setError(null);
      setInfo(null);
      onSwitchMode(next);
    },
    [onSwitchMode],
  );

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
        const payload = await signUp({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });

        // Confirmation d'email activée : le compte existe mais aucune session
        // n'est ouverte. On informe au lieu de fermer sur un état incohérent.
        if (!payload.session) {
          setInfo(
            payload.message ??
              "Compte créé. Vérifiez votre boîte mail pour confirmer votre inscription.",
          );
          setPassword("");
          return;
        }
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
      ? `Rejoignez ${APP_NAME} pour débattre avec d'autres participants.`
      : "Connectez-vous pour rejoindre et créer des débats.";

  // Un message de confirmation remplace le formulaire : le laisser affiché
  // sous un bouton « S'inscrire » encore actif invitait à renvoyer la demande.
  const showConfirmation = Boolean(info);

  return (
    <div className="auth-overlay" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        {/* Logo non cliquable : quitter la page en pleine inscription perdrait la saisie. */}
        <AppLogo variant="full" size="sm" className="auth-modal-brand" asLink={false} />
        <h2 id="auth-modal-title">{title}</h2>

        {showConfirmation ? (
          <div className="auth-confirmation">
            <p className="auth-success" role="status">
              {info}
            </p>
            <button
              type="button"
              className="btn btn-primary auth-submit"
              onClick={() => (isForgot ? switchMode("signin") : onClose())}
            >
              {isForgot ? "Retour à la connexion" : "J'ai compris"}
            </button>
          </div>
        ) : (
          <>
            <p className="auth-modal-subtitle">{subtitle}</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignUp ? (
                <div className="auth-form-row">
                  <label>
                    Prénom
                    <input
                      ref={firstFieldRef}
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Jean"
                      maxLength={60}
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
                      maxLength={60}
                    />
                  </label>
                </div>
              ) : null}

              <label>
                Email
                <input
                  ref={isSignUp ? undefined : firstFieldRef}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vous@exemple.com"
                  maxLength={254}
                />
              </label>

              {!isForgot ? (
                <label>
                  Mot de passe
                  <span className="auth-password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={isSignUp ? PASSWORD_MIN_LENGTH : undefined}
                      maxLength={128}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      aria-describedby={isSignUp ? "auth-password-hint" : undefined}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                      aria-label={
                        showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? "Masquer" : "Afficher"}
                    </button>
                  </span>
                  {isSignUp ? (
                    <span id="auth-password-hint" className="auth-field-hint">
                      {PASSWORD_MIN_LENGTH} caractères minimum.
                    </span>
                  ) : null}
                </label>
              ) : null}

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading
                  ? "Un instant…"
                  : isForgot
                    ? "Envoyer le lien"
                    : isSignUp
                      ? "Créer mon compte"
                      : "Se connecter"}
              </button>
            </form>

            {mode === "signin" ? (
              <p className="auth-switch">
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => switchMode("forgot")}
                >
                  Mot de passe oublié ?
                </button>
              </p>
            ) : null}

            <p className="auth-switch">
              {isForgot ? (
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => switchMode("signin")}
                >
                  Retour à la connexion
                </button>
              ) : (
                <>
                  {isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => switchMode(isSignUp ? "signin" : "signup")}
                  >
                    {isSignUp ? "Se connecter" : "S'inscrire"}
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
