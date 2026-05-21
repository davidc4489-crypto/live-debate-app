/** Origines autorisées pour les redirections email Supabase (séparées par des virgules). */
export function resolveFrontendOrigin(requested?: string): string {
  const defaults = ["http://localhost:3000"];
  const fromEnv = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const allowed = fromEnv.length > 0 ? fromEnv : defaults;

  const candidate = requested?.trim().replace(/\/+$/, "");
  if (candidate) {
    try {
      const origin = new URL(candidate).origin;
      if (allowed.includes(origin)) {
        return origin;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return allowed[0];
}

export function emailConfirmRedirectUrl(requested?: string): string {
  return `${resolveFrontendOrigin(requested)}/auth/confirm`;
}

export function passwordResetRedirectUrl(requested?: string): string {
  return `${resolveFrontendOrigin(requested)}/auth/reset-password`;
}
