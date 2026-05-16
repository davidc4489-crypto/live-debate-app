"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AuthUser,
  fetchMe,
  getDisplayName,
  getStoredAuth,
  signOut,
} from "../lib/auth";
import { AuthModal, AuthModalMode } from "./AuthModal";

export function Topbar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [loadingSession, setLoadingSession] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored) {
      setUser(null);
      return;
    }

    const me = await fetchMe();
    setUser(me);
  }, []);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setUser(stored.user);
      void refreshUser();
    }
    setLoadingSession(false);
  }, [refreshUser]);

  function openAuth(mode: AuthModalMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            Debately
          </Link>
          <nav className="nav-links">
            <Link href="/">Accueil</Link>
            <Link href="/#latest">Débats</Link>
            <Link href="/#latest">Explorer</Link>
          </nav>

          <div className="topbar-actions">
            {loadingSession ? (
              <span className="auth-placeholder" aria-hidden />
            ) : user ? (
              <div className="auth-user-menu">
                <span className="auth-user-name">{getDisplayName(user)}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                  Déconnexion
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => openAuth("signin")}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openAuth("signup")}
                >
                  Inscription
                </button>
              </>
            )}
            <Link href="/room/new" className="btn btn-primary nav-cta">
              Créer débat
            </Link>
          </div>
        </div>
      </header>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => void refreshUser()}
        onSwitchMode={setAuthMode}
      />
    </>
  );
}
