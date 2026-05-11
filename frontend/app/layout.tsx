import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Live Debate",
  description: "Plateforme moderne de débats en temps réel",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              Debately
            </Link>
            <nav className="nav-links">
              <Link href="/">Accueil</Link>
              <Link href="/#latest">Débats</Link>
              <Link href="/#latest">Explorer</Link>
            </nav>
            <Link href="/room/new" className="btn btn-primary nav-cta">
              Créer débat
            </Link>
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
