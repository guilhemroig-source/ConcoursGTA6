'use strict';

/*
 * Configuration centrale du jeu-concours.
 * Modifiable via variables d'environnement (voir .env.example) ou directement ici.
 */

module.exports = {
  // Identite de l'operation ------------------------------------------------
  organisateur: process.env.ORGANISATEUR || 'Keep Cool Narbonne',
  ville: process.env.VILLE || 'Narbonne',
  titre: process.env.TITRE || 'GTA VI Collector — Le Grand Jeu Keep Cool',

  // Identite legale de l'exploitant --------------------------------------
  raisonSociale: process.env.RAISON_SOCIALE || 'SARL LIMA',
  siret: process.env.SIRET || '520 349 275 00021',
  siren: process.env.SIREN || '520 349 275',
  adresse: process.env.ADRESSE || '44 rue Demoge, 11100 Narbonne',
  telephone: process.env.TELEPHONE || '04 58 49 11 06',
  email: process.env.EMAIL_CONTACT || 'narbonne@keepcool.fr',

  // Dates (format libre pour affichage) ------------------------------------
  dateDebut: process.env.DATE_DEBUT || '[JJ/MM/AAAA]',
  dateFin: process.env.DATE_FIN || '30/09/2026',
  dateTirage: process.env.DATE_TIRAGE || '[JJ/MM/AAAA]',

  // Dotations --------------------------------------------------------------
  // 3 gagnants, chacun remporte un LOT COMPLET : 1 PlayStation 5 + 1 jeu GTA VI.
  nbGagnants: parseInt(process.env.NB_GAGNANTS || '3', 10),
  nbSuppleants: parseInt(process.env.NB_SUPPLEANTS || '3', 10),
  nbPS5: parseInt(process.env.NB_PS5 || '3', 10),   // total consoles (= nbGagnants)
  nbGTA6: parseInt(process.env.NB_GTA6 || '3', 10), // total jeux (= nbGagnants)
  prixTshirt: process.env.PRIX_TSHIRT || '25 €',

  // Ouverture des inscriptions (mettre false apres la cloture) --------------
  inscriptionsOuvertes: (process.env.INSCRIPTIONS_OUVERTES || 'true') !== 'false',

  // Boutique en ligne ------------------------------------------------------
  prixTshirtCents: parseInt(process.env.PRIX_TSHIRT_CENTS || '2500', 10), // 25,00 €
  prixCasquetteCents: parseInt(process.env.PRIX_CASQUETTE_CENTS || '1500', 10), // 15,00 €
  fraisEnvoiCents: parseInt(process.env.FRAIS_ENVOI_CENTS || '350', 10),  // 3,50 €
  tailles: (process.env.TAILLES || 'S,M,L,XL,XXL').split(','),
  devise: 'EUR',

  // Paiement Mollie --------------------------------------------------------
  // Cle API Mollie (test_xxx ou live_xxx). Laisser vide => MODE DEMO (paiement simule).
  mollieApiKey: process.env.MOLLIE_API_KEY || '',
  // URL publique du site (indispensable pour Mollie : redirection + webhook)
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Envoi d'e-mails (SMTP) -------------------------------------------------
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
  },
  mailFrom: process.env.MAIL_FROM || 'Keep Cool Narbonne <narbonne@keepcool.fr>',
  mailBcc: process.env.MAIL_BCC || 'narbonne@keepcool.fr',

  // Securite admin ---------------------------------------------------------
  // A CHANGER IMPERATIVEMENT avant mise en ligne !
  adminPassword: process.env.ADMIN_PASSWORD || 'keepcool-gta6',

  port: parseInt(process.env.PORT || '3000', 10),
};
