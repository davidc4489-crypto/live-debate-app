export class ForgotPasswordDto {
  email!: string;
  /** Origine frontend (ex. window.location.origin) pour le lien email Supabase */
  redirectTo?: string;
}
