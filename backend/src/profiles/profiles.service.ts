import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { FollowsService } from "../follows/follows.service";
import { SupabaseService } from "../supabase/supabase.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { buildDisplayName } from "./profile.utils";
import {
  InterestDto,
  PublicProfileDto,
  PublicProfileUserDto,
} from "./profiles.types";

interface RpcProfilePayload {
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    age: number | null;
    isPremium: boolean;
    memberSince: string;
  };
  interests: InterestDto[];
  stats: {
    debatesParticipatedCount: number;
    messagesCount: number;
    debatesCreatedCount: number;
    profileScore: number;
  };
  debates: {
    id: string;
    title: string;
    theme: string;
    status: string;
    createdAt: string;
    endedAt: string | null;
  }[];
  debatesTotal: number;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
    private readonly followsService: FollowsService,
  ) {}

  async listInterests(): Promise<InterestDto[]> {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from("interests")
      .select("id, name, slug")
      .order("name");

    if (error) {
      if (error.message.includes("interests") && error.message.includes("schema cache")) {
        throw new BadRequestException(
          "La table « interests » n'existe pas encore. Appliquez la migration supabase/migrations/00003_user_profiles.sql dans le SQL Editor Supabase (voir README).",
        );
      }
      throw new BadRequestException(`Impossible de charger les intérêts : ${error.message}`);
    }

    return (data ?? []) as InterestDto[];
  }

  async getPublicProfile(
    userId: string,
    options?: { limit?: number; offset?: number; viewerToken?: string },
  ): Promise<PublicProfileDto> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase.rpc("get_public_user_profile", {
      p_user_id: userId,
      p_debates_limit: limit,
      p_debates_offset: offset,
    });

    let profile: PublicProfileDto;
    if (error) {
      profile = await this.getPublicProfileFallback(userId, limit, offset);
    } else if (!data) {
      throw new NotFoundException("Profil introuvable");
    } else {
      profile = this.mapRpcPayload(data as RpcProfilePayload);
    }

    return this.attachFollowStats(profile, userId, options?.viewerToken);
  }

  async updateOwnProfile(
    accessToken: string,
    dto: UpdateProfileDto,
  ): Promise<PublicProfileDto> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const updates: Record<string, string | number | null> = {};

    if (dto.username !== undefined) {
      const username = dto.username?.trim() || null;
      if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        throw new BadRequestException(
          "Le nom d'utilisateur doit faire 3 à 30 caractères (lettres, chiffres, _)",
        );
      }
      if (username) {
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", username)
          .neq("id", me.id)
          .maybeSingle();

        if (taken) {
          throw new BadRequestException("Ce nom d'utilisateur est déjà pris");
        }
      }
      updates.username = username;
    }

    if (dto.avatarUrl !== undefined) {
      const url = dto.avatarUrl?.trim() || null;
      if (url && url.length > 2048) {
        throw new BadRequestException("URL d'avatar trop longue");
      }
      updates.avatar_url = url;
    }

    if (dto.bio !== undefined) {
      const bio = dto.bio?.trim() || null;
      if (bio && bio.length > 500) {
        throw new BadRequestException("La bio ne peut pas dépasser 500 caractères");
      }
      updates.bio = bio;
    }

    if (dto.age !== undefined) {
      if (dto.age !== null && (dto.age < 13 || dto.age > 120)) {
        throw new BadRequestException("L'âge doit être entre 13 et 120 ans");
      }
      updates.age = dto.age;
    }

    if (dto.firstName !== undefined) {
      updates.first_name = dto.firstName?.trim() || null;
    }

    if (dto.lastName !== undefined) {
      updates.last_name = dto.lastName?.trim() || null;
    }

    if (dto.followingListVisibility !== undefined) {
      if (dto.followingListVisibility !== "public" && dto.followingListVisibility !== "private") {
        throw new BadRequestException("Visibilité invalide (public ou private)");
      }
      updates.following_list_visibility = dto.followingListVisibility;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("profiles").update(updates).eq("id", me.id);
      if (error) {
        throw new BadRequestException(`Impossible de mettre à jour le profil : ${error.message}`);
      }
    }

    if (dto.interestIds !== undefined) {
      await this.replaceUserInterests(me.id, dto.interestIds);
    }

    return this.getPublicProfile(me.id);
  }

  private async replaceUserInterests(userId: string, interestIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(interestIds.map((id) => id.trim()).filter(Boolean))];
    const supabase = this.supabaseService.getServiceClient();

    if (uniqueIds.length > 0) {
      const { data: valid, error: validError } = await supabase
        .from("interests")
        .select("id")
        .in("id", uniqueIds);

      if (validError) {
        throw new BadRequestException(`Intérêts invalides : ${validError.message}`);
      }

      if ((valid ?? []).length !== uniqueIds.length) {
        throw new BadRequestException("Un ou plusieurs centres d'intérêt sont invalides");
      }
    }

    const { error: deleteError } = await supabase
      .from("user_interests")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      throw new BadRequestException(
        `Impossible de mettre à jour les intérêts : ${deleteError.message}`,
      );
    }

    if (uniqueIds.length === 0) return;

    const { error: insertError } = await supabase.from("user_interests").insert(
      uniqueIds.map((interestId) => ({
        user_id: userId,
        interest_id: interestId,
      })),
    );

    if (insertError) {
      throw new BadRequestException(
        `Impossible d'enregistrer les intérêts : ${insertError.message}`,
      );
    }
  }

  private mapRpcPayload(payload: RpcProfilePayload): PublicProfileDto {
    const user: PublicProfileUserDto = {
      ...payload.user,
      displayName: buildDisplayName({
        username: payload.user.username,
        firstName: payload.user.firstName,
        lastName: payload.user.lastName,
      }),
    };

    return {
      user,
      interests: payload.interests ?? [],
      stats: {
        debatesParticipatedCount: payload.stats.debatesParticipatedCount ?? 0,
        messagesCount: payload.stats.messagesCount ?? 0,
        debatesCreatedCount: payload.stats.debatesCreatedCount ?? 0,
        profileScore: payload.stats.profileScore ?? 0,
      },
      followStats: {
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        followingListVisibility: "public",
      },
      debates: (payload.debates ?? []).map((debate) => ({
        id: debate.id,
        title: debate.title,
        theme: debate.theme,
        status: debate.status as "pending" | "active" | "finished",
        createdAt: debate.createdAt,
        endedAt: debate.endedAt,
      })),
      debatesTotal: payload.debatesTotal ?? 0,
    };
  }

  /** Repli si la migration RPC n'est pas encore appliquée */
  private async getPublicProfileFallback(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PublicProfileDto> {
    const supabase = this.supabaseService.getServiceClient();

    const [
      profileResult,
      interestsResult,
      debatesResult,
      participatedResult,
      messagesResult,
      createdResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, first_name, last_name, avatar_url, bio, age, is_premium, created_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_interests")
        .select("interests ( id, name, slug )")
        .eq("user_id", userId),
      supabase
        .from("debate_participants")
        .select(
          `
          debates (
            id,
            title,
            status,
            created_at,
            ended_at,
            categories ( name )
          )
        `,
        )
        .eq("user_id", userId)
        .eq("role", "participant")
        .order("joined_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from("debate_participants")
        .select("debate_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("role", "participant"),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("debates")
        .select("id", { count: "exact", head: true })
        .eq("created_by", userId),
    ]);

    if (profileResult.error || !profileResult.data) {
      throw new NotFoundException("Profil introuvable");
    }

    const row = profileResult.data;
    const interests: InterestDto[] = (interestsResult.data ?? [])
      .map((item) => {
        const raw = item.interests as InterestDto | InterestDto[] | null;
        return Array.isArray(raw) ? raw[0] : raw;
      })
      .filter((item): item is InterestDto => Boolean(item));

    const debates = (debatesResult.data ?? [])
      .map((item) => {
        const debate = item.debates as {
          id: string;
          title: string;
          status: string;
          created_at: string;
          ended_at: string | null;
          categories: { name: string } | { name: string }[] | null;
        } | {
          id: string;
          title: string;
          status: string;
          created_at: string;
          ended_at: string | null;
          categories: { name: string } | { name: string }[] | null;
        }[] | null;

        const d = Array.isArray(debate) ? debate[0] : debate;
        if (!d) return null;

        const category = Array.isArray(d.categories) ? d.categories[0] : d.categories;

        return {
          id: d.id,
          title: d.title,
          theme: category?.name ?? "Général",
          status: d.status as "pending" | "active" | "finished",
          createdAt: d.created_at,
          endedAt: d.ended_at,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const participated = participatedResult.count ?? 0;
    const messages = messagesResult.count ?? 0;
    const created = createdResult.count ?? 0;

    return {
      user: {
        id: row.id,
        username: row.username,
        firstName: row.first_name,
        lastName: row.last_name,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        age: row.age,
        isPremium: row.is_premium,
        memberSince: row.created_at,
        displayName: buildDisplayName({
          username: row.username,
          firstName: row.first_name,
          lastName: row.last_name,
        }),
      },
      interests,
      stats: {
        debatesParticipatedCount: participated,
        messagesCount: messages,
        debatesCreatedCount: created,
        profileScore: Math.min(100, messages * 2 + participated * 10 + created * 15),
      },
      debates,
      debatesTotal: participated,
      followStats: {
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        followingListVisibility: "public",
      },
    };
  }

  private async attachFollowStats(
    profile: PublicProfileDto,
    userId: string,
    viewerToken?: string,
  ): Promise<PublicProfileDto> {
    const supabase = this.supabaseService.getServiceClient();
    const { data: visRow } = await supabase
      .from("profiles")
      .select("following_list_visibility")
      .eq("id", userId)
      .maybeSingle();

    const stats = await this.followsService.getFollowStats(userId, viewerToken);

    return {
      ...profile,
      followStats: {
        ...stats,
        followingListVisibility:
          (visRow?.following_list_visibility as "public" | "private") ?? "public",
      },
    };
  }
}
