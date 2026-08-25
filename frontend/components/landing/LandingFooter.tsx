import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="mkt-container landing-footer-inner">
        <div className="landing-footer-brand">
          <strong>{APP_NAME}</strong>
          <p className="muted">Débats structurés entre deux personnes.</p>
        </div>
        <nav className="landing-footer-nav" aria-label="Liens pied de page">
          <Link href="/explore">Explorer les débats</Link>
          <Link href="/start">Lancer un débat</Link>
          <Link href="/notre-mission">Notre mission</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </nav>
        <p className="landing-footer-copy muted">
          © {new Date().getFullYear()} {APP_NAME}. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
