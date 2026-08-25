import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const DEBATE_TITLE_MAX = 200;

export class CreateProposedDebateDto {
  @IsString()
  @MinLength(3, { message: "Le titre doit contenir au moins 3 caractères" })
  @MaxLength(DEBATE_TITLE_MAX)
  title!: string;

  @IsOptional()
  @IsInt()
  @IsIn([180, 300, 600], { message: "Durée de tour invalide" })
  turnDuration?: number;

  @IsOptional()
  @IsIn(["for", "against"])
  creatorStance?: "for" | "against";

  @IsOptional()
  @IsIn(["human", "ai"])
  opponentMode?: "human" | "ai";
}
