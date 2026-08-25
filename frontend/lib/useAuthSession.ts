"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthUser, ensureFreshSession, fetchMe, getStoredAuth } from "./auth";

/** Intervalle de vérification de fraîcheur du jeton (Supabase expire à 1 h). */
const SESSION_CHECK_MS = 4 * 60 * 1000;

export function useAuthSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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
      void refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh]);

  // Renouvellement silencieux : sans lui, la session expirait au bout d'une
  // heure et l'utilisateur était déconnecté en plein débat.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void ensureFreshSession();
    };

    tick();
    const interval = window.setInterval(tick, SESSION_CHECK_MS);
    // Un onglet resté en arrière-plan peut avoir un jeton périmé au retour.
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return { user, loading, refresh, isAuthenticated: !!user };
}
