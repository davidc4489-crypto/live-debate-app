const STATS = [
  { value: "3 min", label: "Tours de parole minimum" },
  { value: "2", label: "Camps : pour & contre" },
  { value: "3", label: "Rôles IA dédiés" },
] as const;

const QUOTES = [
  {
    text: "Enfin un espace où l'on peut développer un argument sans se faire couper.",
    author: "Étudiante en droit",
  },
  {
    text: "La structure force à écouter l'autre camp avant de répondre.",
    author: "Enseignant / debater",
  },
] as const;

export function SocialProof() {
  return (
    <section className="mkt-section mkt-section--muted" aria-labelledby="proof-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Conçu pour la clarté</p>
          <h2 id="proof-title" className="mkt-section-title">
            Un cadre qui change la qualité de l&apos;échange
          </h2>
        </div>
        <ul className="mkt-stats-row landing-proof-stats">
          {STATS.map((s) => (
            <li key={s.label} className="mkt-stat">
              <span className="mkt-stat-number">{s.value}</span>
              <span className="mkt-stat-label">{s.label}</span>
            </li>
          ))}
        </ul>
        <div className="landing-quotes">
          {QUOTES.map((q) => (
            <figure key={q.author} className="landing-quote-card card">
              <blockquote>&laquo;&nbsp;{q.text}&nbsp;&raquo;</blockquote>
              <figcaption className="muted">— {q.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
