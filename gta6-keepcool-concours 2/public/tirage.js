'use strict';

let TOKEN = sessionStorage.getItem('admin_token') || '';
let LAST_RESULT = null;
const $ = (id) => document.getElementById(id);

function api(path, opts = {}) {
  return fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-token': TOKEN, ...(opts.headers || {}) } });
}

async function doLogin(token) {
  TOKEN = token;
  const r = await api('/api/admin/stats');
  if (r.status === 401) { const a = $('login-alert'); a.className = 'alert show err'; a.textContent = 'Mot de passe incorrect.'; TOKEN = ''; return; }
  sessionStorage.setItem('admin_token', TOKEN);
  const stats = await r.json();
  $('login-view').classList.add('hidden');
  $('stage-view').classList.remove('hidden');
  $('count-note').textContent = `${stats.total} participants enregistrés.`;
}

function winnerRow(p, lotClass, lotLabel) {
  return `<div class="winner-row">
    <div class="rank">${p.rang}</div>
    <div><div class="who">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</div><div class="meta">${p.code} · ${p.empreinte.slice(0, 16)}…</div></div>
    <div class="lot-badge ${lotClass}">${lotLabel}</div>
  </div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function animateReveal(result) {
  $('results').classList.remove('hidden');
  const stage = $('stage');
  const spin = ['🎰', '🎲', '🎮', '💿', '🕹️', '✨'];
  for (let i = 0; i < 18; i++) {
    stage.textContent = spin[i % spin.length] + '  MÉLANGE…  ' + spin[(i + 3) % spin.length];
    await sleep(70 + i * 6);
  }
  stage.textContent = '🎉 RÉSULTATS 🎉';

  await revealList($('gagnants-list'), result.gagnants, 'lot-ps5', 'PS5 + GTA VI');
  await revealList($('sup-list'), result.suppleants, 'lot-sup', 'Suppléant');

  $('proof-seed').textContent = result.seed;
  $('proof-n').textContent = result.nb_participants;
}

async function revealList(container, arr, cls, label) {
  container.innerHTML = '';
  for (const p of arr) {
    container.insertAdjacentHTML('beforeend', winnerRow(p, cls, label));
    await sleep(320);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.addEventListener('DOMContentLoaded', () => {
  $('login-btn').addEventListener('click', () => doLogin($('pw').value.trim()));
  $('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin($('pw').value.trim()); });

  $('draw-btn').addEventListener('click', async () => {
    const seed = $('seed').value.trim();
    const a = $('alert');
    if (seed.length < 4) { a.className = 'alert show err'; a.textContent = 'La graine doit contenir au moins 4 caractères.'; return; }
    if (!confirm('Confirmer le tirage avec cette graine ? Le résultat sera enregistré définitivement.')) return;

    $('draw-btn').disabled = true; $('draw-btn').textContent = 'Tirage en cours…';
    a.className = 'alert';
    try {
      const r = await api('/api/admin/tirage', { method: 'POST', body: JSON.stringify({ seed }) });
      const d = await r.json();
      if (!d.ok) { a.className = 'alert show err'; a.textContent = d.error || 'Erreur.'; return; }
      LAST_RESULT = d.resultat;
      await animateReveal(d.resultat);
    } catch (e) {
      a.className = 'alert show err'; a.textContent = 'Erreur réseau.';
    } finally {
      $('draw-btn').disabled = false; $('draw-btn').textContent = '🎲 Relancer (nouvelle graine)';
    }
  });

  $('dl-json').addEventListener('click', () => {
    if (!LAST_RESULT) return;
    const blob = new Blob([JSON.stringify(LAST_RESULT, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'proces-verbal-tirage-gta6.json'; a.click();
    URL.revokeObjectURL(url);
  });

  if (TOKEN) doLogin(TOKEN);
});
