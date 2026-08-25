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

export type DebateStatus =
  | "proposed"
  | "scheduled"
  | "pending"
  | "active"
  | "finished"
  | "cancelled"
  | "paused";

export type DebateStance = "for" | "against";

export interface DebateParticipant {
  userId: string | null;
  displayName: string;
  /** Camp défendu ; `null` pour les débats créés sans position déclarée. */
  stance?: DebateStance | null;
}

export const STANCE_LABEL: Record<DebateStance, string> = {
  for: "Pour",
  against: "Contre",
};

/** Suffixe de classe CSS : `stance-for` / `stance-against`. */
export function stanceClass(stance: DebateStance | null | undefined): string {
  return stance ? `stance-${stance}` : "";
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
  scheduledAt?: string | null;
  interestedUserId?: string | null;
}

export interface ProposedDebateListItem extends DebateListItem {
  interestedUserId: string | null;
  scheduledAt: string | null;
}

export interface ScheduledDebateListItem extends DebateListItem {
  interestedUserId: string | null;
  scheduledAt: string;
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
  if (status === "proposed") return "Voir la proposition";
  if (status === "scheduled") return "Voir la planification";
  if (status === "finished") return "Revoir le débat";
  if (status === "cancelled") return "Voir le sujet";

  if (status === "paused") {
    const userId = options?.currentUserId ?? null;
    const resumeRequested = Boolean(options?.resumeRequestedAt);

    if (!isDebateParticipant(userId, options?.participants)) {
      return "Voir le débat";
    }
    if (resumeRequested) {
      return "Valider la reprise";
    }
    // Les deux participants peuvent demander la reprise, plus seulement celui
    // qui a mis en pause : l'action est donc la même pour l'un et pour l'autre.
    return "Demander la reprise";
  }

  // Salle en attente : le créateur y retourne, un visiteur y prend la place.
  if (isDebateParticipant(options?.currentUserId, options?.participants)) {
    return "Retourner dans la salle";
  }

  return "Rejoindre le débat";
}

/** « 1 message » / « 3 messages » / « Aucun message ». */
export function formatMessageCount(count: number): string {
  if (count === 0) return "Aucun message";
  return `${count} message${count > 1 ? "s" : ""}`;
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
  scheduledAt?: string | null;
  interestedUserId?: string | null;
  participants: [DebateParticipant, DebateParticipant];
  messages: DebateMessage[];
  conclusions: DebateConclusion[];
  endedAt: string | null;
}

export const CONCLUSION_PROMPT =
  "Expliquez en quoi ce débat a été fertile, ce que vous avez appris de l'autre participant, et les points que vous retenez pour la suite.";

export const MAX_CONCLUSION_LENGTH = 3000;

export interface DebateScheduleProposal {
  id: string;
  proposedBy: string;
  proposedAt: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
  createdAt: string;
}

export interface DebateSchedulingState {
  debateId: string;
  status: DebateStatus;
  scheduledAt: string | null;
  interestedUserId: string | null;
  createdBy: string | null;
  pendingProposal: DebateScheduleProposal | null;
  proposals: DebateScheduleProposal[];
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

/**
 * Fuseau d'affichage des dates de débat.
 *
 * Il est explicite pour deux raisons :
 * 1. les cartes de débat sont rendues côté serveur (UTC sur Render) alors que
 *    le panneau de planification est rendu côté client — sans fuseau fixe, la
 *    même date s'affichait avec deux heures différentes selon l'écran ;
 * 2. les notifications envoyées par le backend utilisent le même fuseau, donc
 *    l'heure annoncée par email correspond à celle affichée dans l'interface.
 */
export const DEBATE_TIME_ZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Paris";

export function formatScheduledDate(
  isoDate: string,
  options?: { withTimeZoneLabel?: boolean },
): string {
  const formatted = new Date(isoDate).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEBATE_TIME_ZONE,
  });

  return options?.withTimeZoneLabel ? `${formatted} (heure de Paris)` : formatted;
}
