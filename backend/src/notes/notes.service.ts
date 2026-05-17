import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateNoteDto } from "./dto/create-note.dto";
import { UpdateNoteDto } from "./dto/update-note.dto";
import { NoteDto, NoteLinkDto } from "./notes.types";

interface NoteRow {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  note_links:
    | {
        debate_id: string | null;
        message_id: string | null;
        debates: { title: string } | { title: string }[] | null;
        messages: { content: string } | { content: string }[] | null;
      }[]
    | null;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function excerpt(text: string, max = 120): string {
  const cleaned = text.trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

@Injectable()
export class NotesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
  ) {}

  async listNotes(accessToken: string): Promise<NoteDto[]> {
    const user = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .from("notes")
      .select(
        `
        id,
        title,
        content,
        user_id,
        created_at,
        updated_at,
        note_links (
          debate_id,
          message_id,
          debates ( title ),
          messages ( content )
        )
      `,
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new BadRequestException(`Impossible de charger les notes : ${error.message}`);
    }

    return (data as NoteRow[]).map((note) => this.toDto(note));
  }

  async createNote(accessToken: string, dto: CreateNoteDto): Promise<NoteDto> {
    const user = await this.authService.getMe(accessToken);
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException("Le titre est requis");
    }

    const { debateId, messageId } = await this.resolveLinkTargets(dto.debateId, dto.messageId);

    const supabase = this.supabaseService.getServiceClient();
    const { data: note, error } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        title,
        content: dto.content?.trim() ?? "",
      })
      .select("id")
      .single();

    if (error || !note) {
      throw new BadRequestException(`Impossible de créer la note : ${error?.message}`);
    }

    if (debateId || messageId) {
      await this.upsertLink(note.id, debateId, messageId);
    }

    return this.getNoteForUser(note.id, user.id);
  }

  async updateNote(
    accessToken: string,
    noteId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteDto> {
    const user = await this.authService.getMe(accessToken);
    await this.assertNoteOwner(noteId, user.id);

    const updates: Record<string, string> = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException("Le titre est requis");
      updates.title = title;
    }
    if (dto.content !== undefined) {
      updates.content = dto.content.trim();
    }

    const supabase = this.supabaseService.getServiceClient();
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("notes").update(updates).eq("id", noteId);
      if (error) {
        throw new BadRequestException(`Impossible de mettre à jour la note : ${error.message}`);
      }
    }

    if (dto.debateId !== undefined || dto.messageId !== undefined) {
      const debateId =
        dto.debateId === null ? null : dto.debateId ?? (await this.getExistingLink(noteId))?.debateId;
      const messageId =
        dto.messageId === null
          ? null
          : dto.messageId ?? (await this.getExistingLink(noteId))?.messageId;

      const resolved = await this.resolveLinkTargets(
        debateId ?? undefined,
        messageId ?? undefined,
        true,
      );

      await supabase.from("note_links").delete().eq("note_id", noteId);

      if (resolved.debateId || resolved.messageId) {
        await this.upsertLink(noteId, resolved.debateId, resolved.messageId);
      }
    }

    return this.getNoteForUser(noteId, user.id);
  }

  async deleteNote(accessToken: string, noteId: string): Promise<{ success: true }> {
    const user = await this.authService.getMe(accessToken);
    await this.assertNoteOwner(noteId, user.id);

    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase.from("notes").delete().eq("id", noteId);

    if (error) {
      throw new BadRequestException(`Impossible de supprimer la note : ${error.message}`);
    }

    return { success: true };
  }

  private async getNoteForUser(noteId: string, userId: string): Promise<NoteDto> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("notes")
      .select(
        `
        id,
        title,
        content,
        user_id,
        created_at,
        updated_at,
        note_links (
          debate_id,
          message_id,
          debates ( title ),
          messages ( content )
        )
      `,
      )
      .eq("id", noteId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new NotFoundException("Note introuvable");
    }

    return this.toDto(data as NoteRow);
  }

  private async assertNoteOwner(noteId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("notes")
      .select("id")
      .eq("id", noteId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException("Note introuvable");
    }
  }

  private async getExistingLink(noteId: string): Promise<NoteLinkDto | null> {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase
      .from("note_links")
      .select("debate_id, message_id")
      .eq("note_id", noteId)
      .maybeSingle();

    if (!data) return null;
    return {
      debateId: data.debate_id,
      debateTitle: null,
      messageId: data.message_id,
      messageExcerpt: null,
    };
  }

  private async resolveLinkTargets(
    debateId?: string,
    messageId?: string,
    allowEmpty = false,
  ): Promise<{ debateId: string | null; messageId: string | null }> {
    if (!debateId && !messageId) {
      if (allowEmpty) return { debateId: null, messageId: null };
      return { debateId: null, messageId: null };
    }

    const supabase = this.supabaseService.getServiceClient();
    let resolvedDebateId = debateId?.trim() || null;
    const resolvedMessageId = messageId?.trim() || null;

    if (resolvedMessageId) {
      const { data: message, error } = await supabase
        .from("messages")
        .select("id, debate_id")
        .eq("id", resolvedMessageId)
        .maybeSingle();

      if (error || !message) {
        throw new BadRequestException("Message introuvable");
      }

      if (resolvedDebateId && resolvedDebateId !== message.debate_id) {
        throw new BadRequestException("Le message ne correspond pas au débat sélectionné");
      }

      resolvedDebateId = message.debate_id;
    }

    if (resolvedDebateId) {
      const { data: debate, error } = await supabase
        .from("debates")
        .select("id")
        .eq("id", resolvedDebateId)
        .maybeSingle();

      if (error || !debate) {
        throw new BadRequestException("Débat introuvable");
      }
    }

    return { debateId: resolvedDebateId, messageId: resolvedMessageId };
  }

  private async upsertLink(
    noteId: string,
    debateId: string | null,
    messageId: string | null,
  ): Promise<void> {
    if (!debateId && !messageId) return;

    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase.from("note_links").insert({
      note_id: noteId,
      debate_id: debateId,
      message_id: messageId,
    });

    if (error) {
      throw new BadRequestException(`Impossible de lier la note : ${error.message}`);
    }
  }

  private toDto(note: NoteRow): NoteDto {
    const linkRow = note.note_links?.[0];
    let link: NoteLinkDto | null = null;

    if (linkRow) {
      const debate = unwrapOne(linkRow.debates);
      const message = unwrapOne(linkRow.messages);
      link = {
        debateId: linkRow.debate_id,
        debateTitle: debate?.title ?? null,
        messageId: linkRow.message_id,
        messageExcerpt: message ? excerpt(message.content) : null,
      };
    }

    return {
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      link,
    };
  }
}
