export function WhyProduct() {
  return (
    <section className="mkt-section mkt-section--muted" id="why" aria-labelledby="why-title">
      <div className="mkt-container landing-why-grid">
        <div className="landing-why-copy">
          <p className="mkt-kicker">Pourquoi Argumen existe</p>
          <h2 id="why-title" className="mkt-section-title">
            La pensée critique a besoin d&apos;un terrain d&apos;entraînement
          </h2>
          <p className="mkt-section-lead">
            Les réseaux sociaux récompensent la vitesse et le clash. Argumen impose le rythme
            inverse : un sujet, deux personnes, un message chacun à tour de rôle. Le temps de
            construire un argument, et celui de le lire.
          </p>
          <ul className="landing-why-list">
            <li>Pas de fil algorithmique, pas de course aux likes</li>
            <li>Tours de parole : impossible de couper son interlocuteur</li>
            <li>Modération en direct pour garder le respect de l&apos;échange</li>
            <li>Trace écrite : conclusions de chaque camp, débats relisibles</li>
          </ul>
        </div>
        <blockquote className="landing-quote card">
          <p>
            &laquo;&nbsp;Ce n&apos;est pas un chat. C&apos;est un outil pour comprendre pourquoi on
            croit ce qu&apos;on croit — et ce qu&apos;il faudrait pour le défendre.&nbsp;&raquo;
          </p>
        </blockquote>
      </div>
    </section>
  );
}
