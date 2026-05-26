export interface FollowUserDto {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  followedAt: string;
}

export interface FollowStatsDto {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followingListVisibility: "public" | "private";
}

export interface NotificationDto {
  id: string;
  type:
    | "new_debate"
    | "opponent_joined"
    | "debate_interest"
    | "schedule_proposed"
    | "schedule_accepted"
    | "schedule_counter"
    | "debate_scheduled_start"
    | "debate_interest_rejected";
  actorId: string | null;
  actorDisplayName: string | null;
  debateId: string | null;
  roomId: string | null;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
