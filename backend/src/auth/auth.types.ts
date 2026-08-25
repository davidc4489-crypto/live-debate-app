export interface AuthUserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isPremium: boolean;
}

export interface AuthSessionDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  /** `null` quand la confirmation d'email est requise avant toute session. */
  session: AuthSessionDto | null;
  /** Présent uniquement à l'inscription avec confirmation d'email activée. */
  requiresEmailConfirmation?: boolean;
  message?: string;
}
