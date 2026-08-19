'use strict';

/*
 * Lance un tirage au sort depuis le terminal (alternative a l'interface web).
 * Usage : node scripts/run-draw.js "ma-graine-publique-2026"
 */

const db = require('../lib/db');
const config = require('../lib/config');
const { computeDraw } = require('../lib/draw');

const seed = process.argv.slice(2).join(' ').trim();
if (!seed) {
  console.error('\n  Usage : node scripts/run-draw.js "graine publique"\n');
  process.exit(1);
}

const participants = db.prepare('SELECT id, code, prenom, nom, email FROM participants ORDER BY id ASC').all();
if (participants.length < config.nbGagnants) {
  console.error(`\n  Pas assez de participants (${participants.length}).\n`);
  process.exit(1);
}

const r = computeDraw(seed, participants, {
  nbGagnants: config.nbGagnants,
  nbSuppleants: config.nbSuppleants,
});

db.prepare('INSERT INTO tirages (seed, nb_participants, resultat_json) VALUES (?, ?, ?)')
  .run(seed, participants.length, JSON.stringify(r));

const line = (p) => `   ${String(p.rang).padStart(3)}. ${p.prenom} ${p.nom}  (${p.code})  [${p.empreinte.slice(0, 12)}...]`;

console.log(`\n  GRAINE : ${seed}`);
console.log(`  PARTICIPANTS : ${r.nb_participants}\n`);
console.log('  🎮  GAGNANTS — LOT « PlayStation 5 + jeu GTA VI »');
r.gagnants.forEach((p) => console.log(line(p)));
console.log('\n  🔁  SUPPLEANTS');
r.suppleants.forEach((p) => console.log(line(p)));
console.log('');
