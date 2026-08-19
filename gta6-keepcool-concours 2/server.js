'use strict';

const path = require('path');
const express = require('express');
const db = require('./lib/db');
const config = require('./lib/config');
const { computeDraw } = require('./lib/draw');
const orders = require('./lib/orders');
const mollie = require('./lib/mollie');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------------ helpers
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(s) {
  return (s == null ? '' : String(s)).trim();
}

function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== config.adminPassword) {
    return res.status(401).json({ ok: false, error: 'Acces refuse. Mot de passe admin incorrect.' });
  }
  next();
}

// Prepared statements
const stmt = {
  getCode: db.prepare('SELECT * FROM codes WHERE code = ?'),
  useCode: db.prepare("UPDATE codes SET statut = 'utilise', participant_id = ? WHERE code = ?"),
  insertParticipant: db.prepare(`
    INSERT INTO participants (code, prenom, nom, email, telephone, source, reglement_ok, rgpd_ok, majeur_ok, ip)
    VALUES (@code, @prenom, @nom, @email, @telephone, @source, @reglement_ok, @rgpd_ok, @majeur_ok, @ip)
  `),
  listParticipants: db.prepare('SELECT * FROM participants ORDER BY id DESC'),
  allParticipants: db.prepare('SELECT id, code, prenom, nom, email, telephone, source, cree_le FROM participants ORDER BY id ASC'),
  countParticipants: db.prepare('SELECT COUNT(*) AS n FROM participants'),
  countBySource: db.prepare("SELECT source, COUNT(*) AS n FROM participants GROUP BY source"),
  countCodes: db.prepare("SELECT statut, COUNT(*) AS n FROM codes GROUP BY statut"),
  insertTirage: db.prepare('INSERT INTO tirages (seed, nb_participants, resultat_json) VALUES (?, ?, ?)'),
  listTirages: db.prepare('SELECT id, seed, nb_participants, cree_le FROM tirages ORDER BY id DESC'),
  getTirage: db.prepare('SELECT * FROM tirages WHERE id = ?'),
};

// Transaction : inscrire un participant et consommer son code
const inscrire = db.transaction((data) => {
  const codeRow = stmt.getCode.get(data.code);
  if (!codeRow) {
    const err = new Error("Ce code n'existe pas. Verifiez le code figurant sur l'etiquette de votre t-shirt collector.");
    err.status = 400;
    throw err;
  }
  if (codeRow.statut === 'utilise') {
    const err = new Error('Ce code a deja ete utilise pour une inscription.');
    err.status = 409;
    throw err;
  }
  const info = stmt.insertParticipant.run(data);
  stmt.useCode.run(info.lastInsertRowid, data.code);
  return info.lastInsertRowid;
});

// -------------------------------------------------------------- public API

// Config publique (dates, dotations, etat des inscriptions)
app.get('/api/config', (req, res) => {
  res.json({
    titre: config.titre,
    organisateur: config.organisateur,
    ville: config.ville,
    dateDebut: config.dateDebut,
    dateFin: config.dateFin,
    dateTirage: config.dateTirage,
    nbGagnants: config.nbGagnants,
    nbPS5: config.nbPS5,
    nbGTA6: config.nbGTA6,
    prixTshirt: config.prixTshirt,
    prixTshirtCents: config.prixTshirtCents,
    fraisEnvoiCents: config.fraisEnvoiCents,
    tailles: config.tailles,
    devise: config.devise,
    paiementDemo: mollie.isDemo(),
    inscriptionsOuvertes: config.inscriptionsOuvertes,
  });
});

// ----------------------------------------------------------- boutique / paiement

