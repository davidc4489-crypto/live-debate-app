"use client";

import { useEffect, useState } from "react";
import { ProfileClient } from "@/components/ProfileClient";
import { ProfileFollowStats, PublicProfile } from "@/lib/profile";
import { fetchFollowStats } from "@/lib/follows-api";
import { useAuthSession } from "@/lib/useAuthSession";

interface ProfilePageClientProps {
  profile: PublicProfile;
  userId: string;
}

const defaultFollowStats: ProfileFollowStats = {
  followersCount: 0,
  followingCount: 0,
  isFollowing: false,
  followingListVisibility: "public",
};

export function ProfilePageClient({ profile: initialProfile, userId }: ProfilePageClientProps) {
  const { user } = useAuthSession();
  const isOwner = user?.id === userId;
  const [followStats, setFollowStats] = useState<ProfileFollowStats>(
    initialProfile.followStats ?? defaultFollowStats,
  );

  useEffect(() => {
    if (!user || isOwner) return;

    let cancelled = false;

    async function refreshFollowState() {
      try {
        const stats = await fetchFollowStats(userId);
        if (!cancelled) {
          setFollowStats((current) => ({
            ...stats,
            followingListVisibility: current.followingListVisibility,
          }));
        }
      } catch {
        // keep server values
      }
    }

    void refreshFollowState();
    return () => {
      cancelled = true;
    };
  }, [user, userId, isOwner]);

  function handleFollowChange(following: boolean) {
    setFollowStats((current) => ({
      ...current,
      isFollowing: following,
      followersCount: Math.max(0, current.followersCount + (following ? 1 : -1)),
    }));
  }

  const profile: PublicProfile = {
    ...initialProfile,
    followStats,
  };

  return (
    <ProfileClient
      profile={profile}
      isOwner={isOwner}
      canFollow={Boolean(user && !isOwner)}
      onFollowChange={handleFollowChange}
    />
  );
}
