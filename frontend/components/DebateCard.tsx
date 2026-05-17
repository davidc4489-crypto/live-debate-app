import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ParticipantPill } from "@/components/ParticipantPill";
import {
  DebateListItem,
  formatDebateDate,
  getDebateAudienceLabel,
  getDebateCtaLabel,
} from "@/lib/debate";

interface DebateCardProps {
  debate: DebateListItem;
  trending?: boolean;
  isFavorite?: boolean;
  showFavorite?: boolean;
  favoriteLoading?: boolean;
  onFavoriteToggle?: (debateId: string, nextFavorite: boolean) => void;
}

export function DebateCard({
  debate,
  trending = false,
  isFavorite = false,
  showFavorite = false,
  favoriteLoading = false,
  onFavoriteToggle,
}: DebateCardProps) {
  return (
    <article className={`debate-card reveal ${trending ? "trending" : ""}`}>
      <div className="card-topline">
        <div className="card-topline-badges">
          <span className="theme-badge">{debate.theme}</span>
          {debate.isLive ? <span className="live-badge">LIVE</span> : null}
          {debate.status === "finished" ? <span className="finished-badge">Terminé</span> : null}
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

      <div className="meta-row">
        <span>{debate.messagesCount} messages</span>
        <span>{formatDebateDate(debate.createdAt)}</span>
      </div>
      <div className="meta-row">
        <span>{getDebateAudienceLabel(debate)}</span>
      </div>

      <Link
        href={`/room/${debate.id}`}
        className={`btn ${debate.status === "finished" ? "btn-ghost" : "btn-primary"}`}
      >
        {getDebateCtaLabel(debate.status)}
      </Link>
    </article>
  );
}
