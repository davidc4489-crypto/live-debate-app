interface SectionLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function SectionLayout({ title, subtitle, children }: SectionLayoutProps) {
  return (
    <section className="section reveal">
      <div className="section-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
