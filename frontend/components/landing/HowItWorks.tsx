const STEPS = [
  {
    step: "01",
    title: "Choisissez un sujet",
    description: "Formulez une question claire ou parcourez les débats ouverts sur la plateforme.",
  },
  {
    step: "02",
    title: "Prenez position",
    description: "Pour ou contre — votre camp guide la structure de l'échange.",
  },
  {
    step: "03",
    title: "Débattez",
    description: "Affrontez un humain en direct ou entraînez-vous contre l'IA (adversaire structuré).",
  },
  {
    step: "04",
    title: "Analysez",
    description: "Conclusions, retours du Juge IA et pistes du Coach pour progresser.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mkt-section" id="how-it-works" aria-labelledby="how-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Comment ça marche</p>
          <h2 id="how-title" className="mkt-section-title">
            Quatre étapes, un objectif : penser mieux
          </h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((item) => (
            <li key={item.step} className="landing-step-card">
              <span className="landing-step-num">{item.step}</span>
              <h3 className="landing-step-title">{item.title}</h3>
              <p className="landing-step-desc">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
