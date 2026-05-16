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
  session: AuthSessionDto;
}
