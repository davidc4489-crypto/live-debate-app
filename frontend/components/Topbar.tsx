"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDisplayName, getStoredAuth, signOut } from "../lib/auth";
import { useAuthSession } from "../lib/useAuthSession";
import { AuthModal, AuthModalMode } from "./AuthModal";
import { NotificationsMenu } from "./NotificationsMenu";

export function Topbar() {
  const router = useRouter();
  const { user, loading: loadingSession, refresh: refreshUser } = useAuthSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("signin");
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingProfile, setPendingProfile] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

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

  function handleProfileClick() {
    if (user) {
      setProfileMenuOpen((open) => !open);
      return;
    }
    setPendingProfile(true);
    setAuthMode("signin");
    setAuthOpen(true);
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false);
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
                <NotificationsMenu />
                <div className="topbar-profile-wrap" ref={profileMenuRef}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm topbar-profile-btn"
                    onClick={handleProfileClick}
                    aria-expanded={profileMenuOpen}
                    aria-haspopup="menu"
                  >
                    <ProfileNavIcon />
                    Mon profil
                  </button>
                  {profileMenuOpen ? (
                    <div className="topbar-profile-menu" role="menu">
                      <Link
                        href={`/profile/${user.id}`}
                        className="topbar-profile-menu-item"
                        role="menuitem"
                        onClick={closeProfileMenu}
                      >
                        Voir mon profil
                      </Link>
                      <Link
                        href="/profile/edit"
                        className="topbar-profile-menu-item"
                        role="menuitem"
                        onClick={closeProfileMenu}
                      >
                        Créer / modifier mon profil
                      </Link>
                    </div>
                  ) : null}
                </div>
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
                  className="btn btn-ghost btn-sm topbar-profile-btn"
                  onClick={handleProfileClick}
                >
                  <ProfileNavIcon />
                  Mon profil
                </button>
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
          setPendingProfile(false);
        }}
        onSuccess={() => {
          void refreshUser().then(() => {
            if (pendingCreate) {
              setPendingCreate(false);
              router.push("/room/new");
              return;
            }
            if (pendingProfile && getStoredAuth()?.user) {
              setPendingProfile(false);
              router.push("/profile/edit");
            }
          });
        }}
        onSwitchMode={setAuthMode}
      />
    </>
  );
}

function ProfileNavIcon() {
  return (
    <svg
      className="topbar-profile-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
      />
    </svg>
  );
}
