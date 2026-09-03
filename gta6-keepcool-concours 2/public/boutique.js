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

/* --------- Pop-up de sortie boutique (retenir + finaliser la commande) --------- */
(function () {
  var KEY = 'kc_exit_popup_v1';
  function shown() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function mark() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }

  function build() {
    if (document.getElementById('kc-exit')) return;
    var css = document.createElement('style');
    css.textContent =
      '#kc-exit{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(6,6,14,.82);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s ease}' +
      '#kc-exit.on{opacity:1}' +
      '#kc-exit .box{position:relative;max-width:440px;width:100%;background:linear-gradient(160deg,#171332,#241243);border:1px solid rgba(255,46,136,.55);border-radius:20px;padding:32px 26px 24px;box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 40px rgba(255,46,136,.22);text-align:center;transform:translateY(14px) scale(.98);transition:transform .25s ease}' +
      '#kc-exit.on .box{transform:none}' +
      '#kc-exit .x{position:absolute;top:10px;right:14px;background:none;border:none;color:#9a9ab5;font-size:26px;line-height:1;cursor:pointer}' +
      '#kc-exit h2{margin:6px 0 8px;font-size:1.5rem;color:#fff;font-weight:800;line-height:1.25}' +
      '#kc-exit h2 span{color:#22e0e0}' +
      '#kc-exit p{margin:0 0 18px;color:#cfd0e6;font-size:1rem;line-height:1.5}' +
      '#kc-exit p b{color:#ff2e88}' +
      '#kc-exit .cta{display:block;width:100%;padding:15px 18px;border:none;border-radius:12px;font-size:1.08rem;font-weight:800;color:#0a0a14;cursor:pointer;text-decoration:none;background:linear-gradient(90deg,#22e0e0,#ff2e88);box-shadow:0 10px 26px rgba(255,46,136,.35)}' +
      '#kc-exit .cta:hover{filter:brightness(1.06)}' +
      '#kc-exit .no{display:inline-block;margin-top:12px;background:none;border:none;color:#8a8fa3;font-size:.85rem;cursor:pointer;text-decoration:underline}';
    document.head.appendChild(css);

    var wrap = document.createElement('div');
    wrap.id = 'kc-exit';
    wrap.innerHTML =
      '<div class="box" role="dialog" aria-modal="true">' +
        '<button class="x" aria-label="Fermer">&times;</button>' +
        '<div style="font-size:2.2rem">🔥</div>' +
        '<h2>Si près de gagner une <span>PS5</span>&nbsp;!</h2>' +
        '<p>Ta participation au tirage <b>PS5 + GTA VI</b> est à quelques clics.<br>1 T-shirt = <b>1 chance</b> de gagner. Ne la laisse pas passer&nbsp;!</p>' +
        '<button class="cta" type="button">Finaliser ma commande →</button>' +
        '<button class="no" type="button">Non merci, une autre fois</button>' +
      '</div>';
    document.body.appendChild(wrap);

    function close() { wrap.classList.remove('on'); setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 260); }
    function goForm() {
      close();
      var t = document.getElementById('pay-btn') || document.getElementById('sizes');
      if (t) { try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { t.scrollIntoView(); } }
    }
    wrap.querySelector('.x').addEventListener('click', close);
    wrap.querySelector('.no').addEventListener('click', close);
    wrap.querySelector('.cta').addEventListener('click', goForm);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    requestAnimationFrame(function () { wrap.classList.add('on'); });
  }

  function trigger() { if (shown()) return; mark(); build(); }

  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget && e.clientY <= 0) trigger();
  });
  try {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', function () {
      if (!shown()) { history.pushState(null, '', location.href); trigger(); }
    });
  } catch (e) {}
  setTimeout(trigger, 40000);
})();

/* --------- Conversion boutique : retrait par defaut + urgence/preuve sociale --------- */
(function () {
  // 1) Retrait en salle par defaut : supprime les champs d'adresse (moins de friction)
  function initRetrait() {
    var rr = document.querySelector('input[name="livr"][value="retrait"]');
    if (rr) { rr.checked = true; try { setLivr(); } catch (e) {} }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRetrait);
  else initRetrait();

  // 2) Bandeau urgence + preuve sociale, injecte en haut de la boutique
  function parseDate(s) {
    if (!s) return null;
    var m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], 23, 59, 59);
    var d = new Date(s); return isNaN(d.getTime()) ? null : d;
  }
  function deadlineText(dt) {
    if (!dt) return '';
    var ms = dt.getTime() - Date.now();
    if (ms <= 0) return '';
    var j = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
    if (j > 0) return 'Fin dans ' + j + 'j ' + h + 'h';
    var mn = Math.floor((ms % 3600000) / 60000);
    return 'Fin dans ' + h + 'h ' + mn + 'min';
  }
  function inject(count, dl) {
    if (document.getElementById('kc-urgency')) return;
    var css = document.createElement('style');
    css.textContent =
      '#kc-urgency{margin:0 0 16px;padding:12px 16px;border-radius:12px;background:linear-gradient(90deg,rgba(34,224,224,.12),rgba(255,46,136,.14));border:1px solid rgba(255,46,136,.35);color:#eef0ff;font-size:.92rem;font-weight:600;line-height:1.4;text-align:center}' +
      '#kc-urgency .u{color:#ff2e88;font-weight:800}' +
      '#kc-urgency b{color:#22e0e0}';
    document.head.appendChild(css);
    var parts = [];
    if (count >= 25) parts.push('<span class="u">🔥 Déjà ' + count + ' participants</span>');
    else parts.push('<span class="u">🎯 Sois parmi les premiers à tenter ta chance</span>');
    if (dl) parts.push('<span class="u">⏳ ' + dl + '</span>');
    parts.push('1 T-shirt = <b>1 chance</b> de gagner une <b>PS5 + GTA VI</b>');
    var div = document.createElement('div');
    div.id = 'kc-urgency';
    div.innerHTML = parts.join(' · ');
    var sizes = document.getElementById('sizes');
    var anchor = sizes ? (sizes.closest('fieldset') || sizes) : null;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(div, anchor);
    else document.body.insertBefore(div, document.body.firstChild);
  }
  Promise.all([
    fetch('/api/public/stats').then(function (r) { return r.json(); }).catch(function () { return { participants: 0 }; }),
    fetch('/api/config').then(function (r) { return r.json(); }).catch(function () { return {}; })
  ]).then(function (res) {
    var count = (res[0] && res[0].participants) || 0;
    var dl = deadlineText(parseDate((res[1] && (res[1].dateFin || res[1].dateTirage)) || ''));
    function go() { inject(count, dl); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  });
})();
