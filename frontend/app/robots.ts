import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Salles de débat et profils : contenu personnel ou éphémère, sans
      // intérêt en résultat de recherche.
      disallow: ["/room/", "/profile/", "/notebook", "/auth/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
