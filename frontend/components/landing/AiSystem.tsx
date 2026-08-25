import { AI_ROLES } from "@/lib/brand";

const ROLES = [AI_ROLES.moderation, AI_ROLES.quality, AI_ROLES.coach];

export function AiSystem() {
  return (
    <section className="mkt-section" id="ai" aria-labelledby="ai-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Le rôle de l&apos;IA</p>
          <h2 id="ai-title" className="mkt-section-title">
            Elle sécurise le débat. Elle ne le remplace pas.
          </h2>
          <p className="mkt-section-lead mkt-section-lead--center">
            Sur Argumen, on débat entre humains — toujours. L&apos;IA n&apos;écrit aucun message,
            ne prend jamais parti et ne décide pas qui a raison.
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
      </div>
    </section>
  );
}
