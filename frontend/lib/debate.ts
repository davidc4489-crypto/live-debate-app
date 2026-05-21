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

export type DebateStatus = "pending" | "active" | "finished" | "cancelled" | "paused";

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
  pausedByUserId?: string | null;
  resumeRequestedAt?: string | null;
}

export interface DebateCtaOptions {
  currentUserId?: string | null;
  pausedByUserId?: string | null;
  resumeRequestedAt?: string | null;
  participants?: [DebateParticipant, DebateParticipant];
}

function isDebateParticipant(
  userId: string | null | undefined,
  participants?: [DebateParticipant, DebateParticipant],
): boolean {
  if (!userId || !participants) return false;
  return participants.some((p) => p.userId === userId);
}

export function getDebateCtaLabel(status: DebateStatus, options?: DebateCtaOptions): string {
  if (status === "finished") return "Revoir le débat";
  if (status === "cancelled") return "Voir le sujet";

  if (status === "paused") {
    const userId = options?.currentUserId ?? null;
    const pausedBy = options?.pausedByUserId ?? null;
    const resumeRequested = Boolean(options?.resumeRequestedAt);

    if (!isDebateParticipant(userId, options?.participants)) {
      return "Voir le débat";
    }
    if (userId && pausedBy === userId) {
      return "Reprendre le débat";
    }
    if (resumeRequested) {
      return "Valider la reprise";
    }
    return "Débat en pause";
  }

  return "Rejoindre";
}

/** Débat terminé → vues ; en cours / en attente → spectateurs uniquement */
export function getDebateAudienceLabel(debate: {
  status: DebateStatus;
  views: number;
  spectators: number;
}): string {
  if (debate.status === "finished") {
    return `${debate.views} vue${debate.views !== 1 ? "s" : ""}`;
  }
  return `${debate.spectators} spectateur${debate.spectators !== 1 ? "s" : ""}`;
}

export function getDebatePopularityScore(debate: DebateListItem): number {
  return debate.status === "finished" ? debate.views : debate.spectators;
}

export interface DebateMessage {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface DebateConclusion {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebateDetail {
  id: string;
  title: string;
  theme: string;
  status: DebateStatus;
  createdBy: string | null;
  expiresAt: string | null;
  validatedAt: string | null;
  opponentJoinedAt: string | null;
  pausedByUserId?: string | null;
  resumeRequestedAt?: string | null;
  participants: [DebateParticipant, DebateParticipant];
  messages: DebateMessage[];
  conclusions: DebateConclusion[];
  endedAt: string | null;
}

export const CONCLUSION_PROMPT =
  "Expliquez en quoi ce débat a été fertile, ce que vous avez appris de l'autre participant, et les points que vous retenez pour la suite.";

export const MAX_CONCLUSION_LENGTH = 3000;

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