// Creer une commande + demarrer le paiement Mollie
app.post('/api/commande', async (req, res) => {
  try {
    const cmd = orders.createOrder(req.body || {});
    const pay = await mollie.createPayment(cmd);
    orders.attachPayment(cmd.id, pay.paymentId);
    res.json({ ok: true, numero: cmd.numero, montant_total: cmd.montant_total, checkoutUrl: pay.checkoutUrl, demo: pay.demo });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Webhook Mollie : notifie du changement de statut d'un paiement
app.post('/api/webhook/mollie', async (req, res) => {
  const paymentId = req.body && req.body.id;
  if (!paymentId) return res.status(400).send('missing id');
  try {
    const cmd = orders.byPayment(paymentId);
    if (cmd) {
      const st = await mollie.getPaymentStatus(paymentId);
      if (st.paid) await orders.markPaidAndNotify(cmd);
      else if (st.failed) orders.markFailed('echouee', cmd.id);
    }
    res.status(200).send('ok'); // Mollie exige un 200
  } catch (e) {
    console.error('webhook error', e.message);
    res.status(200).send('ok');
  }
});

// Statut public d'une commande (page merci). Re-verifie aupres de Mollie si besoin.
app.get('/api/commande/:numero', async (req, res) => {
  const cmd = orders.byNumero(req.params.numero);
  if (!cmd) return res.status(404).json({ ok: false, error: 'Commande introuvable.' });
  if (cmd.statut === 'en_attente' && cmd.mollie_payment_id && !mollie.isDemo()) {
    try {
      const st = await mollie.getPaymentStatus(cmd.mollie_payment_id);
      if (st.paid) { await orders.markPaidAndNotify(cmd); }
      else if (st.failed) orders.markFailed('echouee', cmd.id);
    } catch (e) { /* ignore */ }
  }
  const fresh = orders.byNumero(req.params.numero);
  res.json({
    ok: true,
    numero: fresh.numero,
    statut: fresh.statut,
    prenom: fresh.prenom,
    montant_total: fresh.montant_total,
    frais_envoi: fresh.frais_envoi,
    quantite: fresh.quantite,
    livraison_mode: fresh.livraison_mode,
    codes: fresh.codes_json ? JSON.parse(fresh.codes_json) : [],
  });
});

// MODE DEMO uniquement : simuler la validation du paiement
app.post('/api/demo/payer', async (req, res) => {
  if (!mollie.isDemo()) return res.status(403).json({ ok: false, error: 'Mode démo désactivé (Mollie configuré).' });
  const cmd = orders.byNumero((req.body && req.body.numero) || '');
  if (!cmd) return res.status(404).json({ ok: false, error: 'Commande introuvable.' });
  await orders.markPaidAndNotify(cmd);
  res.json({ ok: true });
});

// Inscription en ligne (acheteur du t-shirt, muni de son code)
app.post('/api/inscription', (req, res) => {
  if (!config.inscriptionsOuvertes) {
    return res.status(403).json({ ok: false, error: 'Les inscriptions sont closes.' });
  }
  const data = {
    code: clean(req.body.code).toUpperCase(),
    prenom: clean(req.body.prenom),
    nom: clean(req.body.nom),
    email: clean(req.body.email).toLowerCase(),
    telephone: clean(req.body.telephone),
    source: 'en_ligne',
    reglement_ok: req.body.reglement_ok ? 1 : 0,
    rgpd_ok: req.body.rgpd_ok ? 1 : 0,
    majeur_ok: req.body.majeur_ok ? 1 : 0,
    ip: (req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim(),
  };

  const errors = [];
  if (!data.prenom) errors.push('Prenom obligatoire.');
  if (!data.nom) errors.push('Nom obligatoire.');
  if (!EMAIL_RE.test(data.email)) errors.push('Adresse email invalide.');
  if (!data.code) errors.push('Code du t-shirt obligatoire.');
  if (!data.reglement_ok) errors.push('Vous devez accepter le reglement.');
  if (!data.rgpd_ok) errors.push('Vous devez accepter le traitement de vos donnees (RGPD).');
  if (!data.majeur_ok) errors.push('Vous devez certifier etre majeur(e).');
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });

  try {
    const id = inscrire(data);
    return res.json({ ok: true, id, message: 'Inscription enregistree ! Bonne chance 🎮' });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// --------------------------------------------------------------- admin API

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json({
    total: stmt.countParticipants.get().n,
    parSource: stmt.countBySource.all(),
    codes: stmt.countCodes.all(),
    tirages: stmt.listTirages.all(),
  });
});

app.get('/api/admin/participants', requireAdmin, (req, res) => {
  res.json({ ok: true, participants: stmt.listParticipants.all() });
});

app.get('/api/admin/commandes', requireAdmin, (req, res) => {
  res.json({ ok: true, commandes: orders.listCommandes() });
});

// Inscription en salle (staff a l'accueil)
app.post('/api/admin/inscription-salle', requireAdmin, (req, res) => {
  const data = {
    code: clean(req.body.code).toUpperCase(),
    prenom: clean(req.body.prenom),
    nom: clean(req.body.nom),
    email: clean(req.body.email).toLowerCase(),
    telephone: clean(req.body.telephone),
    source: 'en_salle',
    reglement_ok: 1,
    rgpd_ok: 1,
    majeur_ok: 1,
    ip: 'accueil',
  };
  if (!data.prenom || !data.nom || !data.code) {
    return res.status(400).json({ ok: false, error: 'Prenom, nom et code sont obligatoires.' });
  }
  if (data.email && !EMAIL_RE.test(data.email)) {
    return res.status(400).json({ ok: false, error: 'Email invalide.' });
  }
  try {
    const id = inscrire(data);
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Export CSV de tous les participants
app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const rows = stmt.allParticipants.all();
  const header = ['id', 'code', 'prenom', 'nom', 'email', 'telephone', 'source', 'cree_le'];
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = [header.join(',')]
    .concat(rows.map((r) => header.map((h) => esc(r[h])).join(',')))
    .join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="participants-gta6.csv"');
  res.send('﻿' + csv); // BOM pour Excel
});

// Generer des codes de t-shirts (pour les ventes en salle). Sans acces shell.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genBlock(len) {
  const b = require('crypto').randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return out;
}
const insertCodeOnly = db.prepare('INSERT OR IGNORE INTO codes (code) VALUES (?)');
const codeExists = db.prepare('SELECT 1 FROM codes WHERE code = ?');
const availableCodes = db.prepare("SELECT code FROM codes WHERE statut='disponible' ORDER BY cree_le");

app.post('/api/admin/generer-codes', requireAdmin, (req, res) => {
  let n = parseInt(req.body && req.body.nombre, 10) || 0;
  n = Math.max(1, Math.min(2000, n));
  const prefix = String((req.body && req.body.prefix) || 'GTA6').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'GTA6';
  const created = [];
  let attempts = 0;
  while (created.length < n && attempts < n * 20) {
    attempts++;
    const code = `${prefix}-${genBlock(4)}-${genBlock(4)}`;
    if (codeExists.get(code)) continue;
    insertCodeOnly.run(code);
    created.push(code);
  }
  res.json({ ok: true, generes: created.length, codes: created });
});

app.get('/api/admin/codes.csv', requireAdmin, (req, res) => {
  const rows = availableCodes.all();
  const csv = 'code\r\n' + rows.map((r) => r.code).join('\r\n') + '\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="codes-a-imprimer.csv"');
  res.send('﻿' + csv);
});

// Lancer un tirage au sort (verifiable) et l'enregistrer
app.post('/api/admin/tirage', requireAdmin, (req, res) => {
  const seed = clean(req.body.seed);
  const participants = stmt.allParticipants.all();
  if (participants.length < config.nbGagnants) {
    return res.status(400).json({
      ok: false,
      error: `Pas assez de participants (${participants.length}) pour attribuer les ${config.nbGagnants} lots.`,
    });
  }
  try {
    const resultat = computeDraw(seed, participants, {
      nbGagnants: config.nbGagnants,
      nbSuppleants: config.nbSuppleants,
    });
    const info = stmt.insertTirage.run(seed, participants.length, JSON.stringify(resultat));
    res.json({ ok: true, tirageId: info.lastInsertRowid, resultat });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/admin/tirage/:id', requireAdmin, (req, res) => {
  const row = stmt.getTirage.get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Tirage introuvable.' });
  res.json({ ok: true, tirage: { ...row, resultat: JSON.parse(row.resultat_json) } });
});

// ------------------------------------------------------------- static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(config.port, () => {
  console.log(`\n  🎮  Site jeu-concours GTA VI x Keep Cool`);
  console.log(`  ➜  http://localhost:${config.port}`);
  console.log(`  ➜  Admin : http://localhost:${config.port}/admin.html  (mot de passe : ${config.adminPassword})`);
  console.log(`  ➜  Tirage : http://localhost:${config.port}/tirage.html\n`);
});
