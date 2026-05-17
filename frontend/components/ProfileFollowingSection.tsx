"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FollowedUser } from "@/lib/profile";
import { fetchFollowingList } from "@/lib/follows-api";

interface ProfileFollowingSectionProps {
  userId: string;
  isOwner: boolean;
  visibility: "public" | "private";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileFollowingSection({
  userId,
  isOwner,
  visibility,
}: ProfileFollowingSectionProps) {
  const [users, setUsers] = useState<FollowedUser[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchFollowingList(userId);
        if (!cancelled) {
          setUsers(data.users);
          setIsPrivate(data.isPrivate);
        }
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!isOwner && isPrivate) {
    return (
      <section className="profile-section card">
        <h2>Abonnements</h2>
        <p className="muted empty-state">Cette liste est privée.</p>
      </section>
    );
  }

  return (
    <section className="profile-section card">
      <div className="profile-section-head">
        <h2>Abonnements</h2>
        {isOwner ? (
          <span className="muted profile-visibility-hint">
            Liste {visibility === "public" ? "publique" : "privée"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="muted">Chargement…</p>
      ) : users.length > 0 ? (
        <ul className="profile-following-list">
          {users.map((user) => (
            <li key={user.userId} className="profile-following-item">
              <Link href={`/profile/${user.userId}`} className="profile-following-link">
                <span className="avatar">{initials(user.displayName)}</span>
                <span>
                  <strong>{user.displayName}</strong>
                  {user.username ? (
                    <span className="muted profile-following-username"> @{user.username}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted empty-state">
          {isOwner
            ? "Vous ne suivez personne pour le moment. Visitez un profil et cliquez sur Suivre."
            : "Aucun abonnement visible."}
        </p>
      )}
    </section>
  );
}
