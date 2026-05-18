export class SignUpDto {
  email!: string;
  password!: string;
  firstName?: string;
  lastName?: string;
  /** Origine du frontend (ex. https://live-debate-app.vercel.app) pour le lien de confirmation email. */
  redirectTo?: string;
}
