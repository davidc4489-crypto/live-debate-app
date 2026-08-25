import Link from "next/link";
import { DebateParticipant, STANCE_LABEL, stanceClass } from "@/lib/debate";

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
  /** Masque le badge Pour/Contre là où le camp est déjà affiché à côté. */
  hideStance?: boolean;
}

export function ParticipantPill({ participant, hideStance = false }: ParticipantPillProps) {
  const stance = participant.stance ?? null;
  const showStance = Boolean(stance) && !hideStance;

  const inner = (
    <>
      <span className="avatar">{initials(participant.displayName)}</span>
      <span className="participant-pill-name">{participant.displayName}</span>
      {showStance && stance ? (
        <span className={`stance-badge ${stanceClass(stance)}`}>{STANCE_LABEL[stance]}</span>
      ) : null}
    </>
  );

  const classes = `participant-pill ${stanceClass(stance)}`.trim();

  if (participant.userId) {
    return (
      <Link href={`/profile/${participant.userId}`} className={`${classes} participant-pill-link`}>
        {inner}
      </Link>
    );
  }

  return <div className={`${classes} participant-pill-waiting`}>{inner}</div>;
}
