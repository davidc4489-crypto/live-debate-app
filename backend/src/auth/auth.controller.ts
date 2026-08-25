import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SignInDto } from "./dto/sign-in.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { SignUpDto } from "./dto/sign-up.dto";

@Controller("auth")
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @RateLimit(5, 60 * 60 * 1000)
  signUp(@Body() body: SignUpDto) {
    return this.authService.signUp(body);
  }

  @Post("signin")
  @RateLimit(10, 5 * 60 * 1000)
  signIn(@Body() body: SignInDto) {
    return this.authService.signIn(body);
  }

  @Post("signout")
  signOut(@Headers("authorization") authorization?: string) {
    const token = this.extractBearerToken(authorization);
    return this.authService.signOut(token);
  }

  @Post("refresh")
  @RateLimit(30, 60 * 1000)
  refresh(@Body() body: RefreshSessionDto) {
    return this.authService.refreshSession(body.refreshToken);
  }

  @Get("me")
  getMe(@Headers("authorization") authorization?: string) {
    const token = this.extractBearerToken(authorization);
    return this.authService.getMe(token);
  }

  @Post("forgot-password")
  @RateLimit(3, 15 * 60 * 1000)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(body.email, body.redirectTo);
  }

  @Post("reset-password")
  @RateLimit(5, 15 * 60 * 1000)
  resetPassword(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ResetPasswordDto,
  ) {
    const token = this.extractBearerToken(authorization);
    return this.authService.resetPassword(
      token,
      body.password,
      body.refreshToken,
    );
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }

    return token;
  }
}
