export function HomeProductPreview() {
  return (
    <section className="mkt-section" aria-labelledby="home-product-title">
      <div className="mkt-container">
        <div className="mkt-section-intro mkt-section-intro--center">
          <p className="mkt-kicker">Interface</p>
          <h2 id="home-product-title" className="mkt-section-title">
            Une salle claire, sans distraction
          </h2>
          <p className="mkt-section-lead">
            Le fil de messages, le tour en cours et les actions essentielles — rien de superflu.
          </p>
        </div>

        <div className="mkt-product-frame">
          <div className="mkt-product-chrome">
            <span className="mkt-product-dot" />
            <span className="mkt-product-dot" />
            <span className="mkt-product-dot" />
            <span className="mkt-product-url">argumen.app / room</span>
          </div>
          <div className="mkt-product-body">
            <div className="mkt-product-sidebar">
              <div className="mkt-product-block mkt-product-block--active">
                <span className="mkt-product-label">Tour actuel</span>
                <span className="mkt-product-value">Participant A</span>
                <span className="mkt-product-timer">02:34</span>
              </div>
              <div className="mkt-product-block">
                <span className="mkt-product-label">En attente</span>
                <span className="mkt-product-value muted">Participant B</span>
              </div>
            </div>
            <div className="mkt-product-main">
              <div className="mkt-product-message mkt-product-message--a">
                <span className="mkt-product-author">Participant A</span>
                <p>
                  L&apos;IA doit être régulée par des cadres démocratiques, pas laissée au seul marché.
                </p>
              </div>
              <div className="mkt-product-message mkt-product-message--b">
                <span className="mkt-product-author">Participant B</span>
                <p>
                  La régulation excessive freine l&apos;innovation qui pourrait résoudre des problèmes
                  majeurs.
                </p>
              </div>
              <div className="mkt-product-compose">
                <span className="muted">Votre tour dans 2:34…</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
