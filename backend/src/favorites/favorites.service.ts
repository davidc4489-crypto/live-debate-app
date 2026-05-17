import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { DebateRow, DebatesService } from "../debates/debates.service";
import { DebateListItemDto } from "../debates/debates.types";
import { SupabaseService } from "../supabase/supabase.service";
import { FavoriteIdsDto } from "./favorites.types";

interface FavoriteRow {
  debate_id: string;
  debates: DebateRow | DebateRow[] | null;
}

const DEBATE_SELECT = `
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
`;

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

@Injectable()
export class FavoritesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
    private readonly debatesService: DebatesService,
  ) {}

  async listFavoriteIds(accessToken: string): Promise<FavoriteIdsDto> {
    const user = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .from("favorites")
      .select("debate_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new BadRequestException(`Impossible de charger les favoris : ${error.message}`);
    }

    return { debateIds: (data ?? []).map((row) => row.debate_id) };
  }

  async listFavorites(accessToken: string): Promise<DebateListItemDto[]> {
    const user = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .from("favorites")
      .select(`debate_id, debates ( ${DEBATE_SELECT} )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new BadRequestException(`Impossible de charger les favoris : ${error.message}`);
    }

    const debateRows = (data as FavoriteRow[])
      .map((row) => unwrapOne(row.debates))
      .filter((debate): debate is DebateRow => Boolean(debate));

    return this.debatesService.rowsToListItems(debateRows);
  }

  async addFavorite(accessToken: string, debateId: string): Promise<{ success: true }> {
    const user = await this.authService.getMe(accessToken);
    const normalizedId = debateId?.trim();
    if (!normalizedId) {
      throw new BadRequestException("Identifiant de débat invalide");
    }
    await this.assertDebateExists(normalizedId);

    const supabase = this.supabaseService.getServiceClient();
    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("debate_id", normalizedId)
      .maybeSingle();

    if (existing) {
      return { success: true };
    }

    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      debate_id: normalizedId,
    });

    if (error) {
      throw new BadRequestException(`Impossible d'ajouter aux favoris : ${error.message}`);
    }

    return { success: true };
  }

  async removeFavorite(accessToken: string, debateId: string): Promise<{ success: true }> {
    const user = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("debate_id", debateId.trim());

    if (error) {
      throw new BadRequestException(`Impossible de retirer des favoris : ${error.message}`);
    }

    return { success: true };
  }

  private async assertDebateExists(debateId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("debates")
      .select("id")
      .eq("id", debateId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException("Débat introuvable");
    }
  }
}
