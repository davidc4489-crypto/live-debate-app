"use client";

interface PauseStateBannerProps {
  isPaused: boolean;
  isPausedByMe: boolean;
  awaitingResumeValidation: boolean;
  canValidateResume: boolean;
  pausedByDisplayName?: string | null;
  presenceMessage: string | null;
  showAbsentModal: boolean;
  isFinished: boolean;
  resumeLoading: boolean;
  onRequestResume: () => void;
  onValidateResume: () => void;
}

export function PauseStateBanner({
  isPaused,
  isPausedByMe,
  awaitingResumeValidation,
  canValidateResume,
  pausedByDisplayName,
  presenceMessage,
  showAbsentModal,
  isFinished,
  resumeLoading,
  onRequestResume,
  onValidateResume,
}: PauseStateBannerProps) {
  if (!isPaused) {
    if (presenceMessage && !isFinished && !showAbsentModal) {
      return (
        <section className="card debate-lifecycle-banner" role="status">
          <p>{presenceMessage}</p>
        </section>
      );
    }
    return null;
  }

  if (isPausedByMe && !awaitingResumeValidation) {
    return (
      <section className="card debate-lifecycle-banner debate-validate-banner" role="alert">
        <p>Vous avez mis ce débat en pause. Demandez la reprise lorsque vous êtes prêt à continuer.</p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={resumeLoading}
          onClick={onRequestResume}
        >
          {resumeLoading ? "Envoi…" : "Reprendre le débat"}
        </button>
      </section>
    );
  }

  if (isPausedByMe && awaitingResumeValidation) {
    return (
      <section className="card debate-lifecycle-banner" role="status">
        <p>Reprise demandée. L&apos;autre participant doit valider pour relancer le débat.</p>
      </section>
    );
  }

  if (canValidateResume) {
    return (
      <section className="card debate-lifecycle-banner debate-validate-banner" role="alert">
        <p>
          {pausedByDisplayName ?? "L'autre participant"} souhaite reprendre le débat. Validez pour
          relancer les tours de parole.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={resumeLoading}
          onClick={onValidateResume}
        >
          {resumeLoading ? "Validation…" : "Valider la reprise"}
        </button>
      </section>
    );
  }

  if (!isPausedByMe && !canValidateResume) {
    return (
      <section className="card debate-lifecycle-banner" role="status">
        <p>
          {presenceMessage ??
            `Ce débat est en pause${pausedByDisplayName ? ` par ${pausedByDisplayName}` : ""}.`}
        </p>
      </section>
    );
  }

  return null;
}
