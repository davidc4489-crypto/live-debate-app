import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignInDto } from "./dto/sign-in.dto";
import { SignUpDto } from "./dto/sign-up.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  signUp(@Body() body: SignUpDto) {
    return this.authService.signUp(body);
  }

  @Post("signin")
  signIn(@Body() body: SignInDto) {
    return this.authService.signIn(body);
  }

  @Post("signout")
  signOut(@Headers("authorization") authorization?: string) {
    const token = this.extractBearerToken(authorization);
    return this.authService.signOut(token);
  }

  @Get("me")
  getMe(@Headers("authorization") authorization?: string) {
    const token = this.extractBearerToken(authorization);
    return this.authService.getMe(token);
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
