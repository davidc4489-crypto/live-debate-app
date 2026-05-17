"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDisplayName, signOut } from "../lib/auth";
import { useAuthSession } from "../lib/useAuthSession";
import { AuthModal, AuthModalMode } from "./AuthModal";

export function Topbar() {
  const router = useRouter();
  const { user, loading: loadingSession, refresh: refreshUser } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [pendingCreate, setPendingCreate] = useState(false);

  function handleCreateDebateClick() {
    if (user) {
      router.push("/room/new");
      return;
    }
    setPendingCreate(true);
    setAuthMode("signin");
    setAuthOpen(true);
  }

  function openAuth(mode: AuthModalMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  async function handleSignOut() {
    await signOut();
    await refreshUser();
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
              <>
                <Link href="/notebook" className="btn btn-ghost btn-sm">
                  Notebook
                </Link>
                <div className="auth-user-menu">
                  <span className="auth-user-name">{getDisplayName(user)}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                    Déconnexion
                  </button>
                </div>
              </>
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
            <button
              type="button"
              className="btn btn-primary nav-cta"
              onClick={handleCreateDebateClick}
            >
              Créer débat
            </button>
          </div>
        </div>
      </header>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => {
          setAuthOpen(false);
          setPendingCreate(false);
        }}
        onSuccess={() => {
          void refreshUser().then(() => {
            if (pendingCreate) {
              setPendingCreate(false);
              router.push("/room/new");
            }
          });
        }}
        onSwitchMode={setAuthMode}
      />
    </>
  );
}
