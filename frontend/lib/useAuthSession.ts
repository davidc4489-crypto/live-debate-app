"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthUser, fetchMe, getStoredAuth } from "./auth";

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

  return { user, loading, refresh, isAuthenticated: !!user };
}
