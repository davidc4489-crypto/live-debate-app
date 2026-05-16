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
  session: AuthSession;
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

export async function signUp(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthPayload> {
  const response = await fetch(`${getBackendUrl()}/auth/signup`, {
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
  if (stored?.session.accessToken) {
    await fetch(`${getBackendUrl()}/auth/signout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stored.session.accessToken}`,
      },
    }).catch(() => undefined);
  }
  clearAuth();
}

export async function fetchMe(): Promise<AuthUser | null> {
  const stored = getStoredAuth();
  if (!stored?.session.accessToken) return null;

  const response = await fetch(`${getBackendUrl()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${stored.session.accessToken}`,
    },
  });

  if (!response.ok) {
    clearAuth();
    return null;
  }

  const user = (await response.json()) as AuthUser;
  saveAuth({ user, session: stored.session });
  return user;
}
