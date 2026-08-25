import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

/** `null` est une valeur métier (effacer le champ) : on ne valide que les non-null. */
const NotNull = () => ValidateIf((_, value) => value !== null && value !== undefined);

export class UpdateProfileDto {
  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(30)
  username?: string | null;

  @IsOptional()
  @NotNull()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { message: "URL d'avatar invalide" })
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(500, { message: "La bio ne peut pas dépasser 500 caractères" })
  bio?: string | null;

  @IsOptional()
  @NotNull()
  @IsInt()
  @Min(13, { message: "Âge invalide" })
  @Max(120, { message: "Âge invalide" })
  age?: number | null;

  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(60)
  firstName?: string | null;

  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(60)
  lastName?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID(undefined, { each: true })
  interestIds?: string[];

  @IsOptional()
  @IsIn(["public", "private"])
  followingListVisibility?: "public" | "private";
}
