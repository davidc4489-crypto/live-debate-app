import { DebateListItem, DebateParticipant } from "@/lib/debate";
import { RoomParticipantSlot } from "@/lib/types";

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
