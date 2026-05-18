"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, saveAuth } from "@/lib/auth";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmation de votre compte en cours…");

  useEffect(() => {
    async function confirm() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search);

      const error =
        queryParams.get("error_description") ||
        hashParams.get("error_description") ||
        queryParams.get("error");

      if (error) {
        setMessage(decodeURIComponent(error));
        return;
      }

      const accessToken =
        hashParams.get("access_token") || queryParams.get("access_token");
      const refreshToken =
        hashParams.get("refresh_token") || queryParams.get("refresh_token");
      const expiresIn = hashParams.get("expires_in") || queryParams.get("expires_in");

      if (accessToken && refreshToken) {
        saveAuth({
          user: {
            id: "",
            email: "",
            firstName: null,
            lastName: null,
            isPremium: false,
          },
          session: {
            accessToken,
            refreshToken,
            expiresAt: expiresIn
              ? Math.floor(Date.now() / 1000) + Number(expiresIn)
              : null,
          },
        });

        const user = await fetchMe();
        if (user) {
          router.replace("/");
          return;
        }

        setMessage("Session invalide après confirmation. Essayez de vous connecter.");
        return;
      }

      setMessage(
        "Lien invalide ou expiré. Ouvrez le dernier email de confirmation ou connectez-vous.",
      );
    }

    void confirm();
  }, [router]);

  return (
    <section className="card reveal" style={{ maxWidth: 480, margin: "2rem auto" }}>
      <h1>Confirmation du compte</h1>
      <p className="muted">{message}</p>
    </section>
  );
}
