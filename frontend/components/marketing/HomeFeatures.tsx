const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 6v6l4 2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
    title: "Tours de parole",
    description: "Chaque intervenant dispose d'un temps dédié. Fini les interruptions et le chaos.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Planification",
    description: "Proposez un sujet, trouvez un adversaire et fixez une date avant de passer en live.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Modération",
    description: "Messages filtrés et signalés pour garder l'échange respectueux et constructif.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Conclusions",
    description: "Chaque participant rédige ce qu'il retient — une trace durable de l'échange.",
  },
] as const;

export function HomeFeatures() {
  return (
    <section className="mkt-section mkt-section--muted" aria-labelledby="home-features-title">
      <div className="mkt-container">
        <div className="mkt-section-intro">
          <p className="mkt-kicker">Fonctionnalités</p>
          <h2 id="home-features-title" className="mkt-section-title">
            Conçu pour la qualité du débat
          </h2>
          <p className="mkt-section-lead">
            Tout est pensé pour ralentir le rythme et favoriser l&apos;argumentation, pas le clash.
          </p>
        </div>
        <ul className="mkt-feature-grid">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="mkt-feature-card">
              <span className="mkt-feature-icon">{feature.icon}</span>
              <h3 className="mkt-feature-title">{feature.title}</h3>
              <p className="mkt-feature-desc">{feature.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
