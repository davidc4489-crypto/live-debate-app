import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { buildDisplayName } from "../profiles/profile.utils";
import { SupabaseService } from "../supabase/supabase.service";
import { FollowStatsDto, FollowUserDto, NotificationDto } from "./follows.types";

interface ProfileSnippetRow {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  following_list_visibility: "public" | "private";
}

interface FollowRow {
  follower_id: string;
  following_id: string;
  created_at: string;
  profiles: ProfileSnippetRow | ProfileSnippetRow[] | null;
}

interface NotificationRow {
  id: string;
  type: string;
  actor_id: string | null;
  debate_id: string | null;
  room_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  profiles: ProfileSnippetRow | ProfileSnippetRow[] | null;
}

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService,
  ) {}

  async getFollowStats(
    targetUserId: string,
    viewerAccessToken?: string,
  ): Promise<FollowStatsDto> {
    await this.assertProfileExists(targetUserId);
    const supabase = this.supabaseService.getServiceClient();

    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from("user_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", targetUserId),
      supabase
        .from("user_follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", targetUserId),
    ]);

    let isFollowing = false;
    if (viewerAccessToken) {
      try {
        const viewer = await this.authService.getMe(viewerAccessToken);
        if (viewer.id !== targetUserId) {
          const { data } = await supabase
            .from("user_follows")
            .select("follower_id")
            .eq("follower_id", viewer.id)
            .eq("following_id", targetUserId)
            .maybeSingle();
          isFollowing = Boolean(data);
        }
      } catch {
        isFollowing = false;
      }
    }

    const { data: visRow } = await supabase
      .from("profiles")
      .select("following_list_visibility")
      .eq("id", targetUserId)
      .maybeSingle();

    return {
      followersCount: followersResult.count ?? 0,
      followingCount: followingResult.count ?? 0,
      isFollowing,
      followingListVisibility:
        (visRow?.following_list_visibility as "public" | "private") ?? "public",
    };
  }

  async followUser(accessToken: string, targetUserId: string): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    if (me.id === targetUserId) {
      throw new BadRequestException("Vous ne pouvez pas vous suivre vous-même");
    }
    await this.assertProfileExists(targetUserId);

    const supabase = this.supabaseService.getServiceClient();
    const { data: existing } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", me.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (existing) return { success: true };

    const { error } = await supabase.from("user_follows").insert({
      follower_id: me.id,
      following_id: targetUserId,
    });

    if (error) {
      throw new BadRequestException(`Impossible de suivre cet utilisateur : ${error.message}`);
    }

    return { success: true };
  }

  async unfollowUser(accessToken: string, targetUserId: string): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", me.id)
      .eq("following_id", targetUserId);

    if (error) {
      throw new BadRequestException(`Impossible de se désabonner : ${error.message}`);
    }

    return { success: true };
  }

  async listMyFollowing(accessToken: string): Promise<{ users: FollowUserDto[]; isPrivate: boolean }> {
    const me = await this.authService.getMe(accessToken);
    return this.listFollowing(me.id, accessToken);
  }

  async listFollowing(
    targetUserId: string,
    viewerAccessToken?: string,
  ): Promise<{ users: FollowUserDto[]; isPrivate: boolean }> {
    await this.assertProfileExists(targetUserId);
    const supabase = this.supabaseService.getServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, following_list_visibility")
      .eq("id", targetUserId)
      .single();

    const visibility = profile?.following_list_visibility ?? "public";
    let viewerId: string | null = null;
    if (viewerAccessToken) {
      try {
        viewerId = (await this.authService.getMe(viewerAccessToken)).id;
      } catch {
        viewerId = null;
      }
    }

    const canView =
      visibility === "public" || viewerId === targetUserId;

    if (!canView) {
      return { users: [], isPrivate: true };
    }

    const { data, error } = await supabase
      .from("user_follows")
      .select(
        `
        following_id,
        created_at,
        profiles:following_id (
          id,
          username,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `,
      )
      .eq("follower_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new BadRequestException(`Impossible de charger les abonnements : ${error.message}`);
    }

    const users = (data as FollowRow[])
      .map((row) => {
        const profile = unwrapOne(row.profiles);
        if (!profile) return null;
        return {
          userId: profile.id,
          displayName: buildDisplayName(profile),
          username: profile.username,
          avatarUrl: profile.avatar_url,
          followedAt: row.created_at,
        };
      })
      .filter((row): row is FollowUserDto => Boolean(row));

    return { users, isPrivate: false };
  }

  async listNotifications(accessToken: string): Promise<NotificationDto[]> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .from("notifications")
      .select(
        `
        id,
        type,
        actor_id,
        debate_id,
        room_id,
        title,
        message,
        read,
        created_at,
        profiles:actor_id (
          id,
          username,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `,
      )
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new BadRequestException(`Impossible de charger les notifications : ${error.message}`);
    }

    return (data as NotificationRow[]).map((row) => {
      const actor = unwrapOne(row.profiles);
      return {
        id: row.id,
        type: row.type as NotificationDto["type"],
        actorId: row.actor_id,
        actorDisplayName: actor ? buildDisplayName(actor) : null,
        debateId: row.debate_id,
        roomId: row.room_id,
        title: row.title,
        message: row.message,
        read: row.read,
        createdAt: row.created_at,
      };
    });
  }

  async markNotificationRead(
    accessToken: string,
    notificationId: string,
  ): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", me.id);

    if (error) {
      throw new BadRequestException(`Notification introuvable`);
    }

    return { success: true };
  }

  async markAllNotificationsRead(accessToken: string): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", me.id)
      .eq("read", false);

    return { success: true };
  }

  async deleteNotification(
    accessToken: string,
    notificationId: string,
  ): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", me.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new BadRequestException("Notification introuvable");
    }

    return { success: true };
  }

  async deleteAllNotifications(accessToken: string): Promise<{ success: true }> {
    const me = await this.authService.getMe(accessToken);
    const supabase = this.supabaseService.getServiceClient();

    const { error } = await supabase.from("notifications").delete().eq("user_id", me.id);

    if (error) {
      throw new BadRequestException(
        `Impossible de supprimer les notifications : ${error.message}`,
      );
    }

    return { success: true };
  }

  async notifyFollowersNewDebate(
    creatorId: string,
    debateOrRoomId: string,
    debateTitle: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    const { data: creator } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, email")
      .eq("id", creatorId)
      .maybeSingle();

    const creatorName = creator ? buildDisplayName(creator) : "Un utilisateur";

    const { data: followers, error } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", creatorId);

    if (error || !followers?.length) return;

    const rows = followers.map((row) => ({
      user_id: row.follower_id,
      type: "new_debate" as const,
      actor_id: creatorId,
      debate_id: debateOrRoomId,
      room_id: debateOrRoomId,
      title: "Nouveau débat",
      message: `${creatorName} a créé un débat : « ${debateTitle} »`,
    }));

    await supabase.from("notifications").insert(rows);
  }

  async notifyCreatorOpponentJoined(
    creatorId: string,
    opponentId: string,
    debateId: string,
    opponentDisplayName: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", creatorId)
      .eq("debate_id", debateId)
      .eq("type", "opponent_joined")
      .limit(1)
      .maybeSingle();

    if (existing) {
      return;
    }

    const name = opponentDisplayName.trim() || "Un participant";
    const { error } = await supabase.from("notifications").insert({
      user_id: creatorId,
      type: "opponent_joined",
      actor_id: opponentId,
      debate_id: debateId,
      room_id: debateId,
      title: "Votre débat peut commencer",
      message: `${name} a rejoint votre débat. Validez le lancement pour ouvrir les tours de parole.`,
    });

    if (error) {
      // notification non bloquante
    }
  }

  private async assertProfileExists(userId: string): Promise<void> {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!data) {
      throw new NotFoundException("Utilisateur introuvable");
    }
  }
}
