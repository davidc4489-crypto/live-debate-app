import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class SignInDto {
  @IsEmail({}, { message: "Adresse email invalide" })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1, { message: "Mot de passe requis" })
  @MaxLength(128)
  password!: string;
}
