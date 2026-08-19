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
