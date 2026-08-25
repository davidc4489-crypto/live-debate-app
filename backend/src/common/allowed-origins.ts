/**
 * Origines frontend autorisées, dérivées de `FRONTEND_URL` (liste séparée par
 * des virgules). Partagé par le CORS HTTP et la gateway Socket.IO.
 */
export function allowedOrigins(): string[] {
  return (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/**
 * Valeur `origin` pour CORS : la liste blanche si elle est configurée, sinon
 * `true` (tout accepter) — pratique en développement uniquement.
 *
 * En production, l'absence de `FRONTEND_URL` fait échouer le démarrage plutôt
 * que d'ouvrir l'API et la gateway à n'importe quelle origine : un simple
 * avertissement dans les logs se perdait, et le service partait grand ouvert.
 */
export function corsOrigin(): string[] | boolean {
  const origins = allowedOrigins();
  if (origins.length > 0) return origins;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FRONTEND_URL est obligatoire en production : sans elle, l'API et la gateway " +
        "temps réel accepteraient n'importe quelle origine. Renseignez les origines " +
        "autorisées, séparées par des virgules (ex. https://argumen.app).",
    );
  }

  return true;
}
