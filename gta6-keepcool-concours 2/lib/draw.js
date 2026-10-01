'use strict';

/*
 * Tirage au sort VERIFIABLE et REPRODUCTIBLE.
 * 3 gagnants : PlayStation 5 + jeu GTA VI, puis des suppleants.
 * REGLE : un seul lot par personne (dedup par e-mail / telephone / nom).
 * Methode : classement par SHA-256(seed | code) croissant, puis on descend
 * ce classement en ne retenant qu'une seule entree par personne.
 */

const crypto = require('crypto');

const LOT_LABEL = 'PlayStation 5 + jeu GTA VI';

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function personKey(p) {
  const email = (p.email || '').trim().toLowerCase();
  if (email) return 'e:' + email;
  const tel = String(p.telephone || p.phone || '').replace(/\D/g, '');
  if (tel) return 't:' + tel;
  const nom = ((p.prenom || '') + '|' + (p.nom || '')).trim().toLowerCase();
  if (nom !== '|') return 'n:' + nom;
  return 'c:' + p.code;
}

function computeDraw(seed, participants, config = {}) {
  const nbGagnants = config.nbGagnants ?? 3;
  const nbSuppleants = config.nbSuppleants ?? 5;
  const lotLabel = config.lotLabel || LOT_LABEL;

  if (!seed || typeof seed !== 'string' || seed.trim().length < 4) {
    throw new Error('La graine (seed) doit contenir au moins 4 caracteres.');
  }

  const classement = participants
    .map((p) => ({
      ...p,
      empreinte: sha256Hex(`${seed}|${p.code}`),
    }))
    .sort((a, b) =>
      a.empreinte < b.empreinte ? -1
      : a.empreinte > b.empreinte ? 1
      : a.code < b.code ? -1 : 1
    )
    .map((p, i) => ({ rang: i + 1, ...p }));

  const vus = new Set();
  const gagnants = [];
  const suppleants = [];
  for (const p of classement) {
    const key = personKey(p);
    if (vus.has(key)) continue;
    vus.add(key);
    if (gagnants.length < nbGagnants) {
      gagnants.push({ ...p, lot: lotLabel });
    } else if (suppleants.length < nbSuppleants) {
      suppleants.push({ ...p, lot: `Suppleant #${suppleants.length + 1}` });
    } else {
      break;
    }
  }

  return {
    seed,
    algorithme: 'tri par SHA-256(seed | code) croissant, puis 1 seul lot par personne',
    genere_le: new Date().toISOString(),
    nb_participants: participants.length,
    config: { nbGagnants, nbSuppleants, lotLabel },
    gagnants,
    suppleants,
    classement,
  };
}

module.exports = { computeDraw, sha256Hex, LOT_LABEL };
