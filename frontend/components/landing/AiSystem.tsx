import { AI_ROLES } from "@/lib/brand";

const ROLES = [AI_ROLES.opponent, AI_ROLES.judge, AI_ROLES.coach];

export function AiSystem() {
  return (
    <section className="mkt-section" id="ai" aria-labelledby="ai-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Système IA</p>
          <h2 id="ai-title" className="mkt-section-title">
            Trois rôles, pas un chatbot générique
          </h2>
          <p className="mkt-section-lead mkt-section-lead--center">
            L&apos;intelligence artificielle intervient à des moments précis du parcours — jamais
            pour remplacer votre pensée.
          </p>
        </div>
        <ul className="landing-ai-grid">
          {ROLES.map((role) => (
            <li key={role.id} className="landing-ai-card">
              <span className="landing-ai-badge">{role.title}</span>
              <h3 className="landing-ai-title">{role.shortTitle}</h3>
              <p className="landing-ai-desc">{role.description}</p>
            </li>
          ))}
        </ul>
        <p className="landing-ai-footnote muted">
          L&apos;adversaire IA est en déploiement progressif. La démo vous montre l&apos;expérience
          cible ; les débats humains sont disponibles dès maintenant.
        </p>
      </div>
    </section>
  );
}
