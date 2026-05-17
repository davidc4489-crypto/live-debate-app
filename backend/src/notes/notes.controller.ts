import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { CreateNoteDto } from "./dto/create-note.dto";
import { UpdateNoteDto } from "./dto/update-note.dto";
import { NotesService } from "./notes.service";

@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  listNotes(@Headers("authorization") authorization?: string) {
    return this.notesService.listNotes(this.extractBearerToken(authorization));
  }

  @Post()
  createNote(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateNoteDto,
  ) {
    return this.notesService.createNote(this.extractBearerToken(authorization), body);
  }

  @Patch(":id")
  updateNote(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Body() body: UpdateNoteDto,
  ) {
    return this.notesService.updateNote(this.extractBearerToken(authorization), id, body);
  }

  @Delete(":id")
  deleteNote(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    return this.notesService.deleteNote(this.extractBearerToken(authorization), id);
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
