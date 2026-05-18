export type DebateStatus = "pending" | "active" | "finished" | "cancelled";

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
  participants: [DebateParticipantDto, DebateParticipantDto];
  messages: DebateMessageDto[];
  conclusions: DebateConclusionDto[];
  endedAt: string | null;
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
}
