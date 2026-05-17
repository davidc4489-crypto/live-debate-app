export interface InterestDto {
  id: string;
  name: string;
  slug: string;
}

export interface PublicProfileUserDto {
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

export interface ProfileStatsDto {
  debatesParticipatedCount: number;
  messagesCount: number;
  debatesCreatedCount: number;
  profileScore: number;
}

export interface ProfileDebateDto {
  id: string;
  title: string;
  theme: string;
  status: "pending" | "active" | "finished";
  createdAt: string;
  endedAt: string | null;
}

export interface ProfileFollowStatsDto {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followingListVisibility: "public" | "private";
}

export interface PublicProfileDto {
  user: PublicProfileUserDto;
  interests: InterestDto[];
  stats: ProfileStatsDto;
  followStats: ProfileFollowStatsDto;
  debates: ProfileDebateDto[];
  debatesTotal: number;
}
