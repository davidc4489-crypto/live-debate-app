export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isPremium: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface AuthPayload {
  user: AuthUser;
  /** `null` tant que l'email n'est pas confirmé (aucune session ouverte). */
  session: AuthSession | null;
  requiresEmailConfirmation?: boolean;
  message?: string;
}

const STORAGE_KEY = "ld_auth_session";

function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
}

export function getStoredAuth(): AuthPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthPayload;
  } catch {
    return null;
  }
}

export function saveAuth(payload: AuthPayload): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const stored = getStoredAuth();
  if (!stored?.session?.accessToken) {
    return {};
  }
  return {
    Authorization: `Bearer ${stored.session.accessToken}`,
    "Content-Type": "application/json",
  };
}

export function getDisplayName(user: AuthUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email.split("@")[0];
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (data.message) return data.message;
  } catch {
    // ignore
  }
  return "Une erreur est survenue";
}

function getFrontendRedirectOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

export async function signUp(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthPayload> {
  const response = await fetch(`${getBackendUrl()}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      redirectTo: getFrontendRedirectOrigin(),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as AuthPayload;
  // Confirmation d'email activée : pas encore de session à stocker.
  if (payload.session) saveAuth(payload);
  return payload;
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  const response = await fetch(`${getBackendUrl()}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as AuthPayload;
  saveAuth(payload);
  return payload;
}

export async function signOut(): Promise<void> {
  const stored = getStoredAuth();
  if (stored?.session?.accessToken) {
    await fetch(`${getBackendUrl()}/auth/signout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stored.session.accessToken}`,
      },
    }).catch(() => undefined);
  }
  clearAuth();
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await fetch(`${getBackendUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      redirectTo: getFrontendRedirectOrigin(),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { message?: string };
  return data.message ?? "Email envoyé si le compte existe.";
}

export async function resetPassword(
  accessToken: string,
  password: string,
  refreshToken?: string,
): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password, refreshToken }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

/** Marge avant expiration à partir de laquelle on renouvelle le jeton. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let refreshInFlight: Promise<AuthPayload | null> | null = null;

/**
 * Échange le refresh token contre une nouvelle session.
 *
 * Les appels concurrents partagent la même promesse : sans cela, plusieurs
 * composants montés en même temps consommeraient le même refresh token en
 * parallèle et Supabase invaliderait la session.
 */
export async function refreshSession(): Promise<AuthPayload | null> {
  if (refreshInFlight) return refreshInFlight;

  const stored = getStoredAuth();
  const refreshToken = stored?.session?.refreshToken;
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearAuth();
        return null;
      }

      const payload = (await response.json()) as AuthPayload;
      saveAuth(payload);
      return payload;
    } catch {
      // Réseau indisponible : on garde la session locale, elle sera retentée.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Renouvelle la session si elle expire bientôt. Sans effet sinon. */
export async function ensureFreshSession(): Promise<AuthPayload | null> {
  const stored = getStoredAuth();
  if (!stored?.session?.refreshToken) return null;

  const expiresAt = stored.session.expiresAt;
  if (expiresAt && expiresAt * 1000 - Date.now() > REFRESH_MARGIN_MS) {
    return stored;
  }

  return refreshSession();
}

export async function fetchMe(): Promise<AuthUser | null> {
  const stored = await ensureFreshSession();
  const session = (stored ?? getStoredAuth())?.session;
  if (!session?.accessToken) return null;

  const request = (token: string) =>
    fetch(`${getBackendUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let response = await request(session.accessToken);

  // 401 malgré la marge (horloge décalée, session révoquée) : un essai de plus.
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed?.session) {
      clearAuth();
      return null;
    }
    response = await request(refreshed.session.accessToken);
  }

  if (!response.ok) {
    if (response.status === 401) clearAuth();
    return null;
  }

  const user = (await response.json()) as AuthUser;
  const current = getStoredAuth();
  if (current?.session) saveAuth({ user, session: current.session });
  return user;
}
