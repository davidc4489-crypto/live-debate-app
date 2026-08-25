import { IsEmail, IsOptional, IsUrl, MaxLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Adresse email invalide" })
  @MaxLength(254)
  email!: string;

  /** Origine frontend (ex. window.location.origin) pour le lien email Supabase */
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectTo?: string;
}
