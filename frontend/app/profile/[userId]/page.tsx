import { notFound } from "next/navigation";
import { ProfilePageClient } from "@/components/ProfilePageClient";
import { PublicProfile } from "@/lib/profile";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

async function loadProfile(userId: string): Promise<PublicProfile | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const response = await fetch(`${backendUrl}/users/${userId}/profile`, {
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Impossible de charger le profil");
  }

  return response.json() as Promise<PublicProfile>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;

  let profile: PublicProfile | null;
  try {
    profile = await loadProfile(userId);
  } catch {
    throw new Error("Impossible de charger le profil");
  }

  if (!profile) {
    notFound();
  }

  return <ProfilePageClient profile={profile} userId={userId} />;
}
