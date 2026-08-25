import { IsISO8601 } from "class-validator";

export class ProposeScheduleDto {
  @IsISO8601({}, { message: "Date invalide" })
  proposedAt!: string;
}
