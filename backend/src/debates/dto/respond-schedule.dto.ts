export class RespondScheduleDto {
  action?: "accept" | "reject" | "counter";
  proposedAt?: string;
}
