"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppLogo } from "./AppLogo";
import { useAuthSession } from "../lib/useAuthSession";

const STORAGE_KEY = "debately:sidebar-expanded";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthSession();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setExpanded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onToggle() {
      setMobileOpen((v) => !v);
    }
    window.addEventListener("debately:toggle-sidebar", onToggle);
    return () => window.removeEventListener("debately:toggle-sidebar", onToggle);
  }, []);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href) ?? false;
  }

  function handleCreate() {
    setMobileOpen(false);
    if (user) {
      router.push("/room/new");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("debately:open-auth", {
        detail: { mode: "signin", pendingCreate: true },
      }),
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`sidebar${expanded ? " is-expanded" : ""}${mobileOpen ? " is-open-mobile" : ""}`}
        aria-label="Navigation principale"
      >
        <div className="sidebar-head">
          <AppLogo href="/" showName={expanded} size="sm" className="sidebar-brand" />
          <div className="sidebar-head-row">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Réduire la barre latérale" : "Élargir la barre latérale"}
              aria-expanded={expanded}
            >
              <ChevronIcon expanded={expanded} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <SidebarLink href="/" label="Accueil" active={isActive("/")} icon={<HomeIcon />} />
          <SidebarLink
            href="/#latest"
            label="Débats"
            active={false}
            icon={<DebateIcon />}
          />
          {user ? (
            <SidebarLink
              href="/notebook"
              label="Notebook"
              active={isActive("/notebook")}
              icon={<NotebookIcon />}
            />
          ) : null}
          <SidebarLink
            href="/notre-mission"
            label="Mission"
            active={isActive("/notre-mission")}
            icon={<MissionIcon />}
          />
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-cta"
            onClick={handleCreate}
            title="Créer un débat"
            aria-label="Créer un débat"
          >
            <PlusIcon />
            <span className="sidebar-item-label">Créer débat</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`sidebar-item${active ? " is-active" : ""}`}
      title={label}
      aria-label={label}
    >
      <span className="sidebar-icon">{icon}</span>
      <span className="sidebar-item-label">{label}</span>
    </Link>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={expanded ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 11l9-8 9 8M5 10v10h14V10"
      />
    </svg>
  );
}

function DebateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12c0 4.418-4.03 8-9 8-1.27 0-2.48-.234-3.583-.658L3 21l1.74-4.213C3.65 15.527 3 13.83 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8zM8 10h7M8 14h4"
      />
    </svg>
  );
}

function NotebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5z"
      />
    </svg>
  );
}

function MissionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 2"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 5v14M5 12h14"
      />
    </svg>
  );
}
