import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { APP_NAME, APP_TAGLINE } from "../lib/brand";
import { getSiteUrl } from "../lib/site-url";

const DESCRIPTION =
  `${APP_NAME} : des débats structurés entre deux personnes. Un sujet, deux camps, ` +
  "des tours de parole et un message chacun — avec une modération en direct.";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: "/logo_min.png",
    apple: "/logo_min.png",
  },
  // Sans ces blocs, un lien partagé sur les réseaux ou en messagerie
  // s'affichait sans titre, sans description et sans visuel.
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: DESCRIPTION,
    locale: "fr_FR",
    url: "/",
    images: [{ url: "/logo_full.png", width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: DESCRIPTION,
    images: ["/logo_full.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">
        <Topbar />
        <ConnectionBanner />
        <div className="app-shell">
          <Sidebar />
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
