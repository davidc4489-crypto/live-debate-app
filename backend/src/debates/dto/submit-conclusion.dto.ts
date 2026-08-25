import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const CONCLUSION_MAX = 5_000;

export class SubmitConclusionDto {
  @IsString()
  @MinLength(1, { message: "La conclusion ne peut pas être vide" })
  @MaxLength(CONCLUSION_MAX, { message: "Conclusion trop longue (5 000 caractères max)" })
  content!: string;

  /** Si true, l'utilisateur a confirmé après un avertissement modération. */
  @IsOptional()
  @IsBoolean()
  confirmWarn?: boolean;
}
