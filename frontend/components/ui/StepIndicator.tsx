export interface WizardStep {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: WizardStep[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <nav className="step-indicator" aria-label="Étapes">
      <ol className="step-indicator-list">
        {steps.map((step, index) => {
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          return (
            <li key={step.id} className={`step-indicator-item step-indicator-item--${state}`}>
              <span className="step-indicator-dot" aria-hidden="true">
                {index < currentIndex ? "✓" : index + 1}
              </span>
              <span className="step-indicator-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
