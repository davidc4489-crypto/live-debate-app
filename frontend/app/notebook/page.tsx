import Link from "next/link";
import { NotebookClient } from "@/components/NotebookClient";

export default function NotebookPage() {
  return (
    <div className="notebook-page stack">
      <Link href="/" className="btn btn-ghost room-back">
        Retour à l&apos;accueil
      </Link>
      <NotebookClient />
    </div>
  );
}
