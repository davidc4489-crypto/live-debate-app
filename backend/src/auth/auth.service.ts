import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { SignInDto } from "./dto/sign-in.dto";
import { SignUpDto } from "./dto/sign-up.dto";
import { AuthResponseDto, AuthUserDto } from "./auth.types";
import { emailConfirmRedirectUrl, passwordResetRedirectUrl } from "./frontend-url";

interface ProfileRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_premium: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async signUp(dto: SignUpDto): Promise<AuthResponseDto> {
    this.assertCredentials(dto.email, dto.password);

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.signUp({
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
      options: {
        emailRedirectTo: emailConfirmRedirectUrl(dto.redirectTo),
        data: {
          first_name: dto.firstName?.trim() || null,
          last_name: dto.lastName?.trim() || null,
        },
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user || !data.session) {
      throw new BadRequestException(
        "Compte créé. Vérifiez votre email pour confirmer l'inscription.",
      );
    }

    await this.ensureProfileIfNeeded(data.user.id, data.user.email!, {
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const profile = await this.getProfileById(data.user.id, data.session.access_token);
    return this.toAuthResponse(profile, data.session);
  }

  async signIn(dto: SignInDto): Promise<AuthResponseDto> {
    this.assertCredentials(dto.email, dto.password);

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException(
        error?.message || "Email ou mot de passe incorrect",
      );
    }

    const profile = await this.getProfileById(data.user.id, data.session.access_token);
    return this.toAuthResponse(profile, data.session);
  }

  async signOut(accessToken: string): Promise<{ success: true }> {
    const supabase = this.supabaseService.getClientWithToken(accessToken);
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async requestPasswordReset(
    email: string,
    redirectTo?: string,
  ): Promise<{ success: true; message: string }> {
    this.assertEmail(email);

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: passwordResetRedirectUrl(redirectTo) },
    );

    if (error) {
      this.logger.warn(`resetPasswordForEmail : ${error.message}`);
    }

    return {
      success: true,
      message:
        "Si un compte existe avec cette adresse, un email de réinitialisation vient d'être envoyé.",
    };
  }

  async resetPassword(
    accessToken: string,
    password: string,
    refreshToken?: string,
  ): Promise<{ success: true }> {
    this.assertPassword(password);

    const anon = this.supabaseService.getClient();
    const { data, error: userError } = await anon.auth.getUser(accessToken);

    if (userError || !data.user) {
      throw new UnauthorizedException(
        "Lien invalide ou expiré. Demandez un nouvel email de réinitialisation.",
      );
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = this.supabaseService.getServiceClient();
      const { error } = await admin.auth.admin.updateUserById(data.user.id, {
        password,
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return { success: true };
    }

    if (!refreshToken?.trim()) {
      throw new BadRequestException(
        "Session de réinitialisation incomplète. Rouvrez le lien reçu par email.",
      );
    }

    const supabase = this.supabaseService.getClient();
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken.trim(),
    });

    if (sessionError) {
      throw new UnauthorizedException(sessionError.message);
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  async getMe(accessToken: string): Promise<AuthUserDto> {
    const supabase = this.supabaseService.getClientWithToken(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException("Session invalide ou expirée");
    }

    return this.getProfileById(data.user.id, accessToken);
  }

  private async getProfileById(
    userId: string,
    accessToken: string,
  ): Promise<AuthUserDto> {
    const supabase = this.supabaseService.getClientWithToken(accessToken);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, is_premium")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        "Profil introuvable. Vérifiez que la migration Supabase est appliquée.",
      );
    }

    return this.mapProfile(data as ProfileRow);
  }

  private async ensureProfileIfNeeded(
    userId: string,
    email: string,
    names: { firstName?: string; lastName?: string },
  ): Promise<void> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    const supabase = this.supabaseService.getServiceClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("profiles")
        .update({
          first_name: names.firstName?.trim() || null,
          last_name: names.lastName?.trim() || null,
        })
        .eq("id", userId);
      return;
    }

    const { error } = await supabase.from("profiles").insert({
      id: userId,
      email: email.trim().toLowerCase(),
      first_name: names.firstName?.trim() || null,
      last_name: names.lastName?.trim() || null,
    });

    if (error) {
      throw new BadRequestException(
        `Impossible de créer le profil : ${error.message}`,
      );
    }
  }

  private mapProfile(row: ProfileRow): AuthUserDto {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      isPremium: row.is_premium,
    };
  }

  private toAuthResponse(
    user: AuthUserDto,
    session: { access_token: string; refresh_token: string; expires_at?: number },
  ): AuthResponseDto {
    return {
      user,
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at ?? null,
      },
    };
  }

  private assertCredentials(email?: string, password?: string): void {
    if (!email?.trim() || !password) {
      throw new BadRequestException("Email et mot de passe sont requis");
    }

    this.assertPassword(password);
    this.assertEmail(email);
  }

  private assertEmail(email?: string): void {
    if (!email?.trim()) {
      throw new BadRequestException("Adresse email requise");
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      throw new BadRequestException("Adresse email invalide");
    }
  }

  private assertPassword(password: string): void {
    if (!password || password.length < 6) {
      throw new BadRequestException(
        "Le mot de passe doit contenir au moins 6 caractères",
      );
    }
  }
}
