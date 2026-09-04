'use strict';

const path = require('path');
const crypto = require('crypto');
const https = require('https');
const express = require('express');
const db = require('./lib/db');
const config = require('./lib/config');
const { computeDraw } = require('./lib/draw');
const orders = require('./lib/orders');
const mollie = require('./lib/mollie');

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------ statistiques de visite
// Comptage anonyme des pages vues du site public. On n'enregistre jamais l'IP en clair :
// chaque visiteur est identifie par un hash (ip + navigateur + jour + sel), non reversible.
const VISIT_SALT = 'kc-gta6-visites-v1';
const insertVisite = db.prepare('INSERT INTO visites (jour, path, referer, visitor) VALUES (?, ?, ?, ?)');
function visitorHash(req, jour) {
  const ip = (req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();
  const ua = req.get('user-agent') || '';
  return crypto.createHash('sha256').update(ip + '|' + ua + '|' + jour + '|' + VISIT_SALT).digest('hex').slice(0, 20);
}
app.use((req, res, next) => {
  try {
    if (req.method === 'GET') {
      let p = req.path || '/';
      const isAsset = /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|map|json|txt|xml|mp4|webm|avif)$/i.test(p);
      const isApi = p.indexOf('/api/') === 0;
      const isAdmin = p === '/admin.html' || p === '/tirage.html' || p === '/verificateur.html';
      if (!isAsset && !isApi && !isAdmin) {
        if (p === '/') p = '/index.html';
        const jour = new Date().toISOString().slice(0, 10);
        let ref = '';
        try {
          const rr = req.get('referer');
          if (rr) {
            const host = new URL(rr).hostname;
            if (host && !/(^|\.)concours-gta6\.com$/i.test(host)) ref = host;
          }
        } catch (e) { /* referer invalide : ignore */ }
        insertVisite.run(jour, p.slice(0, 200), ref.slice(0, 120), visitorHash(req, jour));
      }
    }
  } catch (e) { /* le tracking ne doit jamais casser une page */ }
  next();
});

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
    prixCasquetteCents: config.prixCasquetteCents,
    fraisEnvoiCents: config.fraisEnvoiCents,
    tailles: config.tailles,
    devise: config.devise,
    paiementDemo: mollie.isDemo(),
    inscriptionsOuvertes: config.inscriptionsOuvertes,
  });
});

