import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="empty-state reveal">
      <h1>Profil introuvable</h1>
      <p className="muted">Cet utilisateur n&apos;existe pas ou son profil n&apos;est pas disponible.</p>
      <Link href="/" className="btn btn-primary">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
