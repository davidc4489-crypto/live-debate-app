import { Controller, Get, Param } from "@nestjs/common";
import { DebatesService } from "./debates.service";

@Controller("debates")
export class DebatesController {
  constructor(private readonly debatesService: DebatesService) {}

  @Get()
  listDebates() {
    return this.debatesService.listDebates();
  }

  @Get(":id")
  getDebate(@Param("id") id: string) {
    return this.debatesService.getDebateById(id);
  }
}
