'use strict';

// Charge la config publique et remplit la page
async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const c = await r.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('d-debut', c.dateDebut);
    set('d-fin', c.dateFin);
    set('d-tirage', c.dateTirage);
    set('n-ps5', c.nbPS5);
    set('n-gta6', c.nbGTA6);
    set('n-ps5b', c.nbPS5);
    set('n-gta6b', c.nbGTA6);
    set('n-gag', c.nbGagnants);
    set('n-gag2', c.nbGagnants);
    set('prix-t', c.prixTshirt);
    set('orga-inline', c.organisateur);
    set('orga-foot', c.organisateur);
    document.querySelectorAll('.d-tirage2').forEach((e) => (e.textContent = c.dateTirage));
    if (!c.inscriptionsOuvertes) {
      document.getElementById('closed-note').classList.remove('hidden');
      document.getElementById('form').classList.add('hidden');
    }
  } catch (e) { /* silencieux */ }
}

function showAlert(type, msg) {
  const a = document.getElementById('alert');
  a.className = 'alert show ' + (type === 'ok' ? 'ok' : 'err');
  a.textContent = msg;
  a.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();

  const form = document.getElementById('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit');

    const payload = {
      code: document.getElementById('code').value.trim().toUpperCase(),
      prenom: document.getElementById('prenom').value.trim(),
      nom: document.getElementById('nom').value.trim(),
      email: document.getElementById('email').value.trim(),
      telephone: document.getElementById('telephone').value.trim(),
      majeur_ok: document.getElementById('majeur').checked,
      reglement_ok: document.getElementById('reglement').checked,
      rgpd_ok: document.getElementById('rgpd').checked,
    };

    if (!payload.majeur_ok || !payload.reglement_ok || !payload.rgpd_ok) {
      return showAlert('err', 'Merci de cocher les trois cases (majorité, règlement et RGPD).');
    }

    btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const r = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (data.ok) {
        form.classList.add('hidden');
        document.getElementById('alert').className = 'alert';
        document.getElementById('success').classList.remove('hidden');
        document.getElementById('success').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showAlert('err', data.error || 'Une erreur est survenue.');
      }
    } catch (err) {
      showAlert('err', 'Impossible de contacter le serveur. Réessaie dans un instant.');
    } finally {
      btn.disabled = false; btn.textContent = 'Valider ma participation 🎮';
    }
  });
});

/* --------- Pop-up de sortie (retenir le visiteur + pousser a l'achat) --------- */
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
        '<div style="font-size:2.2rem">🎮</div>' +
        '<h2>Attends… ta <span>PS5</span> t\'attend&nbsp;!</h2>' +
        '<p>1 T-shirt collector = <b>1 chance</b> de gagner une <b>PlayStation 5 + GTA VI</b>.<br>À partir de 25€, retrait gratuit en salle.</p>' +
        '<a class="cta" href="boutique.html">Je tente ma chance →</a>' +
        '<button class="no" type="button">Non merci, une autre fois</button>' +
      '</div>';
    document.body.appendChild(wrap);

    function close() { wrap.classList.remove('on'); setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 260); }
    wrap.querySelector('.x').addEventListener('click', close);
    wrap.querySelector('.no').addEventListener('click', close);
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
  setTimeout(trigger, 35000);
})();
