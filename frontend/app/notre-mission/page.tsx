import type { Metadata } from "next";
import Link from "next/link";
import { MissionPageClient } from "@/components/MissionPageClient";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Notre mission — ${APP_NAME}`,
  description:
    `Découvrez pourquoi ${APP_NAME} existe : des débats structurés, respectueux et pensés pour la réflexion.`,
};

export default function NotreMissionPage() {
  return (
    <div className="mission-page-wrap stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour à l&apos;accueil
      </Link>
      <MissionPageClient />
    </div>
  );
}
