import { DebateDetail, DebateListItem } from "./debate";

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
