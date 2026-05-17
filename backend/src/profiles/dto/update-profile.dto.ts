export class UpdateProfileDto {
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  age?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  interestIds?: string[];
  followingListVisibility?: "public" | "private";
}
