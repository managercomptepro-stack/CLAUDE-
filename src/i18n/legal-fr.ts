/**
 * Texts of the static pages (CGU, confidentialité, mentions légales, règles, aide). Imported at
 * BUILD time only, by the shell renderer (src/shell/legal.ts): they are written into the HTML and
 * never shipped in the client JavaScript. Kept apart from fr.ts so the pages' scripts stay small.
 *
 * Inline markup, applied after HTML escaping: `**gras**` and `[texte](/lien)` (internal links or
 * `#ancre` only).
 *
 * Modèle à faire relire par un juriste camerounais (docs/HUMAN-TODO.md).
 *
 * Sources vérifiées le 3 oct. 2026 : Code pénal art. 294 (proxénétisme) et 343 (prostitution ;
 * al. 2 : racolage « par écrits ou tout autre moyen ») — en.wikipedia « Prostitution in Cameroon »,
 * Sidaction fiche technique 3 ; loi n° 2024/017 du 23 déc. 2024 (en vigueur le 23 juin 2026) —
 * cio-mag.com, droitmediasfinance.com ; police 117 — voyage.gc.ca (Cameroun).
 */
import { ACCOUNT_PURGE_DAYS, LISTING_LIFETIME_DAYS } from '../data/limits.ts';
import { DEFAULT_SETTINGS } from '../data/settings.ts';

export type LegalBlock = string | { readonly list: readonly string[] } | { readonly note: string };

