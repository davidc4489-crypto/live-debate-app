import { IsEmail, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class SignUpDto {
  @IsEmail({}, { message: "Adresse email invalide" })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  @MaxLength(128, { message: "Mot de passe trop long" })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  /** Origine du frontend (ex. https://live-debate-app.vercel.app) pour le lien de confirmation email. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectTo?: string;
}
