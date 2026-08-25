"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Filet de sécurité pour toute erreur de rendu non rattrapée.
 *
 * Sans ce fichier, Next affiche son écran d'erreur par défaut, en anglais et
 * sans issue : l'utilisateur se retrouve bloqué sur une page technique.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-narrow status-page">
      <p className="mkt-kicker">Erreur</p>
      <h1>Quelque chose s&apos;est mal passé</h1>
      <p className="muted">
        L&apos;affichage de cette page a échoué. Réessayez : si le problème persiste, revenez à
        l&apos;accueil.
      </p>
      <div className="status-page-actions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Réessayer
        </button>
        <Link href="/" className="btn btn-secondary">
          Retour à l&apos;accueil
        </Link>
      </div>
      {error.digest ? (
        <p className="muted status-page-digest">Référence technique : {error.digest}</p>
      ) : null}
    </div>
  );
}
