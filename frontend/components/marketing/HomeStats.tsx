interface HomeStatsProps {
  liveCount: number;
  proposedCount: number;
  scheduledCount: number;
}

export function HomeStats({ liveCount, proposedCount, scheduledCount }: HomeStatsProps) {
  return (
    <section className="mkt-section mkt-section--bordered" aria-label="Activité sur la plateforme">
      <div className="mkt-container">
        <ul className="mkt-stats-row">
          <li className="mkt-stat">
            <span className="mkt-stat-number">{liveCount}</span>
            <span className="mkt-stat-label">Débats actifs ou récents</span>
          </li>
          <li className="mkt-stat">
            <span className="mkt-stat-number">{proposedCount}</span>
            <span className="mkt-stat-label">Sujets proposés</span>
          </li>
          <li className="mkt-stat">
            <span className="mkt-stat-number">{scheduledCount}</span>
            <span className="mkt-stat-label">Créneaux planifiés</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
