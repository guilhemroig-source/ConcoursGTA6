'use strict';

/*
 * Couche base de donnees (SQLite via better-sqlite3).
 * Cree le fichier data/concours.db et les tables au premier lancement.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Dossier de donnees : configurable via DATA_DIR (utile pour un volume persistant
// sur Railway/Render). Par defaut : <projet>/data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'concours.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS codes (
  code            TEXT PRIMARY KEY,
  statut          TEXT NOT NULL DEFAULT 'disponible', -- disponible | utilise
  participant_id  INTEGER,
  cree_le         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS participants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  email           TEXT NOT NULL,
  telephone       TEXT,
  source          TEXT NOT NULL DEFAULT 'en_ligne',  -- en_ligne | en_salle
  reglement_ok    INTEGER NOT NULL DEFAULT 0,
  rgpd_ok         INTEGER NOT NULL DEFAULT 0,
  majeur_ok       INTEGER NOT NULL DEFAULT 0,
  ip              TEXT,
  cree_le         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (code) REFERENCES codes(code)
);

CREATE TABLE IF NOT EXISTS tirages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  seed            TEXT NOT NULL,
  nb_participants INTEGER NOT NULL,
  resultat_json   TEXT NOT NULL,
  cree_le         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commandes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  numero            TEXT NOT NULL UNIQUE,
  prenom            TEXT NOT NULL,
  nom               TEXT NOT NULL,
  email             TEXT NOT NULL,
  telephone         TEXT,
  livraison_mode    TEXT NOT NULL DEFAULT 'domicile', -- domicile | retrait
  adresse           TEXT,
  code_postal       TEXT,
  ville             TEXT,
  items_json        TEXT NOT NULL,          -- [{taille, qte}]
  quantite          INTEGER NOT NULL,
  montant_articles  INTEGER NOT NULL,       -- centimes
  frais_envoi       INTEGER NOT NULL,       -- centimes
  montant_total     INTEGER NOT NULL,       -- centimes
  statut            TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | payee | expediee | annulee | echouee
  mollie_payment_id TEXT,
  codes_json        TEXT,                   -- codes de participation attribues
  email_envoye      INTEGER NOT NULL DEFAULT 0,
  cree_le           TEXT NOT NULL DEFAULT (datetime('now')),
  paye_le           TEXT
);
`);

// Migration douce : lier un participant a une commande (achat en ligne)
const cols = db.prepare("PRAGMA table_info(participants)").all().map((c) => c.name);
if (!cols.includes('commande_id')) {
  db.exec('ALTER TABLE participants ADD COLUMN commande_id INTEGER');
}

// Migration douce : statut de livraison/distribution, distinct du statut de paiement.
// Valeurs : en_attente_distribution | distribue_club | expediee
const cmdCols = db.prepare("PRAGMA table_info(commandes)").all().map((c) => c.name);
if (!cmdCols.includes('statut_livraison')) {
  db.exec("ALTER TABLE commandes ADD COLUMN statut_livraison TEXT NOT NULL DEFAULT 'en_attente_distribution'");
}

// Migration douce : suivi de la relance des paniers abandonnes (0 = pas encore relance).
if (!cmdCols.includes('relance_envoyee')) {
  db.exec("ALTER TABLE commandes ADD COLUMN relance_envoyee INTEGER NOT NULL DEFAULT 0");
}

// Statistiques de visite (comptage anonyme, RGPD-friendly : pas d'IP en clair,
// on stocke un identifiant hache par visiteur/jour).
db.exec(`
CREATE TABLE IF NOT EXISTS visites (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  jour      TEXT NOT NULL,            -- AAAA-MM-JJ
  path      TEXT NOT NULL,            -- page vue
  referer   TEXT,                     -- domaine d'origine (hors site)
  visitor   TEXT NOT NULL,            -- hash anonyme (ip+ua+jour+sel)
  cree_le   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visites_jour ON visites(jour);
CREATE INDEX IF NOT EXISTS idx_visites_visitor ON visites(visitor);
`);

module.exports = db;
