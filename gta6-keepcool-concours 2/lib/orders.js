'use strict';

/*
 * Logique metier des commandes : creation, calcul des montants,
 * finalisation (attribution automatique des codes de participation + e-mail).
 */

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { sendOrderEmail } = require('./mailer');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function block(len) {
  const b = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return out;
}
function newCode() {
  return `GTA6-${block(4)}-${block(4)}`;
}

const stmt = {
  insert: db.prepare(`
    INSERT INTO commandes (numero, prenom, nom, email, telephone, livraison_mode, adresse, code_postal, ville,
      items_json, quantite, montant_articles, frais_envoi, montant_total, statut, mollie_payment_id)
    VALUES (@numero,@prenom,@nom,@email,@telephone,@livraison_mode,@adresse,@code_postal,@ville,
      @items_json,@quantite,@montant_articles,@frais_envoi,@montant_total,'en_attente',NULL)
  `),
  setNumero: db.prepare('UPDATE commandes SET numero = ? WHERE id = ?'),
  setPayment: db.prepare('UPDATE commandes SET mollie_payment_id = ? WHERE id = ?'),
  byNumero: db.prepare('SELECT * FROM commandes WHERE numero = ?'),
  byPayment: db.prepare('SELECT * FROM commandes WHERE mollie_payment_id = ?'),
  byId: db.prepare('SELECT * FROM commandes WHERE id = ?'),
  markPaid: db.prepare("UPDATE commandes SET statut='payee', codes_json=?, paye_le=datetime('now') WHERE id=?"),
  markFailed: db.prepare("UPDATE commandes SET statut=? WHERE id=?"),
  markEmail: db.prepare('UPDATE commandes SET email_envoye=1 WHERE id=?'),
  insertCode: db.prepare("INSERT INTO codes (code, statut, participant_id) VALUES (?, 'utilise', NULL)"),
  insertParticipant: db.prepare(`
    INSERT INTO participants (code, prenom, nom, email, telephone, source, reglement_ok, rgpd_ok, majeur_ok, ip, commande_id)
    VALUES (?, ?, ?, ?, ?, 'boutique', 1, 1, 1, 'boutique', ?)
  `),
  linkCode: db.prepare('UPDATE codes SET participant_id=? WHERE code=?'),
  listCommandes: db.prepare('SELECT id, numero, prenom, nom, email, quantite, montant_total, statut, livraison_mode, cree_le, paye_le FROM commandes ORDER BY id DESC'),
};

function centsToValue(cents) {
  return (cents / 100).toFixed(2); // "28.50"
}

/** Valide et calcule une commande a partir du payload client. */
function buildOrder(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const clean = [];
  let quantite = 0;
  for (const it of items) {
    const taille = String(it.taille || '').toUpperCase();
    const qte = Math.max(0, Math.min(20, parseInt(it.qte, 10) || 0));
    if (!config.tailles.includes(taille) || qte === 0) continue;
    clean.push({ taille, qte });
    quantite += qte;
  }
  if (quantite === 0) throw httpErr(400, 'Sélectionnez au moins un t-shirt.');
  if (quantite > 20) throw httpErr(400, 'Quantité maximale : 20 t-shirts par commande.');

  const prenom = String(payload.prenom || '').trim();
  const nom = String(payload.nom || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const telephone = String(payload.telephone || '').trim();
  const livraison_mode = payload.livraison_mode === 'retrait' ? 'retrait' : 'domicile';

  if (!prenom || !nom) throw httpErr(400, 'Prénom et nom obligatoires.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpErr(400, 'Email invalide.');

  let adresse = '', code_postal = '', ville = '';
  if (livraison_mode === 'domicile') {
    adresse = String(payload.adresse || '').trim();
    code_postal = String(payload.code_postal || '').trim();
    ville = String(payload.ville || '').trim();
    if (!adresse || !code_postal || !ville) throw httpErr(400, 'Adresse de livraison incomplète.');
  }

  const montant_articles = quantite * config.prixTshirtCents;
  const frais_envoi = livraison_mode === 'domicile' ? config.fraisEnvoiCents : 0;
  const montant_total = montant_articles + frais_envoi;

  return {
    numero: 'TMP-' + block(8),
    prenom, nom, email, telephone, livraison_mode, adresse, code_postal, ville,
    items_json: JSON.stringify(clean), quantite, montant_articles, frais_envoi, montant_total,
  };
}

const createOrder = db.transaction((payload) => {
  const data = buildOrder(payload);
  const info = stmt.insert.run(data);
  const id = info.lastInsertRowid;
  const numero = `SSC-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
  stmt.setNumero.run(numero, id);
  return stmt.byId.get(id);
});

function attachPayment(orderId, paymentId) {
  stmt.setPayment.run(paymentId, orderId);
}

/** Finalise une commande payee : attribue les codes + cree les participations. Idempotent. */
const finalizePaid = db.transaction((cmd) => {
  if (cmd.statut === 'payee') return { alreadyDone: true, codes: JSON.parse(cmd.codes_json || '[]') };
  const codes = [];
  for (let i = 0; i < cmd.quantite; i++) {
    let code = newCode();
    // garantir l'unicite
    while (db.prepare('SELECT 1 FROM codes WHERE code=?').get(code)) code = newCode();
    stmt.insertCode.run(code);
    const pInfo = stmt.insertParticipant.run(code, cmd.prenom, cmd.nom, cmd.email, cmd.telephone, cmd.id);
    stmt.linkCode.run(pInfo.lastInsertRowid, code);
    codes.push(code);
  }
  stmt.markPaid.run(JSON.stringify(codes), cmd.id);
  return { alreadyDone: false, codes };
});

/** Marque payee + envoie l'e-mail (hors transaction). Renvoie la commande a jour. */
async function markPaidAndNotify(cmd) {
  const res = finalizePaid(cmd);
  const updated = stmt.byId.get(cmd.id);
  if (!res.alreadyDone && !updated.email_envoye) {
    try {
      await sendOrderEmail(updated);
      stmt.markEmail.run(cmd.id);
    } catch (e) {
      console.error('  ⚠️  Envoi e-mail commande', cmd.numero, ':', e.message);
    }
  }
  return stmt.byId.get(cmd.id);
}

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = {
  createOrder, attachPayment, markPaidAndNotify, centsToValue,
  byNumero: (n) => stmt.byNumero.get(n),
  byPayment: (p) => stmt.byPayment.get(p),
  byId: (id) => stmt.byId.get(id),
  markFailed: (statut, id) => stmt.markFailed.run(statut, id),
  listCommandes: () => stmt.listCommandes.all(),
};
