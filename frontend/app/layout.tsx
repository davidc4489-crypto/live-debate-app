import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Topbar } from "../components/Topbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Debately — Débats posés et structurés",
  description:
    "Plateforme de débats en ligne : échanges réfléchis, tours de parole, conclusions et modération.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">
        <Topbar />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
