import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "crypto";
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

  /**
   * Cache court des jetons validés.
   *
   * `getMe()` est appelé à chaque requête REST authentifiée **et** à chaque
   * action Socket.IO (démarrer, terminer, mettre en pause…). Sans cache, chaque
   * clic coûtait deux allers-retours Supabase (getUser + profils).
   */
  private readonly sessionCache = new Map<string, { user: AuthUserDto; expiresAt: number }>();
  private readonly sessionCacheTtlMs = Number(process.env.AUTH_CACHE_TTL_MS || 60_000);
  private readonly sessionCacheMax = 5_000;

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

    if (!data.user) {
      throw new BadRequestException("Inscription impossible, réessayez.");
    }

    // Confirmation d'email activée : compte créé mais pas encore de session.
    // Ce n'est pas une erreur — on le signale explicitement au client.
    if (!data.session) {
      await this.ensureProfileIfNeeded(data.user.id, data.user.email!, {
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      return {
        user: {
          id: data.user.id,
          email: data.user.email ?? dto.email.trim().toLowerCase(),
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          isPremium: false,
        },
        session: null,
        requiresEmailConfirmation: true,
        message: "Compte créé. Vérifiez votre email pour confirmer l'inscription.",
      };
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

  /**
   * Renouvelle la session à partir du refresh token.
   *
   * Sans cet appel, le jeton Supabase expire au bout d'une heure et
   * l'utilisateur est déconnecté en plein débat.
   */
  async refreshSession(refreshToken: string): Promise<AuthResponseDto> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException("Session expirée, reconnectez-vous.");
    }

    const profile = await this.getProfileById(data.user.id, data.session.access_token);
    return this.toAuthResponse(profile, data.session);
  }

  async signOut(accessToken: string): Promise<{ success: true }> {
    this.invalidateSession(accessToken);
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
    this.invalidateSession(accessToken);

    const anon = this.supabaseService.getClient();
    const { data, error: userError } = await anon.auth.getUser(accessToken);

    if (userError || !data.user) {
      throw new UnauthorizedException(
        "Lien invalide ou expiré. Demandez un nouvel email de réinitialisation.",
      );
    }

    // Le chemin « admin » contourne toute revérification : on ne l'ouvre qu'aux
    // jetons issus d'un lien de récupération, jamais à un jeton de session
    // ordinaire — sinon un jeton volé suffirait à s'approprier le compte.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && this.isRecoveryToken(accessToken)) {
      const admin = this.supabaseService.getServiceClient();
      const { error } = await admin.auth.admin.updateUserById(data.user.id, {
        password,
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      // Le mot de passe a changé : les autres sessions doivent tomber.
      await admin.auth.admin
        .signOut(accessToken, "global")
        .catch(() => undefined);

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
    const cacheKey = this.tokenKey(accessToken);
    const cached = this.sessionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      this.sessionCache.delete(cacheKey);
      throw new UnauthorizedException("Session invalide ou expirée");
    }

    const user = await this.getProfileById(data.user.id, accessToken);
    this.cacheSession(cacheKey, user);
    return user;
  }

  private tokenKey(accessToken: string): string {
    return createHash("sha256").update(accessToken).digest("hex");
  }

  private cacheSession(key: string, user: AuthUserDto): void {
    if (this.sessionCache.size >= this.sessionCacheMax) {
      const now = Date.now();
      for (const [entryKey, entry] of this.sessionCache) {
        if (entry.expiresAt <= now) this.sessionCache.delete(entryKey);
      }
      if (this.sessionCache.size >= this.sessionCacheMax) {
        this.sessionCache.clear();
      }
    }
    this.sessionCache.set(key, {
      user,
      expiresAt: Date.now() + this.sessionCacheTtlMs,
    });
  }

  /** Invalide le cache d'un jeton (déconnexion, changement de mot de passe). */
  private invalidateSession(accessToken: string): void {
    this.sessionCache.delete(this.tokenKey(accessToken));
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

  /**
   * Vrai si le JWT Supabase provient d'un flux de récupération (lien email) et
   * non d'une connexion par mot de passe.
   *
   * La signature a déjà été vérifiée par `auth.getUser()` juste avant : on se
   * contente ici de lire les revendications.
   */
  private isRecoveryToken(accessToken: string): boolean {
    try {
      const [, payload] = accessToken.split(".");
      if (!payload) return false;
      const claims = JSON.parse(
        Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
      ) as {
        amr?: Array<{ method?: string }>;
        session_id?: string;
      };

      const methods = (claims.amr ?? []).map((entry) => entry.method);
      // `recovery` / `otp` / `magiclink` = lien email ; `password` = connexion classique.
      const recoveryMethods = ["recovery", "otp", "magiclink", "email", "invite"];
      if (methods.length === 0) {
        // Jeton sans AMR (anciens projets Supabase) : on refuse le chemin admin
        // et on retombe sur setSession + updateUser, qui reste sûr.
        return false;
      }
      return methods.some((method) => method && recoveryMethods.includes(method));
    } catch {
      return false;
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
