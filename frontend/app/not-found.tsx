import Link from "next/link";

export const metadata = {
  title: "Page introuvable",
};

export default function NotFound() {
  return (
    <div className="page-narrow status-page">
      <p className="mkt-kicker">Erreur 404</p>
      <h1>Cette page n&apos;existe pas</h1>
      <p className="muted">
        Le lien est peut-être erroné, ou le débat que vous cherchiez a été supprimé.
      </p>
      <div className="status-page-actions">
        <Link href="/" className="btn btn-primary">
          Retour à l&apos;accueil
        </Link>
        <Link href="/explore" className="btn btn-secondary">
          Explorer les débats
        </Link>
      </div>
    </div>
  );
}
