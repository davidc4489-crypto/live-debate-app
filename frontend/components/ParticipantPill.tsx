import Link from "next/link";
import { DebateParticipant } from "@/lib/debate";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface ParticipantPillProps {
  participant: DebateParticipant;
}

export function ParticipantPill({ participant }: ParticipantPillProps) {
  const inner = (
    <>
      <span className="avatar">{initials(participant.displayName)}</span>
      <span>{participant.displayName}</span>
    </>
  );

  if (participant.userId) {
    return (
      <Link
        href={`/profile/${participant.userId}`}
        className="participant-pill participant-pill-link"
      >
        {inner}
      </Link>
    );
  }

  return <div className="participant-pill">{inner}</div>;
}
