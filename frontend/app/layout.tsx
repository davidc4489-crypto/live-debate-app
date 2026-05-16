import "./globals.css";
import type { Metadata } from "next";
import { Topbar } from "../components/Topbar";

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
        <Topbar />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
