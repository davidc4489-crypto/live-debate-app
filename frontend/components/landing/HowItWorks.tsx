const STEPS = [
  {
    step: "01",
    title: "Posez la question",
    description:
      "Une question claire, avec deux camps défendables. Ou parcourez les débats déjà ouverts.",
  },
  {
    step: "02",
    title: "Prenez position",
    description: "Pour ou contre. Vous défendrez ce camp pendant tout l'échange.",
  },
  {
    step: "03",
    title: "Attendez votre adversaire",
    description:
      "Un autre participant rejoint la salle, vous validez le départ et le débat commence.",
  },
  {
    step: "04",
    title: "Débattez à tour de rôle",
    description:
      "Un message chacun. Envoyer le vôtre passe la parole — personne ne peut couper l'autre.",
  },
  {
    step: "05",
    title: "Concluez",
    description:
      "À la fin, chacun rédige sa conclusion. Le débat reste consultable et relisible.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mkt-section" id="how-it-works" aria-labelledby="how-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Comment ça marche</p>
          <h2 id="how-title" className="mkt-section-title">
            Cinq étapes, un objectif : penser mieux
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
