export interface Interest {
  id: string;
  name: string;
  slug: string;
}

export interface PublicProfileUser {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  age: number | null;
  isPremium: boolean;
  memberSince: string;
  displayName: string;
}

export interface ProfileStats {
  debatesParticipatedCount: number;
  messagesCount: number;
  debatesCreatedCount: number;
  profileScore: number;
}

export interface ProfileDebate {
  id: string;
  title: string;
  theme: string;
  status:
    | "proposed"
    | "scheduled"
    | "pending"
    | "active"
    | "finished"
    | "cancelled"
    | "paused";
  createdAt: string;
  endedAt: string | null;
}

export interface ProfileFollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followingListVisibility: "public" | "private";
}

export interface PublicProfile {
  user: PublicProfileUser;
  interests: Interest[];
  stats: ProfileStats;
  followStats: ProfileFollowStats;
  debates: ProfileDebate[];
  debatesTotal: number;
}

export interface FollowedUser {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  followedAt: string;
}

export interface AppNotification {
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

export function getProfileScoreLabel(score: number): string {
  if (score >= 80) return "Expert du débat";
  if (score >= 50) return "Orateur confirmé";
  if (score >= 20) return "Participant actif";
  return "Nouveau venu";
}

export function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}
