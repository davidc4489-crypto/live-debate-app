import { getAuthHeaders } from "./auth";
import { Interest, PublicProfile } from "./profile";

function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
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

export async function fetchPublicProfile(
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<PublicProfile> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));

  const query = params.toString();
  const url = `${getBackendUrl()}/users/${userId}/profile${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Profil introuvable");
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<PublicProfile>;
}

export async function fetchInterests(): Promise<Interest[]> {
  const response = await fetch(`${getBackendUrl()}/interests`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<Interest[]>;
}

export async function updateOwnProfile(input: {
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  age?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  interestIds?: string[];
  followingListVisibility?: "public" | "private";
}): Promise<PublicProfile> {
  const response = await fetch(`${getBackendUrl()}/users/me/profile`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<PublicProfile>;
}
