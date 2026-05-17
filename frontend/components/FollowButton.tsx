"use client";

import { useState } from "react";
import { followUser, unfollowUser } from "@/lib/follows-api";

interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
}

export function FollowButton({ userId, initialFollowing, onChange }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
        onChange?.(false);
      } else {
        await followUser(userId);
        setFollowing(true);
        onChange?.(true);
      }
    } catch {
      // erreur silencieuse — l'utilisateur peut réessayer
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${following ? "btn-ghost" : "btn-primary"}`}
      onClick={() => void handleClick()}
      disabled={loading}
    >
      {loading ? "…" : following ? "Abonné" : "Suivre"}
    </button>
  );
}
