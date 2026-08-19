'use strict';
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, LevelFormat,
} = require('docx');

const PINK = 'C81E6E';
const DARK = '1A1130';

// helpers -------------------------------------------------------------------
const H = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 260, after: 90 },
  children: [new TextRun({ text, bold: true, color: PINK, size: 26 })],
});
const P = (runs, opts = {}) => new Paragraph({
  spacing: { after: 120, line: 276 },
  alignment: opts.align || AlignmentType.JUSTIFIED,
  children: Array.isArray(runs) ? runs : [new TextRun({ text: runs, size: 21 })],
});
const T = (text, o = {}) => new TextRun({ text, size: 21, bold: o.b, italics: o.i, color: o.c });
const BULLET = (text) => new Paragraph({
  numbering: { reference: 'puces', level: 0 },
  spacing: { after: 70, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, size: 21 })],
});

const doc = new Document({
  creator: 'Keep Cool',
  title: 'Reglement Jeu-concours GTA VI Collector',
  numbering: {
    config: [{
      reference: 'puces',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 240 } } } }],
    }],
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
  },
  sections: [{
    properties: { page: { margin: { top: 1100, bottom: 1100, left: 1200, right: 1200 } } },
    children: [
      // Title block
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: 'RÈGLEMENT DU JEU-CONCOURS', bold: true, size: 30, color: DARK })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 40 },
        children: [new TextRun({ text: '« GTA VI Collector — Le Grand Jeu Keep Cool »', bold: true, size: 26, color: PINK })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PINK, space: 8 } },
        children: [new TextRun({ text: '5 PlayStation 5 et 5 jeux GTA VI à gagner', italics: true, size: 20, color: '555555' })],
      }),
      P([T('Les mentions entre crochets [ ] doivent être complétées par l’organisateur avant publication.', { i: true, c: '777777' })]),

      H('Article 1 — Société organisatrice'),
      P([T('La société '), T('SARL LIMA', { b: true }),
        T(', société à responsabilité limitée au capital de [montant] €, exploitant la salle de sport '),
        T('Keep Cool Narbonne', { b: true }),
        T(', immatriculée au RCS de Narbonne sous le numéro '),
        T('520 349 275', { b: true }),
        T(' (SIRET 520 349 275 00021), dont le siège social est situé '),
        T('44 rue Demoge, 11100 Narbonne', { b: true }),
        T(' (ci-après « l’Organisateur »), organise un jeu-concours avec obligation d’achat intitulé « GTA VI Collector — Le Grand Jeu Keep Cool » (ci-après « le Jeu »). Contact : narbonne@keepcool.fr — 04 58 49 11 06.')]),

      H('Article 2 — Objet et durée du Jeu'),
      P('Le Jeu a pour objet de faire gagner des dotations aux participants à l’occasion de la sortie du jeu vidéo « Grand Theft Auto VI » et du lancement du t-shirt collector Keep Cool. Le Jeu se déroule du [date de début] à [heure] au [date de fin] à [heure] inclus (heure de Paris). Le tirage au sort aura lieu le [date du tirage].'),

      H('Article 3 — Conditions de participation'),
      P('Le Jeu est ouvert à toute personne physique majeure (18 ans révolus au jour de la participation) résidant en France métropolitaine, à l’exclusion des membres du personnel de l’Organisateur, de leur famille proche, ainsi que de toute personne ayant participé à l’organisation du Jeu.'),
      P('La participation est strictement personnelle et nominative. Une seule participation est admise par t-shirt collector acheté (soit un code unique par t-shirt). Toute participation incomplète, frauduleuse ou non conforme au présent règlement sera considérée comme nulle.'),

      H('Article 4 — Modalités de participation'),
      P('Pour participer, le participant doit :'),
      BULLET('faire l’acquisition d’un t-shirt collector « GTA VI » auprès de la salle, au prix de [prix] € ;'),
      BULLET('récupérer le code unique de participation figurant sur l’étiquette / la carte accompagnant le t-shirt ;'),
      BULLET('enregistrer ce code, accompagné de ses coordonnées (prénom, nom, e-mail, téléphone facultatif), soit EN LIGNE sur le site dédié [URL du site], soit EN SALLE à l’accueil auprès d’un membre de l’équipe.'),
      P('Chaque code ne peut être enregistré qu’une seule fois. L’achat de plusieurs t-shirts donne droit à autant de participations que de codes distincts.'),

      H('Article 5 — Participation sans obligation d’achat'),
      P('Conformément à la réglementation, une modalité de participation gratuite et sans obligation d’achat est offerte. Toute personne remplissant les conditions de l’article 3 peut participer sans acheter de t-shirt en adressant, par courrier postal affranchi au tarif lent en vigueur, une demande de participation sur papier libre à : SARL LIMA — Keep Cool Narbonne, Jeu GTA VI Collector, 44 rue Demoge, 11100 Narbonne, comportant ses nom, prénom, adresse postale, e-mail et la mention « Participation gratuite — Jeu GTA VI Collector ». Un code de participation lui sera attribué. Une seule participation gratuite par personne (même nom, même adresse) pendant toute la durée du Jeu. Les frais d’affranchissement sont remboursés sur demande (voir article 9).'),

      H('Article 6 — Dotations'),
      P('La dotation est composée de 3 lots identiques. Chaque lot comprend :'),
      BULLET('une console PlayStation 5 — valeur indicative [≈ 549] € TTC ;'),
      BULLET('un exemplaire du jeu vidéo « Grand Theft Auto VI » (édition standard, support [à préciser]) — valeur indicative [≈ 70] € TTC.'),
      P('Soit une valeur indicative de [≈ 619] € TTC par lot. Le Jeu compte donc 3 gagnants, chacun remportant l’intégralité d’un lot (une PlayStation 5 accompagnée du jeu GTA VI), soit 3 consoles et 3 jeux au total. Les dotations ne peuvent être ni échangées, ni reprises, ni faire l’objet d’une contrepartie financière. Le lot est indivisible : la console et le jeu ne peuvent être dissociés ni attribués à des personnes différentes. En cas d’indisponibilité d’une dotation pour une cause indépendante de la volonté de l’Organisateur, celui-ci se réserve le droit de la remplacer par un lot de valeur équivalente.'),

      H('Article 7 — Désignation des gagnants : le tirage au sort'),
      P('Les gagnants seront désignés par tirage au sort parmi l’ensemble des participations valides enregistrées à la clôture du Jeu. Le tirage désignera 3 gagnants, chacun remportant un lot complet (une PlayStation 5 + le jeu GTA VI), ainsi que [3] suppléants (classés dans l’ordre) destinés à remplacer un gagnant qui ne pourrait être joint ou serait disqualifié.'),
      P([T('Transparence du tirage : ', { b: true }),
        T('le tirage est réalisé au moyen d’un procédé informatique vérifiable et reproductible. Une « graine » publique, annoncée à l’avance, est combinée au code de chaque participant via la fonction cryptographique SHA-256 ; le classement des participants découle du tri de ces empreintes. Ce procédé garantit qu’aucune manipulation n’est possible et permet à tout participant de vérifier lui-même le résultat au moyen de l’outil mis à disposition sur le site ([URL]/verificateur.html). Un procès-verbal du tirage est établi et conservé par l’Organisateur.')]),

      H('Article 8 — Information et remise des lots'),
      P('Les gagnants seront informés individuellement par e-mail et/ou téléphone dans un délai de [7] jours suivant le tirage, et les résultats affichés à la salle. Les lots seront à retirer à l’accueil de la salle, sur présentation d’une pièce d’identité, dans un délai de [30] jours. Passé ce délai, ou en cas d’impossibilité de joindre un gagnant sous [10] jours, le lot pourra être attribué au premier suppléant, et ainsi de suite.'),

      H('Article 9 — Remboursement des frais'),
      P('Le remboursement des frais d’affranchissement engagés au titre de la participation gratuite (article 5) s’effectue sur demande écrite adressée à l’Organisateur, accompagnée d’un RIB, dans un délai de [60] jours suivant la participation. Le remboursement est limité à une demande par participant, sur la base du tarif postal « lettre verte » en vigueur. Le Jeu étant accessible gratuitement en ligne (hors coût de connexion à la charge du participant selon son abonnement), aucun autre frais n’est remboursé.'),

      H('Article 10 — Données personnelles (RGPD)'),
      P('Les données collectées (prénom, nom, e-mail, téléphone, code) sont traitées par l’Organisateur, responsable de traitement, aux seules fins de la gestion du Jeu et de la remise des lots, sur la base de l’exécution du présent règlement. Elles sont conservées pendant la durée du Jeu et [3 mois] après la remise des lots, puis supprimées, sauf consentement distinct à des communications commerciales. Conformément au Règlement (UE) 2016/679 et à la loi « Informatique et Libertés », chaque participant dispose d’un droit d’accès, de rectification, d’effacement, de limitation et d’opposition, exerçable à narbonne@keepcool.fr. Une réclamation peut être introduite auprès de la CNIL.'),

      H('Article 11 — Propriété intellectuelle et marques'),
      P('Le Jeu n’est ni organisé, ni parrainé, ni approuvé par Rockstar Games, Take-Two Interactive Software, Inc. ou Sony Interactive Entertainment. Les marques « Grand Theft Auto », « GTA », « PlayStation » et tous logos associés demeurent la propriété exclusive de leurs titulaires respectifs et ne sont cités qu’à titre d’identification des dotations. Le design du t-shirt collector est [une création originale de l’Organisateur / fourni par l’Organisateur].'),

      H('Article 12 — Responsabilité'),
      P('L’Organisateur ne saurait être tenu responsable en cas de dysfonctionnement du réseau Internet, de perte de données ou de tout événement de force majeure empêchant le bon déroulement du Jeu. L’Organisateur se réserve le droit d’écourter, prolonger, modifier ou annuler le Jeu si les circonstances l’exigeaient, sans que sa responsabilité puisse être engagée.'),

      H('Article 13 — Dépôt, consultation et acceptation du règlement'),
      P('Le présent règlement est consultable gratuitement pendant toute la durée du Jeu sur le site [URL] et à l’accueil de la salle. [Le cas échéant : il est déposé auprès de Maître [nom], huissier de justice à [ville].] La simple participation au Jeu implique l’acceptation pleine et entière du présent règlement.'),

      H('Article 14 — Loi applicable et litiges'),
      P('Le présent règlement est soumis au droit français. Toute réclamation doit être adressée par écrit à l’Organisateur dans un délai de [30] jours suivant la clôture du Jeu. À défaut de résolution amiable, les tribunaux français seront seuls compétents.'),

      new Paragraph({
        spacing: { before: 240 },
        children: [T('Fait à Narbonne, le [date]. — Version 1.0', { i: true, c: '777777' })],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('/home/claude/gta6-keepcool-concours/Reglement-jeu-concours-GTA6-KeepCool.docx', buf);
  console.log('DOCX écrit.');
});
