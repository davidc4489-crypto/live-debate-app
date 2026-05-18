import { Injectable, NotFoundException } from "@nestjs/common";
import { buildDisplayName } from "../profiles/profile.utils";
import { SupabaseService } from "../supabase/supabase.service";
import {
  DebateConclusionDto,
  DebateDetailDto,
  DebateListItemDto,
  DebateParticipantDto,
} from "./debates.types";

interface ProfileRow {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface ParticipantRow {
  role: string;
  position: number | null;
  user_id: string;
  profiles: ProfileRow | ProfileRow[] | null;
}

interface MessageRow {
  id: string;
  content: string;
  created_at: string;
  profiles: ProfileRow | ProfileRow[] | null;
}

interface ConclusionRow {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: ProfileRow | ProfileRow[] | null;
}

export interface DebateRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  ended_at?: string | null;
  categories: { name: string } | { name: string }[] | null;
  messages: { id: string }[] | MessageRow[] | null;
  debate_participants: ParticipantRow[] | null;
  debate_views?: { id: string }[] | null;
}

function displayName(profile: ProfileRow): string {
  return buildDisplayName({
    username: profile.username,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
  });
}

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

@Injectable()
export class DebatesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listDebates(): Promise<DebateListItemDto[]> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select(
        `
        id,
        title,
        status,
        created_at,
        categories ( name ),
        messages ( id ),
        debate_participants (
          role,
          position,
          user_id,
          profiles ( id, username, first_name, last_name, email )
        ),
        debate_views ( id )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Impossible de charger les débats : ${error.message}`);
    }

    return this.rowsToListItems(data as DebateRow[]);
  }

  rowsToListItems(rows: DebateRow[]): DebateListItemDto[] {
    return rows.map((debate) => this.toListItem(debate));
  }

  async getDebateById(id: string): Promise<DebateDetailDto> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select(
        `
        id,
        title,
        status,
        created_at,
        ended_at,
        categories ( name ),
        messages (
          id,
          content,
          created_at,
          profiles ( first_name, last_name, email )
        ),
        debate_participants (
          role,
          position,
          user_id,
          profiles ( id, username, first_name, last_name, email )
        ),
        debate_conclusions (
          id,
          content,
          created_at,
          updated_at,
          user_id,
          profiles ( id, username, first_name, last_name, email )
        )
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new NotFoundException("Débat introuvable");
    }

    return this.toDetail(data as DebateRow);
  }

  private extractParticipants(debate: DebateRow): [DebateParticipantDto, DebateParticipantDto] {
    const participants = (debate.debate_participants ?? [])
      .filter((row) => row.role === "participant" && row.position != null)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((row) => {
        const profile = unwrapOne(row.profiles);
        const userId = row.user_id ?? profile?.id ?? null;
        return {
          userId,
          displayName: profile ? displayName(profile) : "Participant",
        };
      });

    return [
      participants[0] ?? { userId: null, displayName: "En attente d'un participant" },
      participants[1] ?? { userId: null, displayName: "En attente d'un participant" },
    ];
  }

  private toDetail(debate: DebateRow): DebateDetailDto {
    const category = unwrapOne(debate.categories);
    const messageRows = (debate.messages ?? []) as MessageRow[];

    const messages = messageRows
      .map((message) => {
        const profile = unwrapOne(message.profiles);
        return {
          id: message.id,
          author: profile ? displayName(profile) : "Participant",
          text: message.content,
          createdAt: message.created_at,
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const conclusionRows = (debate as DebateRow & { debate_conclusions?: ConclusionRow[] })
      .debate_conclusions ?? [];

    return {
      id: debate.id,
      title: debate.title,
      theme: category?.name ?? "Général",
      status: debate.status as "pending" | "active" | "finished",
      participants: this.extractParticipants(debate),
      messages,
      conclusions: this.mapConclusions(conclusionRows),
      endedAt: debate.ended_at ?? null,
    };
  }

  private mapConclusions(rows: ConclusionRow[]): DebateConclusionDto[] {
    return rows
      .map((row) => {
        const profile = unwrapOne(row.profiles);
        return {
          id: row.id,
          userId: row.user_id,
          displayName: profile ? displayName(profile) : "Participant",
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  private toListItem(debate: DebateRow): DebateListItemDto {
    const category = unwrapOne(debate.categories);
    const spectatorCount = (debate.debate_participants ?? []).filter(
      (row) => row.role === "spectator",
    ).length;

    return {
      id: debate.id,
      title: debate.title,
      theme: category?.name ?? "Général",
      participants: this.extractParticipants(debate),
      messagesCount: debate.messages?.length ?? 0,
      views: debate.debate_views?.length ?? 0,
      spectators: spectatorCount,
      createdAt: debate.created_at,
      status: debate.status as "pending" | "active" | "finished",
      isLive: debate.status === "active",
    };
  }
}
