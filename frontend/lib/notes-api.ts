import { getAuthHeaders, getStoredAuth } from "./auth";

export interface NoteLink {
  debateId: string | null;
  debateTitle: string | null;
  messageId: string | null;
  messageExcerpt: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  link: NoteLink | null;
}

function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
}

function requireAuthHeaders(): Record<string, string> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour accéder à votre notebook");
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

export async function fetchNotes(): Promise<Note[]> {
  const response = await fetch(`${getBackendUrl()}/notes`, {
    headers: requireAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<Note[]>;
}

export async function createNote(input: {
  title: string;
  content?: string;
  debateId?: string;
  messageId?: string;
}): Promise<Note> {
  const response = await fetch(`${getBackendUrl()}/notes`, {
    method: "POST",
    headers: requireAuthHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<Note>;
}

export async function updateNote(
  id: string,
  input: {
    title?: string;
    content?: string;
    debateId?: string | null;
    messageId?: string | null;
  },
): Promise<Note> {
  const response = await fetch(`${getBackendUrl()}/notes/${id}`, {
    method: "PATCH",
    headers: requireAuthHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<Note>;
}

export async function deleteNote(id: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/notes/${id}`, {
    method: "DELETE",
    headers: requireAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredAuth()?.session.accessToken);
}
