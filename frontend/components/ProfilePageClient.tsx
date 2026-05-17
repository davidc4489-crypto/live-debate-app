"use client";

import { ProfileClient } from "@/components/ProfileClient";
import { PublicProfile } from "@/lib/profile";
import { useAuthSession } from "@/lib/useAuthSession";

interface ProfilePageClientProps {
  profile: PublicProfile;
  userId: string;
}

export function ProfilePageClient({ profile, userId }: ProfilePageClientProps) {
  const { user } = useAuthSession();
  return <ProfileClient profile={profile} isOwner={user?.id === userId} />;
}