// Statistiques publiques (preuve sociale) : nombre de participants au tirage.
const publicParticipantCount = db.prepare('SELECT COUNT(*) AS n FROM participants');
app.get('/api/public/stats', (req, res) => {
  let n = 0;
  try { n = publicParticipantCount.get().n; } catch (e) {}
  res.json({ participants: n });
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

// Commande CASQUETTE SEULE (relance acheteurs : +1 chance par casquette, sans t-shirt)
app.post('/api/casquette', async (req, res) => {
  try {
    const cmd = orders.createCasquetteOrder(req.body || {});
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

// Statistiques de visite du site (pages vues, visiteurs uniques, sources, tendance).
const vq = {
  total: db.prepare('SELECT COUNT(*) AS n FROM visites'),
  uniques: db.prepare('SELECT COUNT(DISTINCT visitor) AS n FROM visites'),
  jour: db.prepare('SELECT COUNT(*) AS vues, COUNT(DISTINCT visitor) AS uniques FROM visites WHERE jour = ?'),
  uniquesDepuis: db.prepare('SELECT COUNT(DISTINCT visitor) AS n FROM visites WHERE jour >= ?'),
  vuesDepuis: db.prepare('SELECT COUNT(*) AS n FROM visites WHERE jour >= ?'),
  parJour: db.prepare('SELECT jour, COUNT(*) AS vues, COUNT(DISTINCT visitor) AS uniques FROM visites GROUP BY jour ORDER BY jour DESC LIMIT 30'),
  topPages: db.prepare('SELECT path, COUNT(*) AS n FROM visites GROUP BY path ORDER BY n DESC LIMIT 8'),
  topRef: db.prepare("SELECT referer, COUNT(*) AS n FROM visites WHERE referer IS NOT NULL AND referer <> '' GROUP BY referer ORDER BY n DESC LIMIT 8"),
};
app.get('/api/admin/visites', requireAdmin, (req, res) => {
  const jour = new Date().toISOString().slice(0, 10);
  const d7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  res.json({
    ok: true,
    total: vq.total.get().n,
    uniques: vq.uniques.get().n,
    aujourdhui: vq.jour.get(jour),
    uniques7: vq.uniquesDepuis.get(d7).n,
    vues7: vq.vuesDepuis.get(d7).n,
    parJour: vq.parJour.all(),
    topPages: vq.topPages.all(),
    topRef: vq.topRef.all(),
  });
});

// Recuperer manuellement une commande DEJA PAYEE (ex : paiement Mollie encaisse mais
// commande perdue). Genere codes + participations et la compte dans le CA.
app.post('/api/admin/commande/importer', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const payload = {
      items: Array.isArray(b.items) ? b.items : [],
      casquettes: parseInt(b.casquettes, 10) || 0,
      prenom: clean(b.prenom),
      nom: clean(b.nom),
      email: clean(b.email).toLowerCase(),
      telephone: clean(b.telephone),
      livraison_mode: b.livraison_mode === 'domicile' ? 'domicile' : 'retrait',
      adresse: clean(b.adresse),
      code_postal: clean(b.code_postal),
      ville: clean(b.ville),
    };
    const cmd = await orders.importPaidOrder(payload);
    res.json({ ok: true, numero: cmd.numero, codes: cmd.codes_json ? JSON.parse(cmd.codes_json) : [] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Mettre a jour le statut de paiement et/ou de livraison d'une commande.
app.post('/api/admin/commande/:id/statut', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cmd = orders.updateStatuts(id, clean(req.body.statut), clean(req.body.statut_livraison));
    res.json({ ok: true, commande: cmd });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Supprimer definitivement une commande (+ ses participations et codes).
app.post('/api/admin/commande/:id/supprimer', requireAdmin, (req, res) => {
  try {
    const r = orders.deleteOrder(parseInt(req.params.id, 10));
    res.json({ ok: true, numero: r.numero });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Supprimer un participant (corriger une saisie).
app.post('/api/admin/participant/:id/supprimer', requireAdmin, (req, res) => {
  try {
    orders.deleteParticipant(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Corriger l'e-mail d'un participant.
app.post('/api/admin/participant/:id/email', requireAdmin, (req, res) => {
  try {
    const p = orders.updateParticipantEmail(parseInt(req.params.id, 10), clean(req.body.email));
    res.json({ ok: true, participant: p });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
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

// ------------------------------------------------------------ relance paniers abandonnes
// Un visiteur qui a saisi son email et lance le paiement mais n'a pas paye recoit,
// entre 45 min et 24 h apres, un e-mail de rappel pour finaliser sa participation.
function relanceApiKey() {
  const p = config.smtp && config.smtp.pass;
  return process.env.BREVO_API_KEY || (p && /^xkeysib-/i.test(p) ? p : '');
}
function relanceFrom() {
  const from = config.mailFrom || 'Keep Cool Narbonne <narbonne@keepcool.fr>';
  const m = String(from).match(/^\s*(.*?)\s*<\s*(.+?)\s*>\s*$/);
  return m ? { name: m[1] || 'Keep Cool Narbonne', email: m[2] } : { name: 'Keep Cool Narbonne', email: String(from).trim() };
}
function sendRelanceEmail(to, prenom) {
  return new Promise((resolve) => {
    const key = relanceApiKey();
    if (!key || !to) return resolve(false);
    const f = relanceFrom();
    const p = prenom ? (String(prenom).trim() + ', ') : '';
    const html =
      '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f0d1e;color:#eef0ff;padding:28px;border-radius:14px">' +
      '<h1 style="color:#22e0e0;font-size:22px;margin:0 0 10px">🎮 Ta participation t\'attend !</h1>' +
      '<p style="font-size:15px;line-height:1.5;color:#cfd0e6">' + p + 'tu étais à deux doigts de tenter ta chance de gagner une <b style="color:#ff2e88">PlayStation 5 + GTA VI</b> avec Keep Cool Narbonne.</p>' +
      '<p style="font-size:15px;line-height:1.5;color:#cfd0e6">Ton T-shirt collector à 25€ = <b>1 chance</b> au tirage. Il te reste juste à finaliser :</p>' +
      '<p style="text-align:center;margin:22px 0"><a href="https://www.concours-gta6.com/boutique.html" style="display:inline-block;background:#ff2e88;color:#0a0a14;font-weight:bold;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:16px">Finaliser ma participation →</a></p>' +
      '<p style="font-size:12px;color:#8a8fa3">Tirage transparent · Fin des participations le 30/09. À très vite en salle !</p>' +
      '</div>';
    const payload = JSON.stringify({
      sender: f,
      to: [{ email: to }],
      subject: '🎮 Ta chance de gagner une PS5 + GTA VI t\'attend !',
      htmlContent: html,
    });
    const req = https.request({
      hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (r) => { r.on('data', () => {}); r.on('end', () => resolve(r.statusCode >= 200 && r.statusCode < 300)); });
    req.on('error', () => resolve(false));
    req.write(payload); req.end();
  });
}
const abandonedStmt = db.prepare(
  "SELECT id, prenom, email FROM commandes WHERE statut='en_attente' AND email IS NOT NULL AND email <> '' " +
  "AND relance_envoyee=0 AND cree_le <= datetime('now','-45 minutes') AND cree_le >= datetime('now','-1 day')"
);
const markRelance = db.prepare('UPDATE commandes SET relance_envoyee=1 WHERE id=?');
async function relanceAbandoned() {
  try {
    const rows = abandonedStmt.all();
    for (const c of rows) {
      markRelance.run(c.id); // marque avant envoi pour eviter tout doublon
      try { await sendRelanceEmail(c.email, c.prenom); } catch (e) {}
    }
  } catch (e) { console.error('relance paniers:', e.message); }
}
setInterval(relanceAbandoned, 15 * 60 * 1000);

app.listen(config.port, () => {
  console.log(`\n  🎮  Site jeu-concours GTA VI x Keep Cool`);
  console.log(`  ➜  http://localhost:${config.port}`);
  console.log(`  ➜  Admin : http://localhost:${config.port}/admin.html  (mot de passe : ${config.adminPassword})`);
  console.log(`  ➜  Tirage : http://localhost:${config.port}/tirage.html\n`);
});
