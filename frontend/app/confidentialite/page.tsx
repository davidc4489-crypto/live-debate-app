import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: "Confidentialité",
  description: `Quelles données ${APP_NAME} collecte, pourquoi, et comment les supprimer.`,
};

/**
 * Description factuelle des traitements réellement effectués par le code.
 *
 * ⚠️ Ce texte décrit le fonctionnement technique de l'application ; il ne
 * remplace pas une politique de confidentialité validée juridiquement.
 * Complétez l'identité du responsable de traitement et l'adresse de contact
 * avant toute mise en ligne publique (RGPD, art. 13).
 */
const SECTIONS = [
  {
    title: "Les données que nous collectons",
    body: [
      "Compte : votre adresse email et votre mot de passe, gérés par notre prestataire d'authentification Supabase. Le mot de passe n'est jamais stocké en clair et n'est pas accessible à l'application.",
      "Profil : prénom, nom, nom d'utilisateur, âge, biographie, photo et centres d'intérêt — uniquement ceux que vous renseignez vous-même. Tous ces champs sont facultatifs.",
      "Contenus : les sujets de débat que vous créez, les messages que vous envoyez, vos conclusions et vos notes personnelles.",
      "Activité : vos débats, vos favoris, vos abonnements, vos notifications, et le passage des spectateurs sur un débat.",
    ],
  },
  {
    title: "Ce que nous ne collectons pas",
    body: [
      "Aucun traceur publicitaire, aucun cookie de mesure d'audience tierce, aucune revente de données.",
      "Aucune donnée de paiement : l'application est gratuite.",
    ],
  },
  {
    title: "La modération automatique",
    body: [
      "Chaque message est analysé avant publication par un service de modération que nous hébergeons nous-mêmes : votre texte n'est envoyé à aucun service tiers.",
      "L'analyse produit un score de toxicité et une indication de qualité argumentative, conservés en base et rattachés au message.",
      "Un message bloqué n'est jamais transmis à votre interlocuteur.",
    ],
  },
  {
    title: "Ce qui est visible par les autres",
    body: [
      "Un débat et ses messages sont publics : ils restent consultables et relisibles après la fin de l'échange, y compris par des personnes non inscrites.",
      "Votre profil public affiche le nom que vous avez choisi, votre biographie, vos centres d'intérêt et vos débats.",
      "Vos notes personnelles ne sont visibles que par vous.",
    ],
  },
  {
    title: "Durée de conservation",
    body: [
      "Vos données de compte et vos contenus sont conservés tant que votre compte existe.",
      "Un débat resté sans adversaire est fermé automatiquement au bout d'une heure ; un débat mis en pause et jamais repris est clôturé au bout de sept jours.",
    ],
  },
  {
    title: "Vos droits",
    body: [
      "Vous pouvez consulter et modifier vos informations depuis votre profil à tout moment.",
      "Vous pouvez demander l'accès, la rectification, l'export ou la suppression de vos données. La suppression du compte entraîne celle de votre profil, de vos notes, de vos favoris et de vos abonnements.",
      "Les messages déjà publiés dans un débat sont conservés pour préserver la cohérence de l'échange pour votre interlocuteur ; ils peuvent être dissociés de votre identité sur demande.",
    ],
  },
  {
    title: "Hébergement",
    body: [
      "Les données sont hébergées par Supabase (base de données et authentification), dans l'Union européenne.",
      "L'application est déployée chez des hébergeurs tiers pour la partie web et le serveur temps réel.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <article className="page-narrow legal-page reveal">
      <header className="legal-header">
        <p className="mkt-kicker">Confidentialité</p>
        <h1>Vos données sur {APP_NAME}</h1>
        <p className="muted legal-lead">
          Ce que nous collectons, pourquoi, et comment reprendre la main dessus.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="legal-section card">
          <h2>{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <section className="legal-section card">
        <h2>Nous contacter</h2>
        <p>
          Pour toute question ou pour exercer vos droits, écrivez à l&apos;adresse de contact
          indiquée sur le site. Nous répondons sous un mois.
        </p>
      </section>

      <p className="muted legal-footer">
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </article>
  );
}
