import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_MAX = 20_000;

export class CreateNoteDto {
  @IsString()
  @MinLength(1, { message: "Le titre est requis" })
  @MaxLength(NOTE_TITLE_MAX)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_CONTENT_MAX, { message: "Note trop longue (20 000 caractères max)" })
  content?: string;

  @IsOptional()
  @IsUUID()
  debateId?: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;
}
