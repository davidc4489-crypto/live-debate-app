export interface NoteLinkDto {
  debateId: string | null;
  debateTitle: string | null;
  messageId: string | null;
  messageExcerpt: string | null;
}

export interface NoteDto {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  link: NoteLinkDto | null;
}
