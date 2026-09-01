'use strict';

let CFG = { prixTshirtCents: 2500, prixCasquetteCents: 1500, fraisEnvoiCents: 350, tailles: ['S', 'M', 'L', 'XL', 'XXL'], paiementDemo: false };
const $ = (id) => document.getElementById(id);
const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';

async function loadCfg() {
  try {
    const c = await (await fetch('/api/config')).json();
    CFG = { ...CFG, ...c };
  } catch (e) {}
  $('price-tag').textContent = eur(CFG.prixTshirtCents);
  $('frais-label').textContent = '+' + eur(CFG.fraisEnvoiCents);
  const pc = $('prix-casq'); if (pc) pc.textContent = eur(CFG.prixCasquetteCents);
  if (CFG.paiementDemo) $('demo-note').classList.remove('hidden');

  $('sizes').innerHTML = CFG.tailles
    .map((t) =>
      '<div class="size-row">' +
        '<div class="sz">' + t + '</div>' +
        '<div class="stepper">' +
          '<button type="button" data-t="' + t + '" data-d="-1">−</button>' +
          '<input type="text" inputmode="numeric" id="q-' + t + '" value="0" data-t="' + t + '" />' +
          '<button type="button" data-t="' + t + '" data-d="1">+</button>' +
        '</div>' +
      '</div>'
    )
    .join('');

  $('sizes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const inp = $('q-' + b.dataset.t);
    inp.value = Math.max(0, Math.min(20, (parseInt(inp.value, 10) || 0) + parseInt(b.dataset.d, 10)));
    recompute();
  });
  $('sizes').addEventListener('input', recompute);

  const step = (d) => { const i = $('q-casquette'); i.value = Math.max(0, Math.min(20, (parseInt(i.value, 10) || 0) + d)); recompute(); };
  $('casq-minus').addEventListener('click', () => step(-1));
  $('casq-plus').addEventListener('click', () => step(1));
  $('q-casquette').addEventListener('input', recompute);

  recompute();
}

function casqQty() {
  const el = $('q-casquette');
  return Math.max(0, Math.min(20, parseInt(el && el.value, 10) || 0));
}

function getItems() {
  return CFG.tailles.map((t) => ({ taille: t, qte: parseInt($('q-' + t).value, 10) || 0 })).filter((i) => i.qte > 0);
}

function livrMode() {
  return document.querySelector('input[name="livr"]:checked').value;
}

function recompute() {
  const items = getItems();
  const qteT = items.reduce((s, i) => s + i.qte, 0);
  const casq = casqQty();
  const articles = qteT * CFG.prixTshirtCents + casq * CFG.prixCasquetteCents;
  const frais = livrMode() === 'domicile' ? CFG.fraisEnvoiCents : 0;
  $('rl-articles').textContent = 'Articles (' + (qteT + casq) + ')';
  $('v-articles').textContent = eur(articles);
  $('v-frais').textContent = frais ? eur(frais) : 'Gratuit';
  $('v-total').textContent = eur(articles + frais);
}

function setLivr() {
  const mode = livrMode();
  $('rc-domicile').classList.toggle('sel', mode === 'domicile');
  $('rc-retrait').classList.toggle('sel', mode === 'retrait');
  $('addr-block').style.display = mode === 'domicile' ? 'block' : 'none';
  recompute();
}

function alertMsg(type, msg) {
  const a = $('alert'); a.className = 'alert show ' + (type === 'ok' ? 'ok' : 'err'); a.textContent = msg;
  a.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCfg();
  document.querySelectorAll('input[name="livr"]').forEach((r) => r.addEventListener('change', setLivr));

  $('pay-btn').addEventListener('click', async () => {
    const items = getItems();
    const casquettes = casqQty();
    if (!items.length) return alertMsg('err', 'Sélectionne au moins un t-shirt (obligatoire pour participer). La casquette est un bonus +1 chance.');
    if (!$('cgv').checked) return alertMsg('err', "Merci d'accepter le règlement.");

    const payload = {
      items,
      casquettes,
      prenom: $('prenom').value.trim(),
      nom: $('nom').value.trim(),
      email: $('email').value.trim(),
      telephone: $('telephone').value.trim(),
      livraison_mode: livrMode(),
      adresse: $('adresse').value.trim(),
      code_postal: $('cp').value.trim(),
      ville: $('ville').value.trim(),
    };

    $('pay-btn').disabled = true; $('pay-btn').textContent = 'Redirection vers le paiement…';
    try {
      const r = await fetch('/api/commande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.ok && d.checkoutUrl) { window.location = d.checkoutUrl; }
      else { alertMsg('err', d.error || 'Erreur lors de la création de la commande.'); }
    } catch (e) {
      alertMsg('err', 'Impossible de contacter le serveur.');
    } finally {
      $('pay-btn').disabled = false; $('pay-btn').textContent = 'Payer et participer 🎮';
    }
  });
});
