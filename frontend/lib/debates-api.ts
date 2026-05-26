import { getAuthHeaders } from "./auth";
import {
  DebateConclusion,
  DebateDetail,
  DebateListItem,
  DebateSchedulingState,
  ProposedDebateListItem,
  ScheduledDebateListItem,
} from "./debate";

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

export async function fetchProposedDebates(): Promise<ProposedDebateListItem[]> {
  const response = await fetch(`${getBackendUrl()}/debates/proposed`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Impossible de charger les débats proposés");
  }

  return response.json() as Promise<ProposedDebateListItem[]>;
}

export async function fetchScheduledDebates(): Promise<ScheduledDebateListItem[]> {
  const response = await fetch(`${getBackendUrl()}/debates/scheduled`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Impossible de charger les débats planifiés");
  }

  return response.json() as Promise<ScheduledDebateListItem[]>;
}

export async function createProposedDebate(
  title: string,
  turnDuration: 180 | 300 | 600,
): Promise<{ id: string; title: string; status: "proposed" }> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour proposer un débat.");
  }

  const response = await fetch(`${getBackendUrl()}/debates/proposed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ title, turnDuration }),
  });

  if (!response.ok) {
    const { message } = await parseApiError(response);
    throw new Error(message);
  }

  return response.json() as Promise<{ id: string; title: string; status: "proposed" }>;
}

export async function rejectDebateInterest(debateId: string): Promise<void> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour refuser cette candidature.");
  }

  const response = await fetch(`${getBackendUrl()}/debates/${debateId}/interest/reject`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const { message } = await parseApiError(response);
    throw new Error(message);
  }
}

export async function expressDebateInterest(debateId: string): Promise<void> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour vous proposer.");
  }

  const response = await fetch(`${getBackendUrl()}/debates/${debateId}/interest`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const { message } = await parseApiError(response);
    throw new Error(message);
  }
}

export async function fetchSchedulingState(debateId: string): Promise<DebateSchedulingState> {
  const response = await fetch(`${getBackendUrl()}/debates/${debateId}/scheduling`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Impossible de charger la planification");
  }

  return response.json() as Promise<DebateSchedulingState>;
}

export async function proposeDebateSchedule(
  debateId: string,
  proposedAt: string,
): Promise<void> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour proposer une date.");
  }

  const response = await fetch(`${getBackendUrl()}/debates/${debateId}/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ proposedAt }),
  });

  if (!response.ok) {
    const { message } = await parseApiError(response);
    throw new Error(message);
  }
}

export async function respondToDebateSchedule(
  debateId: string,
  action: "accept" | "reject" | "counter",
  proposedAt?: string,
): Promise<void> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error("Connectez-vous pour répondre.");
  }

  const response = await fetch(`${getBackendUrl()}/debates/${debateId}/schedule/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ action, proposedAt }),
  });

  if (!response.ok) {
    const { message } = await parseApiError(response);
    throw new Error(message);
  }
}
