export type DebateStatus =
  | "proposed"
  | "scheduled"
  | "pending"
  | "active"
  | "finished"
  | "cancelled"
  | "paused";

export interface DebateParticipantDto {
  userId: string | null;
  displayName: string;
}

export interface DebateMessageDto {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface DebateConclusionDto {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebateDetailDto {
  id: string;
  title: string;
  theme: string;
  status: DebateStatus;
  createdBy: string | null;
  expiresAt: string | null;
  validatedAt: string | null;
  opponentJoinedAt: string | null;
  pausedByUserId?: string | null;
  resumeRequestedAt?: string | null;
  participants: [DebateParticipantDto, DebateParticipantDto];
  messages: DebateMessageDto[];
  conclusions: DebateConclusionDto[];
  endedAt: string | null;
  scheduledAt?: string | null;
  interestedUserId?: string | null;
}

export interface DebateScheduleProposalDto {
  id: string;
  proposedBy: string;
  proposedAt: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
  createdAt: string;
}

export interface DebateSchedulingStateDto {
  debateId: string;
  status: DebateStatus;
  scheduledAt: string | null;
  interestedUserId: string | null;
  createdBy: string | null;
  pendingProposal: DebateScheduleProposalDto | null;
  proposals: DebateScheduleProposalDto[];
}

export interface ProposedDebateListItemDto extends DebateListItemDto {
  interestedUserId: string | null;
  scheduledAt: string | null;
}

export interface ScheduledDebateListItemDto extends DebateListItemDto {
  interestedUserId: string | null;
  scheduledAt: string;
}

export interface DebateListItemDto {
  id: string;
  title: string;
  theme: string;
  participants: [DebateParticipantDto, DebateParticipantDto];
  messagesCount: number;
  views: number;
  spectators: number;
  createdAt: string;
  status: DebateStatus;
  isLive: boolean;
  pausedByUserId?: string | null;
  resumeRequestedAt?: string | null;
  scheduledAt?: string | null;
  interestedUserId?: string | null;
}
