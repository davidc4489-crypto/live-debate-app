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
  status: "pending" | "active" | "finished";
  createdAt: string;
  endedAt: string | null;
}

export interface PublicProfile {
  user: PublicProfileUser;
  interests: Interest[];
  stats: ProfileStats;
  debates: ProfileDebate[];
  debatesTotal: number;
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
