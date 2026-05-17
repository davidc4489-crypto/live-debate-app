"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDebateDate, getDebateCtaLabel } from "@/lib/debate";
import {
  formatMemberSince,
  getProfileScoreLabel,
  PublicProfile,
} from "@/lib/profile";

interface ProfileClientProps {
  profile: PublicProfile;
  isOwner?: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusLabel(status: string): string {
  if (status === "active") return "En cours";
  if (status === "finished") return "Terminé";
  return "En attente";
}

export function ProfileClient({ profile, isOwner = false }: ProfileClientProps) {
  const { user, interests, stats, debates } = profile;
  const scoreLabel = useMemo(() => getProfileScoreLabel(stats.profileScore), [stats.profileScore]);

  return (
    <div className="profile-page reveal">
      <section className="profile-hero card">
        <div className="profile-hero-main">
          <div className="profile-avatar-wrap">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="profile-avatar" />
            ) : (
              <span className="profile-avatar profile-avatar-fallback">
                {initials(user.displayName)}
              </span>
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-name-row">
              <h1>{user.displayName}</h1>
              {user.isPremium ? <span className="profile-badge premium">Premium</span> : null}
              <span className="profile-badge score" title="Score d'activité">
                {scoreLabel} · {stats.profileScore} pts
              </span>
            </div>

            {user.username ? <p className="profile-username">@{user.username}</p> : null}

            <p className="profile-meta muted">
              Membre depuis {formatMemberSince(user.memberSince)}
              {user.age != null ? ` · ${user.age} ans` : null}
            </p>

            {user.bio ? (
              <p className="profile-bio">{user.bio}</p>
            ) : (
              <p className="profile-bio muted">Aucune bio pour le moment.</p>
            )}
          </div>
        </div>

        {isOwner ? (
          <Link href="/profile/edit" className="btn btn-primary btn-sm">
            Modifier mon profil
          </Link>
        ) : null}
      </section>

      {interests.length > 0 ? (
        <section className="profile-section card">
          <h2>Centres d&apos;intérêt</h2>
          <div className="profile-chips">
            {interests.map((interest) => (
              <span key={interest.id} className="theme-badge">
                {interest.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="profile-section card">
        <h2>Statistiques</h2>
        <div className="profile-stats-grid">
          <article className="profile-stat">
            <strong>{stats.debatesParticipatedCount}</strong>
            <span>Débats participés</span>
          </article>
          <article className="profile-stat">
            <strong>{stats.messagesCount}</strong>
            <span>Messages envoyés</span>
          </article>
          <article className="profile-stat">
            <strong>{stats.debatesCreatedCount}</strong>
            <span>Débats créés</span>
          </article>
        </div>
      </section>

      <section className="profile-section card">
        <div className="profile-section-head">
          <h2>Débats</h2>
          <span className="muted">{profile.debatesTotal} au total</span>
        </div>

        {debates.length > 0 ? (
          <ul className="profile-debates-list">
            {debates.map((debate) => (
              <li key={debate.id} className="profile-debate-item">
                <div>
                  <div className="profile-debate-top">
                    <span className="theme-badge">{debate.theme}</span>
                    <span className={`profile-status status-${debate.status}`}>
                      {statusLabel(debate.status)}
                    </span>
                  </div>
                  <h3>{debate.title}</h3>
                  <p className="muted">{formatDebateDate(debate.createdAt)}</p>
                </div>
                <Link href={`/room/${debate.id}`} className="btn btn-ghost btn-sm">
                  {getDebateCtaLabel(debate.status)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">Aucun débat en tant que participant pour le moment.</p>
        )}
      </section>
    </div>
  );
}
