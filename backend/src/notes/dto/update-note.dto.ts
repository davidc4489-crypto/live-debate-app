import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";
import { NOTE_CONTENT_MAX, NOTE_TITLE_MAX } from "./create-note.dto";

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Le titre est requis" })
  @MaxLength(NOTE_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_CONTENT_MAX, { message: "Note trop longue (20 000 caractères max)" })
  content?: string;

  // `null` = délier la note du débat/message.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  debateId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  messageId?: string | null;
}
