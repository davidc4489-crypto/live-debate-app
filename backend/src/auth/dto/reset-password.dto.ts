export class ResetPasswordDto {
  password!: string;
  /** Fourni par le lien email (hash) si pas de clé service Supabase côté serveur */
  refreshToken?: string;
}
