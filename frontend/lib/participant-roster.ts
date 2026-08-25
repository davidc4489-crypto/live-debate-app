import { DebateListItem, DebateParticipant } from "@/lib/debate";
import { RoomParticipantSlot, RoomSummary } from "@/lib/types";

const WAITING: DebateParticipant = {
  userId: null,
  displayName: "En attente d'un participant",
};

export function rosterToParticipants(
  roster: RoomParticipantSlot[] | undefined,
): [DebateParticipant, DebateParticipant] | null {
  if (!roster?.length) return null;

  const slots: [DebateParticipant, DebateParticipant] = [WAITING, WAITING];
  for (const slot of roster) {
    const participant = { userId: slot.userId, displayName: slot.displayName };
    if (slot.position === 1) slots[0] = participant;
    if (slot.position === 2) slots[1] = participant;
  }
  return slots;
}

export function applyLiveRoster(
  debate: DebateListItem,
  roster: RoomParticipantSlot[] | undefined,
): DebateListItem {
  const participants = rosterToParticipants(roster);
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
