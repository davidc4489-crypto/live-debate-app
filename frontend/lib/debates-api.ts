import { getAuthHeaders } from "./auth";
import { DebateConclusion, DebateDetail, DebateListItem } from "./debate";

export class ConclusionSubmitError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
}

export async function fetchDebates(): Promise<DebateListItem[]> {
  const response = await fetch(`${getBackendUrl()}/debates`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Impossible de charger les debats");
  }

  return response.json() as Promise<DebateListItem[]>;
}

export async function fetchDebate(id: string): Promise<DebateDetail | null> {
  const response = await fetch(`${getBackendUrl()}/debates/${id}`, {
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Impossible de charger le debat");
  }

  return response.json() as Promise<DebateDetail>;
}

async function parseApiError(response: Response): Promise<{ message: string; code?: string }> {
  try {
    const data = (await response.json()) as {
      message?: string | string[] | { message?: string; code?: string };
      code?: string;
    };
    if (typeof data.message === "object" && data.message && !Array.isArray(data.message)) {
      return {
        message: data.message.message || "Une erreur est survenue",
        code: data.message.code,
      };
    }
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : (data.message as string) || "Une erreur est survenue";
    return { message, code: data.code };
  } catch {
    return { message: "Une erreur est survenue" };
  }
}

export async function submitConclusion(
  debateId: string,
  content: string,
  confirmWarn = false,
): Promise<DebateConclusion> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new ConclusionSubmitError("Connectez-vous pour soumettre votre conclusion.");
  }

  const response = await fetch(`${getBackendUrl()}/debates/${debateId}/conclusions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ content, confirmWarn }),
  });

  if (!response.ok) {
    const { message, code } = await parseApiError(response);
    throw new ConclusionSubmitError(message, code);
  }

  return response.json() as Promise<DebateConclusion>;
}
