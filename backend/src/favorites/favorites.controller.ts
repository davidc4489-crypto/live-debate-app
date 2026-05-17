import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AddFavoriteDto } from "./dto/add-favorite.dto";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  listFavorites(@Headers("authorization") authorization?: string) {
    return this.favoritesService.listFavorites(this.extractBearerToken(authorization));
  }

  @Get("ids")
  listFavoriteIds(@Headers("authorization") authorization?: string) {
    return this.favoritesService.listFavoriteIds(this.extractBearerToken(authorization));
  }

  @Post()
  addFavorite(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: AddFavoriteDto,
  ) {
    return this.favoritesService.addFavorite(this.extractBearerToken(authorization), body.debateId);
  }

  @Delete(":debateId")
  removeFavorite(
    @Headers("authorization") authorization: string | undefined,
    @Param("debateId") debateId: string,
  ) {
    return this.favoritesService.removeFavorite(this.extractBearerToken(authorization), debateId);
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
