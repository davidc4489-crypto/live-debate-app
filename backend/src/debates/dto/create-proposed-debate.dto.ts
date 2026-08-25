import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Bornes partagées par le chemin socket (débat live) et le DTO REST. */
export const DEBATE_TITLE_MIN = 3;
export const DEBATE_TITLE_MAX = 200;

export class CreateProposedDebateDto {
  @IsString()
  @MinLength(DEBATE_TITLE_MIN, {
    message: `Le titre doit contenir au moins ${DEBATE_TITLE_MIN} caractères`,
  })
  @MaxLength(DEBATE_TITLE_MAX, {
    message: `Le titre ne peut pas dépasser ${DEBATE_TITLE_MAX} caractères`,
  })
  title!: string;

  @IsOptional()
  @IsInt()
  @IsIn([180, 300, 600], { message: "Durée de tour invalide" })
  turnDuration?: number;

  @IsOptional()
  @IsIn(["for", "against"])
  creatorStance?: "for" | "against";
}
