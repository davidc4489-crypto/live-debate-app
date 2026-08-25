import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/explore`, lastModified, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/start`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/notre-mission`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/confidentialite`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
