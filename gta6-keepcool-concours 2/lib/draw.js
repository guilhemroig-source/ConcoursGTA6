'use strict';

/*
 * Tirage au sort VERIFIABLE et REPRODUCTIBLE.
 *
 * Chaque gagnant remporte un LOT COMPLET : une PlayStation 5 + le jeu GTA VI.
 * Il y a donc 5 gagnants (5 PS5 et 5 jeux GTA VI au total), puis des suppleants.
 *
 * Principe (transparent et auditable) :
 *  1. On fige la liste des participants a la cloture (chaque participant a un
 *     code unique de t-shirt).
 *  2. On choisit une "graine" (seed) PUBLIQUE, annoncee a l'avance. Par exemple
 *     une phrase + une date, ou un evenement aleatoire public futur
 *     (ex : numeros du tirage Loto d'une date donnee). Personne ne peut la
 *     predire ni la manipuler.
 *  3. Pour chaque participant on calcule une empreinte :
 *         h = SHA-256( seed + "|" + code )
 *  4. On classe les participants par empreinte croissante. Ce classement est
 *     100% deterministe : avec la meme graine et la meme liste, tout le monde
 *     retrouve exactement le meme ordre (voir le verificateur public).
 *  5. Les gagnants sont les premiers du classement :
 *         - 5 premiers  -> LOT « PlayStation 5 + jeu GTA VI »
 *         - N suivants  -> suppleants (dans l'ordre)
 */

const crypto = require('crypto');

const LOT_LABEL = 'PlayStation 5 + jeu GTA VI';

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * @param {string} seed  Graine publique.
 * @param {Array<{code:string, prenom?:string, nom?:string, email?:string}>} participants
 * @param {{nbGagnants?:number, nbSuppleants?:number, lotLabel?:string}} config
 */
function computeDraw(seed, participants, config = {}) {
  const nbGagnants = config.nbGagnants ?? 5;
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
    // tri par empreinte croissante ; en cas d'egalite (quasi impossible), on
    // departage par le code pour rester deterministe.
    .sort((a, b) =>
      a.empreinte < b.empreinte ? -1
        : a.empreinte > b.empreinte ? 1
        : a.code < b.code ? -1 : 1
    )
    .map((p, i) => ({ rang: i + 1, ...p }));

  let i = 0;
  const gagnants = classement.slice(i, (i += nbGagnants)).map((p) => ({ ...p, lot: lotLabel }));
  const suppleants = classement.slice(i, (i += nbSuppleants)).map((p, k) => ({ ...p, lot: `Suppleant #${k + 1}` }));

  return {
    seed,
    algorithme: 'tri par SHA-256(seed | code), ordre croissant',
    genere_le: new Date().toISOString(),
    nb_participants: participants.length,
    config: { nbGagnants, nbSuppleants, lotLabel },
    gagnants,
    suppleants,
    classement, // classement complet pour audit
  };
}

module.exports = { computeDraw, sha256Hex, LOT_LABEL };
