import { DebateListItem, DebateParticipant } from "@/lib/debate";
import { RoomParticipantSlot, RoomSummary } from "@/lib/types";

const WAITING: DebateParticipant = {
  userId: null,
  displayName: "En attente d'un participant",
};

/**
 * Roster temps réel → participants affichables.
 *
 * `known` (les participants issus de la base) sert à conserver le camp défendu :
 * la room Socket.IO ne transporte que l'identité et le nom, sans cette reprise
 * le badge Pour/Contre disparaissait à la première mise à jour live.
 */
export function rosterToParticipants(
  roster: RoomParticipantSlot[] | undefined,
  known?: [DebateParticipant, DebateParticipant],
): [DebateParticipant, DebateParticipant] | null {
  if (!roster?.length) return null;

  const stanceAt = (index: 0 | 1, userId: string | null): DebateParticipant["stance"] => {
    const byId = known?.find((p) => p.userId && p.userId === userId)?.stance;
    return byId ?? known?.[index]?.stance ?? null;
  };

  const slots: [DebateParticipant, DebateParticipant] = [
    { ...WAITING, stance: known?.[0]?.stance ?? null },
    { ...WAITING, stance: known?.[1]?.stance ?? null },
  ];
  for (const slot of roster) {
    if (slot.position === 1) {
      slots[0] = { userId: slot.userId, displayName: slot.displayName, stance: stanceAt(0, slot.userId) };
    }
    if (slot.position === 2) {
      slots[1] = { userId: slot.userId, displayName: slot.displayName, stance: stanceAt(1, slot.userId) };
    }
  }
  return slots;
}

export function applyLiveRoster(
  debate: DebateListItem,
  roster: RoomParticipantSlot[] | undefined,
): DebateListItem {
  const participants = rosterToParticipants(roster, debate.participants);
  if (!participants) return debate;
  return { ...debate, participants };
}

/** Convertit une room Socket.IO en carte débat (accueil) quand la ligne DB n'est pas encore visible. */
export function roomSnapshotToListItem(room: RoomSummary): DebateListItem {
  const participants = rosterToParticipants(room.participantRoster) ?? [WAITING, WAITING];
  const isWaitingForOpponent =
    room.status !== "finished" && room.participants > 0 && room.participants < 2;

  return {
    id: room.id,
    title: room.title,
    theme: "Général",
    participants,
    messagesCount: room.messagesCount ?? 0,
    views: 0,
    spectators: room.spectators,
    createdAt: new Date().toISOString(),
    status: room.status === "finished" ? "finished" : isWaitingForOpponent ? "pending" : "active",
    isLive: room.status !== "finished",
  };
}

export function mergeLiveRoomsIntoDebateList(
  debates: DebateListItem[],
  rooms: RoomSummary[],
): DebateListItem[] {
  const byId = new Map(debates.map((debate) => [debate.id, debate]));

  for (const room of rooms) {
    if (room.status === "finished") continue;

    const existing = byId.get(room.id);
    if (existing) {
      byId.set(room.id, applyLiveRoster(existing, room.participantRoster));
      continue;
    }

    byId.set(room.id, roomSnapshotToListItem(room));
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Signature de la liste des rooms : identité + statut + effectifs.
 *
 * `roomsUpdated` est émis à chaque message et à chaque changement de tour. Sans
 * cette comparaison, chaque écran de liste relançait trois requêtes API à
 * chaque message envoyé dans n'importe quel débat, pour tous les visiteurs.
 */
export function roomsSignature(rooms: RoomSummary[]): string {
  return rooms
    .map((room) => `${room.id}:${room.status}:${room.participants}:${room.spectators}`)
    .sort()
    .join("|");
}
