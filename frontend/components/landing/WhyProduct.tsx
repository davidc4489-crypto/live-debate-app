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
            inverse : écouter, structurer, répondre — avec un adversaire réel ou une IA qui
            contre-argumente sans caricature.
          </p>
          <ul className="landing-why-list">
            <li>Pas de fil algorithmique, pas de course aux likes</li>
            <li>Tours de parole pour éviter les interruptions</li>
            <li>Modération pour garder le respect du débat</li>
            <li>Trace écrite : conclusions et progression</li>
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
