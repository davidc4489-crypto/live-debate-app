"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { resetPassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Vérification du lien…");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);

    const linkError =
      queryParams.get("error_description") ||
      hashParams.get("error_description") ||
      queryParams.get("error");

    if (linkError) {
      setMessage(decodeURIComponent(linkError));
      return;
    }

    const token =
      hashParams.get("access_token") || queryParams.get("access_token");
    const refresh =
      hashParams.get("refresh_token") || queryParams.get("refresh_token");

    if (token) {
      setAccessToken(token);
      setRefreshToken(refresh);
      setMessage("Choisissez un nouveau mot de passe.");
      return;
    }

    setMessage(
      "Lien invalide ou expiré. Demandez un nouvel email depuis la page de connexion.",
    );
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword(accessToken, password, refreshToken ?? undefined);
      setDone(true);
      setMessage("Mot de passe mis à jour. Vous pouvez vous connecter.");
      setTimeout(() => router.replace("/"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  const canSetPassword = Boolean(accessToken) && !done;

  return (
    <section className="card reveal" style={{ maxWidth: 480, margin: "2rem auto" }}>
      <AppLogo href="/" variant="full" size="sm" className="auth-modal-brand" />
      <h1>Nouveau mot de passe</h1>
      <p className="muted">{message}</p>

      {canSetPassword ? (
        <form className="auth-form" onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
          <label>
            Nouveau mot de passe
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>
          <label>
            Confirmer le mot de passe
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      ) : null}

      {!accessToken && !done ? (
        <p style={{ marginTop: "1rem" }}>
          <Link href="/" className="auth-switch-link">
            Retour à l&apos;accueil
          </Link>
        </p>
      ) : null}
    </section>
  );
}
