/**
 * Les règles du format, pas des témoignages.
 *
 * Cette section affichait deux citations attribuées à une « étudiante en droit »
 * et à un « enseignant / debater » : des avis inventés, qui se lisent comme de
 * vrais retours utilisateurs sur une page publique. Remplacés par des faits
 * vérifiables dans le produit.
 */
const RULES = [
  {
    title: "Deux participants, pas plus",
    description:
      "Une salle accueille exactement deux débatteurs. Les autres peuvent suivre en spectateurs, sans jamais interrompre.",
  },
  {
    title: "Un message par tour",
    description:
      "Envoyer votre argument passe la parole. Impossible de noyer l'autre sous dix messages d'affilée.",
  },
  {
    title: "3, 5 ou 10 minutes pour répondre",
    description:
      "Le chronomètre est un délai maximum, pas une course : prenez le temps de formuler, le tour passe si vous ne répondez pas.",
  },
  {
    title: "500 caractères par message",
    description:
      "Assez pour un argument construit, trop peu pour un monologue. La contrainte fait le style.",
  },
  {
    title: "Une conclusion chacun",
    description:
      "À la fin, les deux camps écrivent ce qu'ils retiennent. C'est ce qui reste du débat.",
  },
  {
    title: "Modération avant publication",
    description:
      "Les propos haineux n'atteignent jamais l'autre participant : ils sont bloqués à l'envoi.",
  },
] as const;

export function SocialProof() {
  return (
    <section className="mkt-section mkt-section--muted" aria-labelledby="proof-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Le cadre</p>
          <h2 id="proof-title" className="mkt-section-title">
            Des règles simples, qui changent la qualité de l&apos;échange
          </h2>
        </div>
        <ul className="landing-rules-grid">
          {RULES.map((rule) => (
            <li key={rule.title} className="landing-rule-card">
              <h3 className="landing-rule-title">{rule.title}</h3>
              <p className="landing-rule-desc">{rule.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
