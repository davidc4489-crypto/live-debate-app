import Link from "next/link";
import { DebateRoomClient } from "@/components/DebateRoomClient";

interface RoomPageProps {
  params: { id: string };
}

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <div className="stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour à l'accueil
      </Link>
      <DebateRoomClient roomId={params.id} />
    </div>
  );
}
