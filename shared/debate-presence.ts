/** Événement Socket.IO `debatePresence` — aligné backend gateway et frontend client. */
export type DebatePresenceKind =
  | "paused"
  | "finished"
  | "participant_left"
  | "resume_requested"
  | "resumed";

/** Corps émis par le gateway (sans `roomId` ni `snapshot`). */
export interface DebatePresenceEvent {
  kind: DebatePresenceKind;
  actorUserId: string;
  actorDisplayName: string;
  message: string;
}
