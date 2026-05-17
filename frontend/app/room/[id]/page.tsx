import Link from "next/link";
import { DebateRoomEntry } from "@/components/DebateRoomEntry";

interface RoomPageProps {
  params: { id: string };
}

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <div className="stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour à l'accueil
      </Link>
      <DebateRoomEntry roomId={params.id} />
    </div>
  );
}
