import { IsString, MaxLength, MinLength } from "class-validator";

export class RefreshSessionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2048)
  refreshToken!: string;
}
