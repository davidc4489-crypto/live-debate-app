import Image from "next/image";
import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

type AppLogoVariant = "icon" | "full";

interface AppLogoProps {
  href?: string;
  variant?: AppLogoVariant;
  showName?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const ICON_SIZES = { sm: 28, md: 36 } as const;
const FULL_SIZES = {
  sm: { width: 104, height: 80 },
  md: { width: 182, height: 140 },
} as const;

export function AppLogo({
  href = "/",
  variant = "icon",
  showName = true,
  size = "md",
  className = "",
}: AppLogoProps) {
  const isFull = variant === "full";

  const content = isFull ? (
    <Image
      src="/logo_full.png"
      alt={`${APP_NAME} — ${APP_TAGLINE}`}
      width={FULL_SIZES[size].width}
      height={FULL_SIZES[size].height}
      className="brand-logo-img brand-logo-img-full"
      priority
    />
  ) : (
    <>
      <Image
        src="/logo_min.png"
        alt=""
        width={ICON_SIZES[size]}
        height={ICON_SIZES[size]}
        className="brand-logo-img"
        priority={size === "md"}
      />
      {showName ? <span className="brand-logo-name">{APP_NAME}</span> : null}
    </>
  );

  const classes = `brand-logo${isFull ? " brand-logo-full" : ""}${
    className ? ` ${className}` : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={`${APP_NAME} — accueil`}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
