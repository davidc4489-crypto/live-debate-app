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
 * `true` (tout accepter) — pratique en dev, à ne pas laisser en production.
 */
export function corsOrigin(): string[] | boolean {
  const origins = allowedOrigins();
  return origins.length > 0 ? origins : true;
}
