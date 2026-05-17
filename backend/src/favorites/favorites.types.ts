import { DebateListItemDto } from "../debates/debates.types";

export interface FavoriteIdsDto {
  debateIds: string[];
}

export type FavoriteDebateListDto = DebateListItemDto[];
