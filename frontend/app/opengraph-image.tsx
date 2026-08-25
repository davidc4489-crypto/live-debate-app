import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export const runtime = "edge";
export const alt = `${APP_NAME} — ${APP_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Carte de partage 1200×630.
 *
 * Le logo servait d'aperçu social : au format 752×586, il était rogné ou
 * déformé par les plateformes, qui attendent un ratio 1,91:1.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafafa",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#09090b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fafafa",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <span style={{ fontSize: 30, fontWeight: 600, color: "#09090b" }}>{APP_NAME}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: "#09090b",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Apprenez à argumenter.</span>
            <span style={{ color: "#2563eb" }}>Pas à réagir.</span>
          </div>
          <div style={{ fontSize: 30, color: "#52525b", lineHeight: 1.4 }}>
            Des débats structurés entre deux personnes.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#71717a" }}>
          <span>Deux participants</span>
          <span>·</span>
          <span>Tours de parole</span>
          <span>·</span>
          <span>Un message chacun</span>
        </div>
      </div>
    ),
    size,
  );
}
