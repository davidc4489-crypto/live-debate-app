import { DebateListItem, DebateParticipant } from "@/lib/debate";
import { RoomParticipantSlot, RoomSnapshot } from "@/lib/types";

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
export function roomSnapshotToListItem(room: RoomSnapshot): DebateListItem {
  const participants = rosterToParticipants(room.participantRoster) ?? [WAITING, WAITING];
  const isWaitingForOpponent =
    room.status !== "finished" && room.participants > 0 && room.participants < 2;

  return {
    id: room.id,
    title: room.title,
    theme: "Général",
    participants,
    messagesCount: room.messages.length,
    views: 0,
    spectators: room.spectators,
    createdAt: new Date().toISOString(),
    status: room.status === "finished" ? "finished" : isWaitingForOpponent ? "pending" : "active",
    isLive: room.status !== "finished",
  };
}

export function mergeLiveRoomsIntoDebateList(
  debates: DebateListItem[],
  rooms: RoomSnapshot[],
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
