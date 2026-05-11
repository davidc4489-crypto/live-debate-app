import Link from "next/link";
import { MockDebate } from "@/mock/debates";

interface DebateCardProps {
  debate: MockDebate;
  trending?: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DebateCard({ debate, trending = false }: DebateCardProps) {
  return (
    <article className={`debate-card reveal ${trending ? "trending" : ""}`}>
      <div className="card-topline">
        <span className="theme-badge">{debate.theme}</span>
        {debate.isLive ? <span className="live-badge">LIVE</span> : null}
        {trending ? <span className="trend-badge">🔥 Trending</span> : null}
      </div>

      <h3>{debate.title}</h3>

      <div className="participants">
        {debate.participants.map((participant) => (
          <div key={participant} className="participant-pill">
            <span className="avatar">{initials(participant)}</span>
            <span>{participant}</span>
          </div>
        ))}
      </div>

      <div className="meta-row">
        <span>{debate.messagesCount} messages</span>
        <span>{debate.createdAt}</span>
      </div>
      <div className="meta-row">
        <span>{debate.views} vues</span>
        <span>{debate.spectators} spectateurs</span>
      </div>

      <Link href={`/room/${debate.id}`} className="btn btn-primary">
        Rejoindre
      </Link>
    </article>
  );
}
