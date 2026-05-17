export type DebateStatus = "pending" | "active" | "finished";

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

export interface DebateDetailDto {
  id: string;
  title: string;
  theme: string;
  status: DebateStatus;
  participants: [DebateParticipantDto, DebateParticipantDto];
  messages: DebateMessageDto[];
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
