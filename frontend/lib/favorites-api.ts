import { getAuthHeaders } from "./auth";
import { DebateListItem } from "./debate";

function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
}

function requireAuthHeaders(): Record<string, string> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour gérer vos favoris");
  }
  return headers;
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

export async function fetchFavoriteIds(): Promise<string[]> {
  const response = await fetch(`${getBackendUrl()}/favorites/ids`, {
    headers: requireAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { debateIds: string[] };
  return data.debateIds;
}

export async function fetchFavorites(): Promise<DebateListItem[]> {
  const response = await fetch(`${getBackendUrl()}/favorites`, {
    headers: requireAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<DebateListItem[]>;
}

export async function addFavorite(debateId: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/favorites`, {
    method: "POST",
    headers: requireAuthHeaders(),
    body: JSON.stringify({ debateId }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function removeFavorite(debateId: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/favorites/${debateId}`, {
    method: "DELETE",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
