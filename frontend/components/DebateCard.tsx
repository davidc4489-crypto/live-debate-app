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
    <article className={`debate-card reveal ${trending ? "trending" : ""}`}>
      <div className="card-topline">
        <div className="card-topline-badges">
          <span className="theme-badge">{debate.theme}</span>
          {debate.isLive ? <span className="live-badge">LIVE</span> : null}
          {debate.status === "finished" ? <span className="finished-badge">Terminé</span> : null}
          {debate.status === "paused" ? <span className="finished-badge">En pause</span> : null}
          {debate.status === "proposed" ? <span className="finished-badge">Proposé</span> : null}
          {debate.status === "scheduled" ? <span className="finished-badge">Planifié</span> : null}
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

      <h3>{debate.title}</h3>

      <div className="participants">
        {debate.participants.map((participant) => (
          <ParticipantPill
            key={participant.userId ?? participant.displayName}
            participant={participant}
          />
        ))}
      </div>

      {debate.status === "scheduled" && debate.scheduledAt ? (
        <p className="debate-scheduled-date muted">
          Prévu le {formatScheduledDate(debate.scheduledAt)}
        </p>
      ) : null}

      <div className="meta-row">
        <span>{debate.messagesCount} messages</span>
        <span>{formatDebateDate(debate.createdAt)}</span>
      </div>
      <div className="meta-row">
        <span>{getDebateAudienceLabel(debate)}</span>
      </div>

      <Link
        href={`/room/${debate.id}`}
        className={`btn ${ctaIsPrimary ? "btn-primary" : "btn-ghost"}`}
      >
        {ctaLabel}
      </Link>
    </article>
  );
}
