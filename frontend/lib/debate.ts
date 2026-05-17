export type DebateTheme =
  | "Politique"
  | "Technologie"
  | "Sport"
  | "Philosophie"
  | "Société"
  | "Économie";

export const debateThemes: DebateTheme[] = [
  "Politique",
  "Technologie",
  "Sport",
  "Philosophie",
  "Société",
  "Économie",
];

export type DebateStatus = "pending" | "active" | "finished";

export interface DebateParticipant {
  userId: string | null;
  displayName: string;
}

export interface DebateListItem {
  id: string;
  title: string;
  theme: string;
  participants: [DebateParticipant, DebateParticipant];
  messagesCount: number;
  views: number;
  spectators: number;
  createdAt: string;
  status: DebateStatus;
  isLive: boolean;
}

export function getDebateCtaLabel(status: DebateStatus): string {
  if (status === "finished") return "Revoir le débat";
  return "Rejoindre";
}

export interface DebateMessage {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface DebateDetail {
  id: string;
  title: string;
  theme: string;
  status: DebateStatus;
  participants: [DebateParticipant, DebateParticipant];
  messages: DebateMessage[];
  endedAt: string | null;
}

export function formatDebateDate(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "a l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
}
