export class CreateProposedDebateDto {
  title?: string;
  turnDuration?: number;
  creatorStance?: "for" | "against";
  opponentMode?: "human" | "ai";
}
