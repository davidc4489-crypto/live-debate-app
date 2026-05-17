export type DebateStatus = "pending" | "active" | "finished";

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
  participants: [string, string];
  messages: DebateMessageDto[];
  endedAt: string | null;
}

export interface DebateListItemDto {
  id: string;
  title: string;
  theme: string;
  participants: [string, string];
  messagesCount: number;
  views: number;
  spectators: number;
  createdAt: string;
  status: DebateStatus;
  isLive: boolean;
}
