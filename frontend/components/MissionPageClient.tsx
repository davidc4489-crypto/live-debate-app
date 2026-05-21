import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";
import { APP_NAME } from "@/lib/brand";

const principles = [
  {
    title: "Respect",
    text: "Chaque participant a le droit d'être entendu. Les attaques personnelles n'ont pas leur place ici.",
  },
  {
    title: "Réflexion",
    text: "Le temps de parole est limité pour encourager des réponses réfléchies, pas des réactions impulsives.",
  },
  {
    title: "Argumentation",
    text: "Ce qui compte, ce sont les idées, les faits et la qualité du raisonnement — pas le volume ou la vitesse.",
  },
];

const steps = [
  {
    step: "1",
    title: "Rejoindre un débat",
    text: "Choisissez un sujet qui vous intéresse ou créez votre propre débat.",
  },
  {
    step: "2",
    title: "Échanger à tour de rôle",
    text: "Chaque participant s'exprime pendant son tour, dans un cadre clair et modéré.",
  },
  {
    step: "3",
    title: "Conclure et apprendre",
    text: "À la fin, chacun partage ce qu'il a retenu de l'échange — ce qui a fait avancer la réflexion.",
  },
];

const audiences = [
  {
    title: "Curieux et citoyens engagés",
    text: "Vous voulez comprendre un sujet en profondeur, pas seulement réagir à l'actualité.",
  },
  {
    title: "Étudiants et enseignants",
    text: "Vous cherchez un espace pour structurer un débat, développer l'esprit critique et l'écoute.",
  },
  {
    title: "Professionnels et penseurs",
    text: "Vous appréciez les échanges posés, documentés et constructifs sur des sujets de société.",
  },
];

export function MissionPageClient() {
  return (
    <article className="mission-page reveal">
      <header className="mission-hero">
        <AppLogo href="/" variant="full" size="md" className="mission-hero-brand" />
        <p className="kicker">Notre mission</p>
        <h1>Redonner sa place au débat, dans le calme et la clarté.</h1>
        <p className="mission-hero-lead">
          {APP_NAME} est une plateforme de débats structurés : des tours de parole, une modération
          attentive et des conclusions qui valorisent ce que chacun a appris — pas le clash.
        </p>
        <div className="hero-cta">
          <Link href="/#latest" className="btn btn-primary">
            Explorer les débats
          </Link>
          <Link href="/room/new" className="btn btn-ghost">
            Créer un débat
          </Link>
        </div>
      </header>

      <section className="mission-section card" aria-labelledby="mission-problem">
        <p className="mission-section-label">Le constat</p>
        <h2 id="mission-problem">En ligne, le débat manque souvent de structure</h2>
        <div className="mission-prose">
          <p>
            Sur les réseaux sociaux et dans les commentaires, les échanges partent vite en vrille.
            Le volume l&apos;emporte sur la nuance. Les réponses s&apos;enchaînent sans temps de
            réflexion.
          </p>
          <p>
            Résultat : du bruit, de la toxicité, et peu de place pour vraiment comprendre un sujet
            ou une personne qui pense autrement.
          </p>
          <p className="mission-highlight">
            Nous croyons qu&apos;un autre modèle est possible — plus lent, plus exigeant, et plus
            fertile.
          </p>
        </div>
      </section>

      <section className="mission-section card" aria-labelledby="mission-solution">
        <p className="mission-section-label">Notre réponse</p>
        <h2 id="mission-solution">Une plateforme pensée pour des échanges de qualité</h2>
        <div className="mission-prose">
          <p>
            {APP_NAME} propose un cadre clair : deux participants, des tours de parole limités dans
            le temps, une modération automatique des contenus problématiques, et une phase de
            conclusion à la fin de chaque débat.
          </p>
          <p>
            L&apos;objectif n&apos;est pas de « gagner » un fil de discussion, mais de construire
            un échange lisible, reproductible et utile — pour ceux qui participent comme pour ceux
            qui lisent ensuite.
          </p>
        </div>
        <ul className="mission-checklist">
          <li>Tours de parole pour éviter les monologues et les interruptions</li>
          <li>Modération pour limiter les contenus agressifs ou hors sujet</li>
          <li>Conclusions pour synthétiser ce que l&apos;échange a apporté</li>
          <li>Relecture des débats terminés, à son rythme</li>
        </ul>
      </section>

      <section className="mission-section" aria-labelledby="mission-principles">
        <p className="mission-section-label">Nos principes</p>
        <h2 id="mission-principles">Ce qui guide chaque débat sur {APP_NAME}</h2>
        <div className="mission-principles-grid">
          {principles.map((item) => (
            <div key={item.title} className="card mission-principle-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mission-section card" aria-labelledby="mission-how">
        <p className="mission-section-label">Comment ça marche</p>
        <h2 id="mission-how">Simple, lisible, structuré</h2>
        <ol className="mission-steps">
          {steps.map((item) => (
            <li key={item.step} className="mission-step">
              <span className="mission-step-num" aria-hidden>
                {item.step}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mission-section" aria-labelledby="mission-audience">
        <p className="mission-section-label">Pour qui</p>
        <h2 id="mission-audience">À qui s&apos;adresse {APP_NAME} ?</h2>
        <div className="mission-audience-grid">
          {audiences.map((item) => (
            <div key={item.title} className="card mission-audience-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mission-section card mission-vision" aria-labelledby="mission-vision">
        <p className="mission-section-label">Notre vision</p>
        <h2 id="mission-vision">Vers une culture du débat plus exigeante</h2>
        <div className="mission-prose">
          <p>
            À long terme, nous voulons contribuer à un internet où l&apos;on peut se contredire
            sans se détruire — où l&apos;on prend le temps de formuler une pensée avant de la
            publier.
          </p>
          <p>
            {APP_NAME} reste une plateforme en évolution. Notre ambition : affiner les outils de
            modération, enrichir les formats de débat, et construire une communauté qui choisit la
            qualité plutôt que le buzz.
          </p>
          <p className="mission-tagline">
            Parce qu&apos;un bon débat ne laisse personne indifférent — mais peut laisser tout le
            monde un peu plus clairvoyant.
          </p>
        </div>
        <div className="hero-cta mission-cta-bottom">
          <Link href="/" className="btn btn-primary">
            Rejoindre les débats
          </Link>
        </div>
      </section>
    </article>
  );
}
