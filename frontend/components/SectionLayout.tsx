interface SectionLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: "default" | "muted" | "elevated";
  id?: string;
}

export function SectionLayout({
  title,
  subtitle,
  children,
  variant = "default",
  id,
}: SectionLayoutProps) {
  return (
    <section
      id={id}
      className={`section section--${variant} reveal`}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <div className="section-inner">
        <div className="section-head">
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
