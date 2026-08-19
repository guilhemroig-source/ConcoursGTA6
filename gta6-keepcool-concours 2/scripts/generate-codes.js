'use strict';

/*
 * Genere des codes uniques a imprimer sur les etiquettes des t-shirts collector.
 * Chaque code = 1 t-shirt = 1 participation.
 *
 * Usage :
 *   node scripts/generate-codes.js 500        (genere 500 codes)
 *   node scripts/generate-codes.js 500 GTA    (prefixe personnalise)
 *
 * Les codes sont inseres en base ET exportes dans data/codes-a-imprimer.csv
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../lib/db');

const n = parseInt(process.argv[2] || '200', 10);
const prefix = (process.argv[3] || 'GTA6').toUpperCase();

// Alphabet sans caracteres ambigus (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBlock(len) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const insert = db.prepare('INSERT OR IGNORE INTO codes (code) VALUES (?)');
const exists = db.prepare('SELECT 1 FROM codes WHERE code = ?');

const created = [];
let attempts = 0;
while (created.length < n && attempts < n * 20) {
  attempts++;
  const code = `${prefix}-${randomBlock(4)}-${randomBlock(4)}`;
  if (exists.get(code)) continue;
  insert.run(code);
  created.push(code);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const outFile = path.join(DATA_DIR, 'codes-a-imprimer.csv');
fs.writeFileSync(outFile, '﻿code\r\n' + created.join('\r\n') + '\r\n', 'utf8');

console.log(`\n  ✅  ${created.length} codes generes et enregistres en base.`);
console.log(`  📄  Liste a imprimer : ${outFile}`);
console.log(`  Exemple : ${created.slice(0, 3).join('  |  ')}\n`);
