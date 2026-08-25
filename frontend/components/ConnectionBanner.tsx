"use client";

import { useEffect, useState } from "react";
import { useSocketStatus } from "@/lib/useSocketStatus";

/** Délai avant d'alerter : une micro-coupure se répare sans rien afficher. */
const GRACE_MS = 4000;

export function ConnectionBanner() {
  const status = useSocketStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "connected") {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (!visible) return null;

  return (
    <div className={`connection-banner connection-banner--${status}`} role="status">
      <span className="connection-banner-dot" aria-hidden="true" />
      {status === "offline" ? (
        <span>
          Serveur injoignable. Les débats en direct sont indisponibles — la page se reconnectera
          automatiquement.
        </span>
      ) : (
        <span>Reconnexion au serveur en cours…</span>
      )}
    </div>
  );
}
