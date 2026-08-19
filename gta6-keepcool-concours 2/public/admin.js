'use strict';

let TOKEN = sessionStorage.getItem('admin_token') || '';
let ALL = [];

const $ = (id) => document.getElementById(id);

function api(path, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': TOKEN, ...(opts.headers || {}) },
  });
}

function showLoginAlert(msg) {
  const a = $('login-alert'); a.className = 'alert show err'; a.textContent = msg;
}

async function doLogin(token) {
  TOKEN = token;
  const r = await api('/api/admin/stats');
  if (r.status === 401) { showLoginAlert('Mot de passe incorrect.'); TOKEN = ''; return; }
  sessionStorage.setItem('admin_token', TOKEN);
  $('login-view').classList.add('hidden');
  $('dash').classList.remove('hidden');
  $('logout').classList.remove('hidden');
  await refresh();
}

async function refresh() {
  const stats = await (await api('/api/admin/stats')).json();
  $('s-total').textContent = stats.total;
  const ligne = (stats.parSource.find((s) => s.source === 'en_ligne') || {}).n || 0;
  const salle = (stats.parSource.find((s) => s.source === 'en_salle') || {}).n || 0;
  const dispo = (stats.codes.find((c) => c.statut === 'disponible') || {}).n || 0;
  $('s-ligne').textContent = ligne;
  $('s-salle').textContent = salle;
  $('s-codes').textContent = dispo;

  const tl = $('tirages-list');
  if (stats.tirages && stats.tirages.length) {
    tl.innerHTML = stats.tirages
      .map((t) => `#${t.id} · graine « ${t.seed} » · ${t.nb_participants} part. · ${t.cree_le}`)
      .join('<br>');
  } else {
    tl.textContent = 'Aucun tirage pour l\'instant.';
  }

  const data = await (await api('/api/admin/participants')).json();
  ALL = data.participants || [];
  renderRows(ALL);

  try {
    const cd = await (await api('/api/admin/commandes')).json();
    renderCommandes(cd.commandes || []);
  } catch (e) {}
}

function renderCommandes(list) {
  const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
  const badge = { payee: 'en_ligne', en_attente: 'en_salle', echouee: 'en_salle', expediee: 'en_ligne' };
  const el = document.getElementById('cmd-rows');
  if (!list.length) { el.innerHTML = '<tr><td colspan="8" class="hint">Aucune commande.</td></tr>'; return; }
  el.innerHTML = list.map((c) => `<tr>
    <td style="font-family:monospace">${escapeHtml(c.numero)}</td>
    <td>${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}</td>
    <td>${escapeHtml(c.email)}</td>
    <td>${c.quantite}</td>
    <td>${eur(c.montant_total)}</td>
    <td>${c.livraison_mode === 'retrait' ? 'Retrait' : 'Domicile'}</td>
    <td><span class="tag ${c.statut === 'payee' ? 'en_ligne' : 'en_salle'}">${escapeHtml(c.statut)}</span></td>
    <td>${escapeHtml(c.cree_le)}</td>
  </tr>`).join('');
}

function renderRows(list) {
  $('rows').innerHTML = list
    .map(
      (p) => `<tr>
        <td>${p.id}</td>
        <td style="font-family:monospace">${p.code}</td>
        <td>${escapeHtml(p.prenom)}</td>
        <td>${escapeHtml(p.nom)}</td>
        <td>${escapeHtml(p.email || '')}</td>
        <td>${escapeHtml(p.telephone || '')}</td>
        <td><span class="tag ${p.source}">${p.source === 'en_ligne' ? 'En ligne' : 'En salle'}</span></td>
        <td>${p.cree_le}</td>
      </tr>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  $('login-btn').addEventListener('click', () => doLogin($('pw').value.trim()));
  $('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin($('pw').value.trim()); });

  $('logout').addEventListener('click', (e) => {
    e.preventDefault(); sessionStorage.removeItem('admin_token'); location.reload();
  });

  $('add-btn').addEventListener('click', async () => {
    const body = {
      code: $('a-code').value.trim().toUpperCase(),
      prenom: $('a-prenom').value.trim(),
      nom: $('a-nom').value.trim(),
      email: $('a-email').value.trim(),
      telephone: $('a-tel').value.trim(),
    };
    const al = $('salle-alert');
    if (!body.code || !body.prenom || !body.nom) {
      al.className = 'alert show err'; al.textContent = 'Code, prénom et nom obligatoires.'; return;
    }
    const r = await api('/api/admin/inscription-salle', { method: 'POST', body: JSON.stringify(body) });
    const d = await r.json();
    if (d.ok) {
      al.className = 'alert show ok'; al.textContent = 'Participation enregistrée ✅';
      ['a-code', 'a-prenom', 'a-nom', 'a-email', 'a-tel'].forEach((id) => ($(id).value = ''));
      refresh();
    } else {
      al.className = 'alert show err'; al.textContent = d.error || 'Erreur.';
    }
  });

  $('export-btn').addEventListener('click', () => {
    window.location = '/api/admin/export.csv?token=' + encodeURIComponent(TOKEN);
  });

  $('dl-codes-btn').addEventListener('click', () => {
    window.location = '/api/admin/codes.csv?token=' + encodeURIComponent(TOKEN);
  });

  $('gen-btn').addEventListener('click', async () => {
    const nb = parseInt($('gen-nb').value, 10) || 0;
    const al = $('gen-alert');
    if (nb < 1) { al.className = 'alert show err'; al.textContent = 'Indiquez un nombre valide.'; return; }
    $('gen-btn').disabled = true; $('gen-btn').textContent = 'Génération…';
    try {
      const r = await api('/api/admin/generer-codes', { method: 'POST', body: JSON.stringify({ nombre: nb }) });
      const d = await r.json();
      if (d.ok) {
        al.className = 'alert show ok';
        al.textContent = `${d.generes} codes générés ✅ Clique sur « Codes disponibles (CSV) » pour les imprimer.`;
        refresh();
      } else { al.className = 'alert show err'; al.textContent = d.error || 'Erreur.'; }
    } catch (e) { al.className = 'alert show err'; al.textContent = 'Erreur réseau.'; }
    finally { $('gen-btn').disabled = false; $('gen-btn').textContent = 'Générer'; }
  });

  $('search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderRows(ALL.filter((p) => `${p.code} ${p.prenom} ${p.nom} ${p.email}`.toLowerCase().includes(q)));
  });

  if (TOKEN) doLogin(TOKEN);
});
