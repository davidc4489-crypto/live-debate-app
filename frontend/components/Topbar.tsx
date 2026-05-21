"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDisplayName, getStoredAuth, signOut } from "../lib/auth";
import { getSocket } from "../lib/socket";
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

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    const subscribe = () => {
      const token = getStoredAuth()?.session.accessToken;
      if (token) socket.emit("subscribeUser", { accessToken: token });
    };

    subscribe();
    socket.io.on("reconnect", subscribe);
    return () => {
      socket.io.off("reconnect", subscribe);
    };
  }, [user]);

  useEffect(() => {
    function onOpenAuth(event: Event) {
      const detail = (event as CustomEvent<{
        mode?: AuthModalMode;
        pendingCreate?: boolean;
        pendingProfile?: boolean;
      }>).detail;
      setAuthMode(detail?.mode ?? "signin");
      if (detail?.pendingCreate) setPendingCreate(true);
      if (detail?.pendingProfile) setPendingProfile(true);
      setAuthOpen(true);
    }
    window.addEventListener("debately:open-auth", onOpenAuth);
    return () => window.removeEventListener("debately:open-auth", onOpenAuth);
  }, []);

  function openAuth(mode: AuthModalMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function toggleSidebar() {
    window.dispatchEvent(new CustomEvent("debately:toggle-sidebar"));
  }

  async function handleSignOut() {
    setProfileMenuOpen(false);
    await signOut();
    await refreshUser();
  }

  const displayName = user ? getDisplayName(user) : "";

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-mobile-toggle"
              aria-label="Ouvrir la navigation"
              onClick={toggleSidebar}
            >
              <MenuIcon />
            </button>
            <Link href="/" className="brand">
              Debately
            </Link>
          </div>

          <div className="topbar-actions">
            {loadingSession ? (
              <span className="auth-placeholder" aria-hidden />
            ) : user ? (
              <>
                <NotificationsMenu />
                <div className="topbar-profile-wrap" ref={profileMenuRef}>
                  <button
                    type="button"
                    className="topbar-profile-btn"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    aria-expanded={profileMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Menu du profil"
                  >
                    <ProfileAvatar name={displayName} />
                  </button>
                  {profileMenuOpen ? (
                    <div className="topbar-profile-menu" role="menu">
                      <div className="topbar-profile-menu-head">
                        <span className="topbar-profile-menu-name">{displayName}</span>
                      </div>
                      <Link
                        href={`/profile/${user.id}`}
                        className="topbar-profile-menu-item"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Mon profil
                      </Link>
                      <Link
                        href="/profile/edit"
                        className="topbar-profile-menu-item"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Modifier mon profil
                      </Link>
                      <button
                        type="button"
                        className="topbar-profile-menu-item topbar-profile-menu-signout"
                        role="menuitem"
                        onClick={handleSignOut}
                      >
                        Déconnexion
                      </button>
                    </div>
                  ) : null}
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function ProfileAvatar({ name }: { name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return <span className="topbar-avatar">{initial}</span>;
}
