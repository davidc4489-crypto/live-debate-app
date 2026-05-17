"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Interest } from "@/lib/profile";
import { fetchInterests, fetchPublicProfile, updateOwnProfile } from "@/lib/profiles-api";
import { useAuthSession } from "@/lib/useAuthSession";

export function ProfileEditClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthSession();
  const [allInterests, setAllInterests] = useState<Interest[]>([]);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [profile, interests] = await Promise.all([
          fetchPublicProfile(userId),
          fetchInterests(),
        ]);

        if (cancelled) return;

        setUsername(profile.user.username ?? "");
        setFirstName(profile.user.firstName ?? "");
        setLastName(profile.user.lastName ?? "");
        setAvatarUrl(profile.user.avatarUrl ?? "");
        setBio(profile.user.bio ?? "");
        setAge(profile.user.age != null ? String(profile.user.age) : "");
        setSelectedInterestIds(profile.interests.map((item) => item.id));
        setAllInterests(interests);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le profil");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  function toggleInterest(interestId: string) {
    setSelectedInterestIds((current) =>
      current.includes(interestId)
        ? current.filter((id) => id !== interestId)
        : [...current, interestId],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const parsedAge = age.trim() ? Number(age) : null;
      if (parsedAge != null && (Number.isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120)) {
        throw new Error("L'âge doit être entre 13 et 120 ans");
      }

      await updateOwnProfile({
        username: username.trim() || null,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        age: parsedAge,
        interestIds: selectedInterestIds,
      });

      router.push(`/profile/${user.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <div className="empty-state">Chargement du profil…</div>;
  }

  return (
    <div className="profile-edit-page reveal">
      <div className="profile-edit-head">
        <h1>Modifier mon profil</h1>
        <p className="muted">Ces informations sont visibles sur votre profil public.</p>
      </div>

      <form className="profile-edit-form card" onSubmit={(event) => void handleSubmit(event)}>
        <label className="field">
          <span>Nom d&apos;utilisateur</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ex: debateur42"
            maxLength={30}
          />
        </label>

        <div className="profile-edit-row">
          <label className="field">
            <span>Prénom</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </label>
          <label className="field">
            <span>Nom</span>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>URL de l&apos;avatar</span>
          <input
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://…"
            type="url"
          />
        </label>

        <label className="field">
          <span>Bio</span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Présentez-vous en quelques lignes…"
          />
        </label>

        <label className="field">
          <span>Âge (optionnel)</span>
          <input
            value={age}
            onChange={(event) => setAge(event.target.value)}
            type="number"
            min={13}
            max={120}
            placeholder="18"
          />
        </label>

        <fieldset className="field profile-interests-field">
          <span>Centres d&apos;intérêt</span>
          <p className="profile-interests-hint muted">
            Sélectionnez les sujets qui vous passionnent ({selectedInterestIds.length} sélectionné
            {selectedInterestIds.length > 1 ? "s" : ""})
          </p>
          <div className="profile-interest-picker">
            {allInterests.map((interest) => {
              const selected = selectedInterestIds.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  className={`interest-pill ${selected ? "selected" : ""}`}
                  onClick={() => toggleInterest(interest.id)}
                >
                  {interest.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="profile-edit-actions">
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
