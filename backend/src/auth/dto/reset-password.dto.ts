import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  @MaxLength(128)
  password!: string;

  /** Fourni par le lien email (hash) si pas de clé service Supabase côté serveur */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  refreshToken?: string;
}
