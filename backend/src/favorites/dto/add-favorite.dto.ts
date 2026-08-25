import { IsUUID } from "class-validator";

export class AddFavoriteDto {
  @IsUUID(undefined, { message: "Identifiant de débat invalide" })
  debateId!: string;
}
