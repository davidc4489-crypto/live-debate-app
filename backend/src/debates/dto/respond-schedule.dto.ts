import { IsIn, IsISO8601, IsOptional, ValidateIf } from "class-validator";

export class RespondScheduleDto {
  @IsIn(["accept", "reject", "counter"], { message: "Action invalide." })
  action!: "accept" | "reject" | "counter";

  /** Requis uniquement pour une contre-proposition. */
  @ValidateIf((dto: RespondScheduleDto) => dto.action === "counter")
  @IsISO8601({}, { message: "Date invalide" })
  @IsOptional()
  proposedAt?: string;
}