export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalDoc {
  readonly heading: string;
  /** « Mise à jour le … » line under the heading. */
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

export interface HelpQuestion {
  readonly id: string;
  readonly question: string;
  readonly answer: readonly LegalBlock[];
}

const UPDATED = 'Mise à jour le 3 octobre 2026';
const LIFETIME_MONTHS = Math.round(LISTING_LIFETIME_DAYS / 30);
const S = DEFAULT_SETTINGS;

export const legalFr = {
  juristNote: 'Modèle à faire relire par un juriste avant l’ouverture du service.',
  tocLabel: 'Sommaire',
  toBeCompleted: 'À compléter par l’éditeur',

  terms: {
    heading: 'Conditions d’utilisation',
    updated: UPDATED,
    intro:
      'Ces conditions s’appliquent à toute personne qui consulte NIOXXER, crée un compte ou publie une annonce. Elles sont acceptées par une case à cocher lors de la création du compte ; la version acceptée et sa date sont enregistrées.',
    sections: [
      {
        id: 'objet',
        heading: 'Le service',
        blocks: [
          'NIOXXER est une plateforme de petites annonces de rencontre libre entre adultes au Cameroun, accessible à l’adresse nioxxer.com. Le site met des annonceurs en relation avec des visiteurs ; la conversation se poursuit ensuite sur WhatsApp, en dehors du site. NIOXXER ne propose aucune messagerie.',
          '**NIOXXER est un hébergeur neutre.** Chaque annonce est rédigée et publiée par son auteur, sous sa seule responsabilité. NIOXXER n’écrit pas les annonces, ne les vérifie pas avant leur mise en ligne, n’organise pas les rencontres et n’intervient pas dans les échanges entre utilisateurs.',
        ],
      },
      {
        id: 'age',
        heading: 'Réservé aux adultes',
        blocks: [
          'NIOXXER est **strictement réservé aux personnes de 18 ans et plus**. La date de naissance est demandée à la création du compte et vérifiée par nos serveurs ; elle ne peut plus être modifiée ensuite.',
          {
            note: 'Tolérance zéro : tout contenu qui concerne une personne mineure, ou qui le laisse penser, est interdit et supprimé. Les éléments utiles peuvent être conservés et transmis aux autorités compétentes.',
          },
        ],
      },
      {
        id: 'compte',
        heading: 'Compte',
        blocks: [
          'Regarder les annonces, filtrer et contacter un annonceur ne demandent pas de compte. Un compte gratuit est nécessaire pour publier, mettre une annonce en avant ou demander le badge vérifié.',
          'Le compte se crée avec une adresse e-mail et un mot de passe, ou avec un compte Google. Vous choisissez un pseudonyme (pas besoin de votre vrai nom), unique et non modifiable. L’adresse e-mail doit être vérifiée avant de publier.',
          'Vous êtes responsable de la confidentialité de votre mot de passe et de ce qui est fait depuis votre compte. Les informations que vous donnez doivent être exactes, en particulier votre date de naissance.',
        ],
      },
      {
        id: 'annonces',
        heading: 'Vos annonces',
        blocks: [
          `Une annonce comprend un titre, une description, ce que vous proposez, votre profil, votre ville et votre quartier, de 1 à 5 photos et votre numéro WhatsApp. Le nombre d’annonces actives par compte est limité (${S.maxActiveListings} au lancement) ; la limite en vigueur est indiquée au moment de publier.`,
          `Une annonce reste en ligne ${LIFETIME_MONTHS} mois, puis elle est supprimée automatiquement. Vous pouvez la republier depuis « Mon compte » pour la prolonger, la modifier ou l’effacer à tout moment.`,
          '**Aucun prix** ne doit figurer dans une annonce, ni numéro de téléphone, lien ou adresse e-mail dans les textes : la publication est alors refusée automatiquement. Le contact passe uniquement par le bouton WhatsApp de l’annonce.',
          'Vous garantissez être la personne qui apparaît sur les photos, ou avoir son accord, et détenir les droits sur les textes et images publiés. Un filigrane NIOXXER est ajouté aux photos à l’envoi. Vous autorisez NIOXXER à afficher ces contenus sur le site pendant la durée de l’annonce.',
        ],
      },
      {
        id: 'interdits',
        heading: 'Contenus interdits',
        blocks: [
          'Sont interdits, sans que cette liste soit limitative, et quelle que soit la formulation employée :',
          {
            list: [
              'tout contenu qui concerne une personne mineure ou qui le laisse penser ;',
              'l’offre, la demande ou la facilitation de services sexuels tarifés, que réprime le Code pénal camerounais (notamment l’article 294 sur le proxénétisme et l’article 343 sur la prostitution et le racolage) ;',
              'les prix, montants et tarifs, même déguisés ;',
              'les photos volées ou représentant une autre personne sans son accord ;',
              'la nudité explicite et les images d’actes sexuels ;',
              'les arnaques, demandes d’argent et faux profils ;',
              'les contenus violents, haineux, discriminatoires, menaçants ou harcelants ;',
              'plus généralement, tout contenu contraire à la loi camerounaise.',
            ],
          },
          'Le détail pratique figure dans les [règles de publication](/regles).',
        ],
      },
      {
        id: 'moderation',
        heading: 'Signalements et modération',
        blocks: [
          'Les annonces sont publiées immédiatement, après des contrôles automatiques (majorité, termes liés aux mineurs, prix, coordonnées). Chaque annonce peut être signalée par n’importe quel visiteur, avec ou sans compte, pour l’un des sept motifs proposés.',
          'Une annonce qui reçoit de nombreux signalements de personnes différentes est masquée automatiquement en attendant la décision d’un modérateur. L’équipe de modération peut supprimer une annonce en indiquant le motif ; l’auteur en est informé par une notification sur le site.',
          'Après 5 annonces supprimées pour infraction, le compte ne peut plus publier. NIOXXER peut aussi suspendre ou supprimer un compte qui enfreint ces conditions, sans indemnité. Les actions de l’équipe sont enregistrées dans un journal.',
        ],
      },
      {
        id: 'mise-en-avant',
        heading: 'Mise en avant payante',
        blocks: [
          'Publier est gratuit. Seule la mise en avant d’une annonce est payante :',
          {
            list: [
              '**Premium** : bandeau en haut de l’accueil, tête du fil, cadre doré et étiquette « Premium » ;',
              '**Sponsorisé** : placement au-dessus des annonces gratuites et étiquette « Sponsorisé ».',
            ],
          },
          'Le prix et la durée en vigueur sont affichés sur la page « Booster » avant tout paiement. Le paiement se fait par MTN Mobile Money ou Orange Money, au numéro et au nom affichés sur cette page, puis vous envoyez la capture d’écran du paiement. La mise en avant commence quand l’équipe a vérifié le paiement ; si le paiement est refusé, vous recevez le motif par notification. Il n’y a ni abonnement ni renouvellement automatique.',
          'Une annonce mise en avant porte toujours une étiquette visible « Premium » ou « Sponsorisé », conformément à la loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique. Une mise en avant ne protège pas une annonce de la modération : une annonce supprimée pour infraction perd sa mise en avant sans remboursement. Pour toute réclamation, [contactez-nous](/aide#contact).',
        ],
      },
      {
        id: 'badge',
        heading: 'Badge vérifié',
        blocks: [
          'Vous pouvez demander le badge vérifié en envoyant la photo d’une pièce d’identité. Le badge signifie seulement que l’équipe a vu une pièce d’identité correspondant au compte ; il ne garantit ni le contenu des annonces ni le comportement de la personne. L’image de la pièce est effacée dès la décision.',
        ],
      },
      {
        id: 'responsabilite',
        heading: 'Responsabilité',
        blocks: [
          'Vous êtes seul responsable de ce que vous publiez et des rencontres que vous acceptez. NIOXXER ne garantit ni l’exactitude des annonces, ni l’identité des annonceurs, ni le déroulement des rencontres. Prenez les précautions décrites dans nos [conseils de sécurité](/regles#securite).',
          'NIOXXER fait son possible pour que le site reste disponible, sans pouvoir le garantir, et n’est pas responsable des dommages causés par le comportement d’un utilisateur ou par une interruption du service.',
        ],
      },
      {
        id: 'propriete',
        heading: 'Propriété intellectuelle',
        blocks: [
          'Le nom NIOXXER, le logo, la présentation et le code du site appartiennent à l’éditeur. Les textes et photos des annonces restent la propriété de leurs auteurs.',
        ],
      },
      {
        id: 'suppression',
        heading: 'Suppression du compte',
        blocks: [
          `Vous pouvez demander la suppression de votre compte à tout moment depuis « Mon compte ». Le compte est aussitôt désactivé : vos annonces ne sont plus visibles et vous ne pouvez plus publier. Vos données restent accessibles à l’équipe de modération pendant ${ACCOUNT_PURGE_DAYS} jours au plus (traitement d’un signalement ou d’une réclamation en cours, demande des autorités), puis elles sont effacées définitivement ; l’équipe peut les effacer plus tôt. Une demande de suppression ne peut pas être annulée depuis le site. Ce qui est conservé, et pendant combien de temps, est décrit dans la [politique de confidentialité](/confidentialite#conservation).`,
        ],
      },
      {
        id: 'donnees',
        heading: 'Données personnelles',
        blocks: [
          'Le traitement de vos données est décrit dans la [politique de confidentialité](/confidentialite), qui fait partie de ces conditions.',
        ],
      },
      {
        id: 'modifications',
        heading: 'Modification des conditions',
        blocks: [
          'Ces conditions peuvent évoluer. Quand une nouvelle version entre en vigueur, il vous est demandé de l’accepter à votre prochaine connexion avant de continuer à utiliser votre compte.',
        ],
      },
      {
        id: 'droit',
        heading: 'Droit applicable et contact',
        blocks: [
          'Ces conditions sont soumises au droit camerounais. En cas de litige, une solution amiable est recherchée en priorité ; à défaut, les juridictions camerounaises compétentes sont saisies.',
          'Pour toute question : [page Aide](/aide#contact).',
        ],
      },
    ],
  } satisfies LegalDoc,

  privacy: {
    heading: 'Politique de confidentialité',
    updated: UPDATED,
    intro:
      'Cette page explique quelles données NIOXXER collecte, pourquoi, où elles sont stockées, combien de temps elles sont gardées et quels sont vos droits. NIOXXER ne vend aucune donnée et n’affiche aucune publicité ciblée.',
    sections: [
      {
        id: 'responsable',
        heading: 'Responsable du traitement',
        blocks: [
          'Le responsable du traitement est l’éditeur du site, présenté dans les [mentions légales](/mentions-legales). Pour exercer vos droits ou poser une question : [page Aide](/aide#contact).',
        ],
      },
      {
        id: 'visiteurs',
        heading: 'Si vous visitez sans compte',
        blocks: [
          {
            list: [
              '**Sur votre téléphone uniquement** (stockage local du navigateur, jamais envoyé) : la ville choisie, le thème clair ou sombre, une copie des dernières annonces affichées pour un chargement plus rapide, les annonces déjà vues, aimées ou signalées depuis cet appareil.',
              '**« Autour de moi »** : si vous l’autorisez, la position du téléphone sert uniquement, sur l’appareil, à choisir la ville la plus proche. Elle n’est ni envoyée ni enregistrée.',
              '**J’aime et Signaler** : au premier clic, une session anonyme est créée (un identifiant technique aléatoire, sans nom ni e-mail). Nous enregistrons l’annonce concernée, cet identifiant, la date, et pour un signalement le motif et la note facultative.',
              '**Vues** : chaque ouverture d’annonce augmente un compteur, sans enregistrer qui l’a vue.',
            ],
          },
          'Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience.',
        ],
      },
      {
        id: 'membres',
        heading: 'Si vous créez un compte',
        blocks: [
          {
            list: [
              '**Connexion** : adresse e-mail et mot de passe, gérés par Firebase Authentication (Google). Le mot de passe est conservé sous forme chiffrée par ce service : NIOXXER ne le voit jamais. Avec Google, nous recevons l’adresse e-mail et les informations de base de votre compte Google ; nous n’utilisons que l’adresse e-mail.',
              '**Dossier privé** (visible par vous et l’équipe seulement) : adresse e-mail, date de naissance exacte, profil, ville, numéro WhatsApp, version des conditions acceptée et date d’acceptation, date de création, sanctions éventuelles.',
              '**Profil public** : pseudonyme, photo de profil (facultative), date d’inscription, badge vérifié.',
              '**Notifications** reçues sur le site (paiement, badge, modération).',
            ],
          },
        ],
      },
      {
        id: 'annonces',
        heading: 'Vos annonces et le numéro WhatsApp',
        blocks: [
          'Une annonce est publique : pseudonyme, photo de profil, âge (calculé au mois près : seul le mois de naissance est public, jamais la date exacte), badge, ancienneté, profil, ville, quartier, textes, photos, vues et « j’aime ».',
          'Avant l’envoi, les photos sont réduites et leurs métadonnées (dont la position GPS) sont supprimées sur votre téléphone. Elles sont stockées par Cloudinary avec un filigrane.',
          '**Le numéro WhatsApp de l’annonce** n’apparaît ni dans la page, ni dans la liste des annonces : il est lu dans un document séparé uniquement quand quelqu’un appuie sur WhatsApp ou Appeler. Ce numéro ouvre une conversation, il est donc forcément transmis à la personne qui vous contacte.',
          {
            note: 'Limite à connaître : sans serveur intermédiaire, une personne ou un robot qui connaît l’identifiant d’une annonce peut lire son numéro, une annonce à la fois. N’utilisez pas un numéro que vous ne voulez pas voir circuler.',
          },
        ],
      },
      {
        id: 'paiements',
        heading: 'Mise en avant et badge',
        blocks: [
          {
            list: [
              '**Demande de mise en avant** : formule, opérateur, montant, référence de transaction (facultative) et capture d’écran du paiement. La capture est effacée 30 jours après la décision ; la demande elle-même est gardée comme justificatif.',
              '**Demande de badge** : photo d’une pièce d’identité, lisible par vous et le super-administrateur seulement (pas par les modérateurs), effacée dès la décision.',
            ],
          },
        ],
      },
      {
        id: 'finalites',
        heading: 'Pourquoi ces données',
        blocks: [
          {
            list: [
              'faire fonctionner le site : comptes, annonces, mise en relation, notifications ;',
              'vérifier la majorité et protéger les mineurs ;',
              'modérer : traiter les signalements, appliquer les sanctions, tenir le journal de l’équipe ;',
              'vérifier les paiements de mise en avant et les demandes de badge ;',
              'assurer la sécurité du service et répondre aux demandes des autorités.',
            ],
          },
        ],
      },
      {
        id: 'prestataires',
        heading: 'Prestataires et lieu de stockage',
        blocks: [
          {
            list: [
              '**Google (Firebase)** : hébergement du site, comptes (Authentication) et base de données (Firestore).',
              '**Cloudinary** : stockage et diffusion des photos d’annonce et de profil.',
              '**GitHub (Actions)** : une tâche automatique quotidienne qui supprime les données arrivées à expiration. Elle ne garde que des compteurs dans son rapport.',
              '**WhatsApp (Meta)** : quand vous contactez un annonceur, la conversation a lieu sur WhatsApp, selon les règles de ce service.',
            ],
          },
          'Ces prestataires stockent les données sur leurs serveurs, situés hors du Cameroun (notamment en Europe et aux États-Unis).',
        ],
      },
      {
        id: 'conservation',
        heading: 'Durées de conservation',
        blocks: [
          {
            list: [
              `**Annonces** : ${LIFETIME_MONTHS} mois après la publication ou la dernière republication, puis suppression automatique avec leur numéro WhatsApp, leurs « j’aime » et leurs signalements. Les photos qui ne sont plus utilisées sont effacées de Cloudinary dans les jours qui suivent.`,
              `**Compte** : jusqu’à votre demande de suppression. Le compte est alors désactivé (annonces retirées du site) et vos données restent accessibles à l’équipe de modération pendant ${ACCOUNT_PURGE_DAYS} jours au plus, puis elles sont effacées : annonces, numéros WhatsApp, photos, profil public, pseudonyme, notifications, demande de badge, dossier privé et compte de connexion. L’équipe peut procéder à l’effacement plus tôt.`,
              '**Exception, comptes sanctionnés** : si au moins une de vos annonces a été supprimée pour infraction, ou si la publication vous a été bloquée, votre dossier privé est conservé après la suppression du compte, pour empêcher le contournement des sanctions et pouvoir répondre aux autorités.',
              '**Capture de paiement** : 30 jours après la décision. **Pièce d’identité** : effacée dès la décision.',
              '**Journal de l’équipe** (actions de modération et leur motif) : conservé pour la traçabilité.',
            ],
          },
        ],
      },
      {
        id: 'droits',
        heading: 'Vos droits',
        blocks: [
          `Vous pouvez à tout moment : consulter vos données dans « Mon compte », modifier votre ville, votre numéro WhatsApp et votre photo, supprimer une annonce ou demander la suppression de tout votre compte (effacement dans les ${ACCOUNT_PURGE_DAYS} jours). Le pseudonyme et la date de naissance ne sont pas modifiables : pour une erreur, [contactez-nous](/aide#contact).`,
          'Vous disposez aussi d’un droit d’accès, de rectification, d’opposition et d’effacement prévu par la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun. Vous pouvez saisir l’autorité de protection des données à caractère personnel si vous estimez que vos droits ne sont pas respectés.',
        ],
      },
      {
        id: 'securite',
        heading: 'Sécurité',
        blocks: [
          'L’accès aux données est contrôlé par des règles de sécurité appliquées par nos serveurs : chacun ne peut lire et modifier que ce qui le concerne, et les actions de l’équipe sont journalisées. Aucun système n’est infaillible : choisissez un mot de passe que vous n’utilisez nulle part ailleurs.',
        ],
      },
      {
        id: 'mineurs',
        heading: 'Mineurs',
        blocks: [
          'Le service est interdit aux moins de 18 ans. Nous ne collectons sciemment aucune donnée de mineur.',
        ],
      },
      {
        id: 'modifications',
        heading: 'Modifications',
        blocks: [
          'Cette politique peut évoluer avec le service. Une modification importante vous est présentée à votre prochaine connexion.',
        ],
      },
    ],
  } satisfies LegalDoc,

  legal: {
    heading: 'Mentions légales',
    updated: UPDATED,
    intro:
      'Informations rendues accessibles conformément à la loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique au Cameroun.',
    publisherHeading: 'Éditeur du site',
    publisherIntro: 'Le site NIOXXER, accessible à l’adresse nioxxer.com, est édité par :',
    publisherFields: {
      name: 'Nom ou raison sociale',
      legalForm: 'Forme juridique',
      address: 'Adresse',
      rccm: 'Numéro RCCM',
      taxId: 'Numéro de contribuable',
      director: 'Directeur de la publication',
    },
    contactLabel: 'Contact',
    contactValue: 'WhatsApp, depuis la [page Aide](/aide#contact)',
    sections: [
      {
        id: 'hebergement',
        heading: 'Hébergement',
        blocks: [
          {
            list: [
              '**Site et données** : Google LLC (Firebase), 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis.',
              '**Photos** : Cloudinary Ltd.',
            ],
          },
        ],
      },
      {
        id: 'nature',
        heading: 'Nature du service',
        blocks: [
          'NIOXXER héberge des petites annonces de rencontre publiées par leurs auteurs. L’éditeur n’est pas l’auteur des annonces et n’intervient pas dans les relations entre utilisateurs. Il retire promptement tout contenu manifestement illicite dès qu’il en a connaissance.',
        ],
      },
      {
        id: 'publicite',
        heading: 'Publicité',
        blocks: [
          'Les annonces mises en avant contre paiement portent l’étiquette visible « Premium » ou « Sponsorisé ».',
        ],
      },
      {
        id: 'signalement',
        heading: 'Signaler un contenu illicite',
        blocks: [
          'Chaque annonce a un bouton « Signaler », utilisable sans compte. Vous pouvez aussi nous écrire sur WhatsApp depuis la [page Aide](/aide#contact) en précisant l’annonce concernée et le motif.',
        ],
      },
      {
        id: 'propriete',
        heading: 'Propriété intellectuelle',
        blocks: [
          'Le nom NIOXXER, le logo, la présentation et le code du site appartiennent à l’éditeur. Les textes et photos des annonces appartiennent à leurs auteurs. Les logos WhatsApp, MTN Mobile Money, Orange Money et Google appartiennent à leurs propriétaires respectifs.',
        ],
      },
      {
        id: 'textes',
        heading: 'Textes applicables',
        blocks: [
          {
            list: [
              'Loi n° 2010/021 du 21 décembre 2010 régissant le commerce électronique au Cameroun ;',
              'Loi n° 2010/012 du 21 décembre 2010 relative à la cybersécurité et à la cybercriminalité au Cameroun ;',
              'Loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun ;',
              'Code pénal camerounais.',
            ],
          },
          'Voir aussi les [conditions d’utilisation](/cgu) et la [politique de confidentialité](/confidentialite).',
        ],
      },
    ],
  },

  rules: {
    heading: 'Règles de publication',
    updated: UPDATED,
    intro:
      'NIOXXER est un lieu de rencontre entre adultes consentants. Ces règles protègent tout le monde : les annonces qui ne les respectent pas sont refusées ou supprimées.',
    sections: [
      {
        id: 'autorise',
        heading: 'Ce qui est bienvenu',
        blocks: [
          {
            list: [
              'des annonces sincères, écrites par vous et pour vous ;',
              'des photos récentes où vous apparaissez, ou qui illustrent votre annonce sans montrer personne d’autre ;',
              'une description claire de ce que vous cherchez et de ce que vous proposez ;',
              'votre quartier pour situer l’annonce (sans adresse précise).',
            ],
          },
        ],
      },
      {
        id: 'interdit',
        heading: 'Ce qui est interdit',
        blocks: [
          {
            list: [
              '**Tout ce qui concerne des mineurs**, même en plaisantant : âge, école, « petite », « jeune fille »… Tolérance zéro.',
              '**Les prix et les services tarifés** : aucun montant, tarif ni « cadeau » chiffré. Le site refuse automatiquement les annonces qui en contiennent.',
              '**Les coordonnées dans le texte** : numéro, lien WhatsApp ou e-mail. Le contact passe par le bouton WhatsApp.',
              '**Les photos d’une autre personne** sans son accord, les photos trouvées sur internet, la nudité explicite.',
              '**Les arnaques** : demande d’argent, de recharge, d’avance ou de frais de déplacement.',
              '**Les faux profils**, la violence, la haine, les menaces.',
            ],
          },
          'Les règles complètes sont dans les [conditions d’utilisation](/cgu#interdits).',
        ],
      },
      {
        id: 'sanctions',
        heading: 'En cas d’infraction',
        blocks: [
          'Une annonce signalée par de nombreuses personnes est masquée en attendant la décision d’un modérateur. Une annonce supprimée par la modération reste visible pour vous dans « Mon compte », avec le motif. **Après 5 annonces supprimées, vous ne pouvez plus publier.** Les comptes de mineurs et les contenus graves sont supprimés immédiatement.',
        ],
      },
      {
        id: 'signaler',
        heading: 'Signaler une annonce',
        blocks: [
          'Sur chaque annonce, le bouton « Signaler » est accessible sans compte. Choisissez le motif le plus proche ; « La personne semble mineure » est traité en priorité.',
        ],
      },
      {
        id: 'securite',
        heading: 'Se rencontrer en sécurité',
        blocks: [
          {
            list: [
              'Discutez d’abord sur WhatsApp et prenez le temps de vous faire une idée de la personne.',
              'Pour une première rencontre, choisissez un lieu public et fréquenté, en journée si possible.',
              'Prévenez un proche : lieu, heure, nom de la personne. Gardez votre téléphone chargé.',
              '**N’envoyez jamais d’argent à l’avance** : ni Mobile Money, ni recharge, ni « frais de taxi ». C’est la première arnaque.',
              'Ne partagez pas de photos ou d’informations dont vous pourriez être victime de chantage.',
              'Partez si quelque chose ne va pas. En cas de danger, appelez la police (117).',
              'Signalez toute annonce suspecte : vous protégez les autres.',
            ],
          },
        ],
      },
    ],
  } satisfies LegalDoc,

  help: {
    heading: 'Aide',
    intro: 'Les réponses aux questions les plus fréquentes. Vous ne trouvez pas ? Écrivez-nous sur WhatsApp.',
    contactHeading: 'Nous contacter',
    contactBody:
      'L’équipe NIOXXER répond sur WhatsApp. Pour signaler une annonce, précisez son titre ou son lien. Nous ne demandons jamais d’argent en dehors de la page « Booster ».',
    contactButton: 'Écrire sur WhatsApp',
    contactNumber: 'Numéro',
    questions: [
      {
        id: 'contacter',
        question: 'Comment contacter un annonceur ?',
        answer: [
          'Ouvrez l’annonce et appuyez sur **WhatsApp** : la conversation s’ouvre avec un message tout prêt. Pas besoin de compte. Si l’annonceur l’accepte, un bouton **Appeler** est aussi proposé.',
        ],
      },
      {
        id: 'publier',
        question: 'Comment publier une annonce ?',
        answer: [
          'Appuyez sur **Publier** (le + en bas de l’écran), créez votre compte gratuit puis confirmez votre adresse e-mail grâce au lien reçu. Ensuite : titre, description, de 1 à 5 photos et votre numéro WhatsApp. L’annonce est en ligne tout de suite.',
        ],
      },
      {
        id: 'email',
        question: 'Je n’ai pas reçu l’e-mail de confirmation.',
        answer: [
          'Regardez dans les dossiers « Spam » ou « Promotions ». Depuis la page de vérification, vous pouvez renvoyer l’e-mail. Vérifiez aussi l’adresse saisie.',
        ],
      },
      {
        id: 'refus',
        question: 'Pourquoi mon annonce est-elle refusée ?',
        answer: [
          'Le site refuse automatiquement les textes qui contiennent un prix, un numéro de téléphone, un lien ou une adresse e-mail, ou un terme lié aux mineurs. Le message affiché indique le champ à corriger. Voir les [règles de publication](/regles).',
        ],
      },
      {
        id: 'duree',
        question: 'Combien de temps dure une annonce ?',
        answer: [
          `${LIFETIME_MONTHS} mois. Un rappel apparaît dans « Mon compte » 7 jours avant la fin ; le bouton **Republier** la prolonge de ${LIFETIME_MONTHS} mois.`,
        ],
      },
      {
        id: 'booster',
        question: 'Comment mettre mon annonce en avant ?',
        answer: [
          'Dans « Mon compte », appuyez sur **Booster** sous votre annonce, choisissez Premium ou Sponsorisé, puis payez par MTN Mobile Money ou Orange Money au numéro affiché et envoyez la capture d’écran. La mise en avant démarre dès que l’équipe a vérifié le paiement ; vous recevez une notification.',
        ],
      },
      {
        id: 'badge',
        question: 'Comment obtenir le badge vérifié ?',
        answer: [
          'Dans « Mon compte », touchez « Demander la vérification » et envoyez la photo d’une pièce d’identité. Elle n’est vue que par le super-administrateur et effacée dès la décision.',
        ],
      },
      {
        id: 'google',
        question: 'La connexion Google ne marche pas dans WhatsApp ou Facebook.',
        answer: [
          'Google bloque la connexion dans les navigateurs intégrés aux applications. Ouvrez nioxxer.com dans Chrome, ou connectez-vous avec votre e-mail et votre mot de passe.',
        ],
      },
      {
        id: 'mot-de-passe',
        question: 'J’ai oublié mon mot de passe.',
        answer: [
          'Sur la page de connexion, appuyez sur « Mot de passe oublié » : un lien de réinitialisation est envoyé à votre adresse e-mail.',
        ],
      },
      {
        id: 'signaler',
        question: 'Comment signaler une annonce ?',
        answer: [
          'Appuyez sur **Signaler** en bas de l’annonce et choisissez un motif. C’est anonyme et ne demande pas de compte.',
        ],
      },
      {
        id: 'supprimer',
        question: 'Comment supprimer mon compte ?',
        answer: [
          `Dans « Mon compte », tout en bas : **Supprimer mon compte**. Le compte est désactivé tout de suite (vos annonces quittent le site), puis effacé définitivement dans les ${ACCOUNT_PURGE_DAYS} jours. Voir la [politique de confidentialité](/confidentialite#conservation).`,
        ],
      },
    ] satisfies readonly HelpQuestion[],
  },
} as const;
