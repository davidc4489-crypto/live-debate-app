/**
 * Origine publique du site, utilisée par les métadonnées de partage,
 * `robots.txt` et le sitemap.
 *
 * Renseignez `NEXT_PUBLIC_APP_URL` en production : sans elle, les liens
 * partagés (réseaux sociaux, messageries) pointeraient vers localhost.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  // Fourni automatiquement par Vercel sur les déploiements de prévisualisation.
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
