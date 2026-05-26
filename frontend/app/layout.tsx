import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { APP_NAME, APP_TAGLINE } from "../lib/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    `${APP_NAME} : apprenez à argumenter grâce à des débats structurés — humain ou IA, tours de parole, analyse.`,
  icons: {
    icon: "/logo_min.png",
    apple: "/logo_min.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">
        <Topbar />
        <div className="app-shell">
          <Sidebar />
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
