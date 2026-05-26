import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ParticipantPill } from "@/components/ParticipantPill";
import {
  DebateListItem,
  formatDebateDate,
  formatScheduledDate,
  getDebateAudienceLabel,
  getDebateCtaLabel,
} from "@/lib/debate";

interface DebateCardProps {
  debate: DebateListItem;
  trending?: boolean;
  isFavorite?: boolean;
  showFavorite?: boolean;
  favoriteLoading?: boolean;
  currentUserId?: string | null;
  onFavoriteToggle?: (debateId: string, nextFavorite: boolean) => void;
}

export function DebateCard({
  debate,
  trending = false,
  isFavorite = false,
  showFavorite = false,
  favoriteLoading = false,
  onFavoriteToggle,
  currentUserId = null,
}: DebateCardProps) {
  const ctaLabel = getDebateCtaLabel(debate.status, {
    currentUserId,
    pausedByUserId: debate.pausedByUserId,
    resumeRequestedAt: debate.resumeRequestedAt,
    participants: debate.participants,
  });
  const ctaIsPrimary =
    debate.status !== "finished" &&
    debate.status !== "cancelled" &&
    (debate.status !== "paused" || ctaLabel !== "Voir le débat");

  return (
    <article
      className={`debate-card reveal ${trending ? "debate-card--trending" : ""} ${debate.isLive ? "debate-card--live" : ""}`}
    >
      <div className="card-topline">
        <div className="card-topline-badges">
          <span className="theme-badge">{debate.theme}</span>
          {debate.isLive ? <span className="live-badge">En direct</span> : null}
          {debate.status === "finished" ? <span className="status-badge">Terminé</span> : null}
          {debate.status === "paused" ? <span className="status-badge">En pause</span> : null}
          {debate.status === "proposed" ? <span className="status-badge">Proposé</span> : null}
          {debate.status === "scheduled" ? <span className="status-badge status-badge--accent">Planifié</span> : null}
          {trending ? <span className="trend-badge">À la une</span> : null}
        </div>
        {showFavorite && onFavoriteToggle ? (
          <FavoriteButton
            isFavorite={isFavorite}
            disabled={favoriteLoading}
            onClick={() => onFavoriteToggle(debate.id, !isFavorite)}
          />
        ) : null}
      </div>

      <h3 className="debate-card-title">{debate.title}</h3>

      <div className="participants">
        {debate.participants.map((participant) => (
          <ParticipantPill
            key={participant.userId ?? participant.displayName}
            participant={participant}
          />
        ))}
      </div>

      {debate.status === "scheduled" && debate.scheduledAt ? (
        <p className="debate-scheduled-date">
          {formatScheduledDate(debate.scheduledAt)}
        </p>
      ) : null}

      <div className="debate-card-meta">
        <span>{debate.messagesCount} messages</span>
        <span aria-hidden="true">·</span>
        <span>{formatDebateDate(debate.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{getDebateAudienceLabel(debate)}</span>
      </div>

      <Link
        href={`/room/${debate.id}`}
        className={`btn w-full ${ctaIsPrimary ? "btn-primary" : "btn-secondary"}`}
      >
        {ctaLabel}
      </Link>
    </article>
  );
}
