'use strict';

/*
 * Envoi d'e-mails transactionnels + gabarit HTML stylise (look du site).
 * - Utilise SMTP si configure (voir .env).
 * - Sinon : "mode fichier" -> l'e-mail est ecrit dans data/emails/<numero>.html
 *   (pratique pour tester / previsualiser sans serveur SMTP).
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('./config');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const EMAIL_DIR = path.join(DATA_DIR, 'emails');
if (!fs.existsSync(EMAIL_DIR)) fs.mkdirSync(EMAIL_DIR, { recursive: true });

let transporter = null;
if (config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

const eur = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderOrderEmail(cmd) {
  const items = JSON.parse(cmd.items_json);
  const codes = cmd.codes_json ? JSON.parse(cmd.codes_json) : [];
  const logo = `${config.baseUrl}/assets/logo-mark.png`;

  const itemsRows = items
    .map((it) => {
      const casquette = it.type === 'casquette';
      const label = casquette
        ? 'Casquette Trucker GTA VI'
        : `T-shirt collector GTA VI — Taille <b>${esc(it.taille)}</b>`;
      const prixUnit = casquette ? config.prixCasquetteCents : config.prixTshirtCents;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2036;color:#f5eefb;font-size:15px">${label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2a2036;color:#b39fc9;text-align:center">× ${it.qte}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2a2036;color:#f5eefb;text-align:right">${eur(it.qte * prixUnit)}</td>
      </tr>`;
    })
    .join('');

  const livraison =
    cmd.livraison_mode === 'retrait'
      ? `Retrait à la salle — Keep Cool Narbonne, 44 rue Demoge, 11100 Narbonne`
      : `Livraison à domicile<br>${esc(cmd.adresse)}, ${esc(cmd.code_postal)} ${esc(cmd.ville)}`;

  const codesHtml = codes.length
    ? codes
        .map((c) => `<span style="display:inline-block;font-family:'Courier New',monospace;font-weight:bold;font-size:16px;color:#22e0e0;background:#0a0410;border:1px solid #ff2e88;border-radius:8px;padding:8px 14px;margin:4px 6px 4px 0;letter-spacing:1px">${esc(c)}</span>`)
        .join('')
    : '';

  const subject = `Commande ${cmd.numero} confirmée — ton t-shirt GTA VI & ta participation 🎮`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0616;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0616;padding:24px 0">
   <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#150a26;border:1px solid #2a2036;border-radius:18px;overflow:hidden">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#7b2ff7,#ff2e88 55%,#ff8a3d);padding:26px 30px" align="center">
        <img src="${logo}" alt="Social Sports Club" width="70" style="display:block;margin:0 auto 8px;filter:drop-shadow(0 0 8px rgba(0,0,0,.4))">
        <div style="font-family:Arial Black,Arial,sans-serif;font-size:24px;font-weight:900;color:#fff;letter-spacing:1px;text-transform:uppercase">Commande confirmée</div>
      </td></tr>

      <!-- Intro -->
      <tr><td style="padding:28px 30px 8px">
        <p style="margin:0 0 6px;color:#f5eefb;font-family:Arial,sans-serif;font-size:16px">Salut ${esc(cmd.prenom)},</p>
        <p style="margin:0;color:#b39fc9;font-family:Arial,sans-serif;font-size:15px;line-height:1.5">Merci pour ton achat du t-shirt collector <b style="color:#fff">GTA VI × Keep Cool Narbonne</b> ! Ta commande est bien enregistrée et payée.</p>
      </td></tr>

      <!-- Numero de commande -->
      <tr><td style="padding:14px 30px">
        <table role="presentation" width="100%" style="background:#0a0410;border:1px solid #2a2036;border-radius:12px"><tr>
          <td style="padding:16px 20px">
            <div style="color:#b39fc9;font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:2px">Numéro de commande</div>
            <div style="color:#ff2e88;font-family:Arial Black,Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:1px">${esc(cmd.numero)}</div>
          </td>
        </tr></table>
      </td></tr>

      <!-- Recap articles -->
      <tr><td style="padding:10px 30px">
        <div style="color:#22e0e0;font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Récapitulatif</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemsRows}
          <tr>
            <td style="padding:10px 0;color:#b39fc9;font-family:Arial,sans-serif" colspan="2">Frais d'envoi</td>
            <td style="padding:10px 0;color:#f5eefb;text-align:right;font-family:Arial,sans-serif">${cmd.frais_envoi ? eur(cmd.frais_envoi) : 'Gratuit'}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;color:#fff;font-family:Arial Black,Arial,sans-serif;font-size:18px;font-weight:900" colspan="2">TOTAL</td>
            <td style="padding:12px 0 0;color:#ffd23f;text-align:right;font-family:Arial Black,Arial,sans-serif;font-size:18px;font-weight:900">${eur(cmd.montant_total)}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Livraison -->
      <tr><td style="padding:18px 30px 6px">
        <div style="color:#22e0e0;font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Livraison</div>
        <p style="margin:0;color:#f5eefb;font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${livraison}</p>
      </td></tr>

      <!-- Participation au jeu -->
      <tr><td style="padding:16px 30px">
        <table role="presentation" width="100%" style="background:linear-gradient(135deg,rgba(255,46,136,.18),rgba(123,47,247,.16));border:1px solid #ff2e88;border-radius:14px"><tr>
          <td style="padding:20px 22px">
            <div style="font-family:Arial Black,Arial,sans-serif;font-size:18px;font-weight:900;color:#fff;text-transform:uppercase;margin-bottom:6px">🎮 Tu participes au jeu !</div>
            <p style="margin:0 0 10px;color:#f5eefb;font-family:Arial,sans-serif;font-size:15px;line-height:1.5">
              ${codes.length > 1 ? `Tes <b>${codes.length}</b> t-shirts te donnent <b>${codes.length} chances</b>` : `Ton t-shirt te donne <b>une chance</b>`}
              de remporter l'un des <b>${config.nbGagnants} lots PlayStation 5 + jeu GTA VI</b>.
            </p>
            <div style="margin:6px 0 10px">${codesHtml}</div>
            <p style="margin:0;color:#b39fc9;font-family:Arial,sans-serif;font-size:13px;line-height:1.5">
              Conserve ${codes.length > 1 ? 'ces codes' : 'ce code'} : ${codes.length > 1 ? 'ils sont' : 'il est'} déjà enregistré${codes.length > 1 ? 's' : ''} pour le tirage.
              Tirage au sort le <b style="color:#fff">${esc(config.dateTirage)}</b>, transparent et vérifiable sur
              <a href="${config.baseUrl}/verificateur.html" style="color:#22e0e0">notre site</a>.
            </p>
          </td>
        </tr></table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:22px 30px;border-top:1px solid #2a2036">
        <p style="margin:0 0 6px;color:#8f7da8;font-family:Arial,sans-serif;font-size:12px;line-height:1.5">
          Keep Cool Narbonne — SARL LIMA, 44 rue Demoge, 11100 Narbonne · SIRET 520 349 275 00021 · narbonne@keepcool.fr · 04 58 49 11 06
        </p>
        <p style="margin:0;color:#6f5f88;font-family:Arial,sans-serif;font-size:11px;line-height:1.5">
          Opération sans lien avec Rockstar Games, Take-Two Interactive ou Sony Interactive Entertainment. « GTA », « Grand Theft Auto » et « PlayStation » sont des marques de leurs titulaires respectifs. Voir le <a href="${config.baseUrl}/reglement.html" style="color:#b39fc9">règlement</a>.
        </p>
      </td></tr>

    </table>
   </td></tr>
  </table>
</body></html>`;

  const text = `Commande ${cmd.numero} confirmee.\nMerci ${cmd.prenom} !\nTotal : ${eur(cmd.montant_total)} (dont frais d'envoi ${eur(cmd.frais_envoi)}).\nParticipation au jeu — code(s) : ${codes.join(', ')}.\nTirage le ${config.dateTirage}. Reglement : ${config.baseUrl}/reglement.html`;

  return { subject, html, text };
}

async function sendOrderEmail(cmd) {
  const { subject, html, text } = renderOrderEmail(cmd);
  // Sauvegarde systematique d'une copie previsualisable
  try { fs.writeFileSync(path.join(EMAIL_DIR, `${cmd.numero}.html`), html); } catch (e) {}

  if (!transporter) {
    console.log(`  ✉️  [MODE FICHIER] E-mail de la commande ${cmd.numero} ecrit dans data/emails/${cmd.numero}.html (SMTP non configure).`);
    return { delivered: false, preview: `data/emails/${cmd.numero}.html` };
  }
  await transporter.sendMail({
    from: config.mailFrom,
    to: cmd.email,
    bcc: config.mailBcc || undefined,
    subject,
    html,
    text,
  });
  console.log(`  ✉️  E-mail de confirmation envoye a ${cmd.email} (commande ${cmd.numero}).`);
  return { delivered: true };
}

module.exports = { renderOrderEmail, sendOrderEmail };
