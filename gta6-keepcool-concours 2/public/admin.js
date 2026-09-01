'use strict';

let TOKEN = sessionStorage.getItem('admin_token') || '';
let ALL = [];
let CMDS = [];            // commandes en ligne
let SALLE_COUNT = 0;      // participations enregistrees en salle

const $ = (id) => document.getElementById(id);
const eurC = (c) => (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/, ' ') + ' €';

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
  // Actualisation automatique du tableau de bord (CA, ventes, jauge) toutes les 20 s.
  if (!window.__refreshTimer) window.__refreshTimer = setInterval(() => { refresh().catch(() => {}); }, 20000);
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
  SALLE_COUNT = salle;

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
    CMDS = cd.commandes || [];
    renderCommandes(CMDS);
  } catch (e) { CMDS = []; }

  renderKPIs();
}

// Calcule le chiffre d'affaires, les ventes et la progression vers le point mort.
function renderKPIs() {
  const paid = CMDS.filter((c) => c.statut === 'payee');
  let ca = 0, tOnline = 0, casq = 0;
  paid.forEach((c) => {
    ca += c.montant_total || 0;
    try {
      JSON.parse(c.items_json || '[]').forEach((it) => {
        if (it.type === 'casquette') casq += (it.qte || 0);
        else tOnline += (it.qte || 0);
      });
    } catch (e) {}
  });
  const attente = CMDS.filter((c) => c.statut === 'en_attente').length;
  const tTotal = tOnline + SALLE_COUNT; // en ligne + participations en salle

  $('k-ca').textContent = eurC(ca);
  $('k-tshirts').textContent = tTotal;
  $('k-casq').textContent = casq;
  $('k-attente').textContent = attente;

  const target = Math.max(1, parseInt($('pm-target').value, 10) || 166);
  const pct = Math.min(100, Math.round((tTotal / target) * 1000) / 10);
  const bar = $('pm-bar');
  bar.style.width = pct + '%';
  bar.textContent = pct >= 8 ? pct + ' %' : '';
  const reste = Math.max(0, target - tTotal);
  if (tTotal >= target) {
    $('pm-label').innerHTML = '🎉 <b style="color:#22e0e0">Point mort atteint !</b> ' + tTotal + ' t-shirts vendus. Chaque vente supplémentaire est désormais du bénéfice.';
  } else {
    $('pm-label').innerHTML = '<b>' + tTotal + '</b> / ' + target + ' t-shirts &nbsp;·&nbsp; encore <b style="color:#ff2e88">' + reste + '</b> pour rentabiliser (dont ' + tOnline + ' en ligne + ' + SALLE_COUNT + ' en salle).';
  }
}

function fmtItems(json) {
  let items = [];
  try { items = JSON.parse(json || '[]'); } catch (e) {}
  const parts = items.map((it) => (it.type === 'casquette')
    ? '🧢 Casquette ×' + (it.qte || 1)
    : escapeHtml(it.taille || '?') + ' ×' + (it.qte || 1));
  return parts.join(' · ') || '—';
}
function payOptions(sel) {
  return [['payee', 'Payée'], ['rembourse', 'Remboursé'], ['en_attente', 'En attente'], ['echouee', 'Échouée'], ['annulee', 'Annulée']]
    .map(([v, l]) => '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + l + '</option>').join('');
}
function livOptions(sel) {
  return [['en_attente_distribution', 'En attente de distribution'], ['distribue_club', 'Distribué en club'], ['expediee', 'Expédiée']]
    .map(([v, l]) => '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + l + '</option>').join('');
}

function renderCommandes(list) {
  const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
  const el = document.getElementById('cmd-rows');
  if (!list.length) { el.innerHTML = '<tr><td colspan="7" class="hint">Aucune commande.</td></tr>'; return; }
  const sst = 'padding:6px 8px;border-radius:8px;border:1px solid var(--card-border);background:rgba(0,0,0,.35);color:var(--text);font-size:.82rem';
  el.innerHTML = list.map((c) => `<tr>
    <td style="font-family:monospace">${escapeHtml(c.numero)}</td>
    <td>${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}<br><span class="hint" style="font-size:.78rem">${escapeHtml(c.email || '')}</span></td>
    <td>${fmtItems(c.items_json)}</td>
    <td>${eur(c.montant_total)}</td>
    <td><select class="st-pay" data-id="${c.id}" style="${sst}">${payOptions(c.statut)}</select></td>
    <td><select class="st-liv" data-id="${c.id}" style="${sst}">${livOptions(c.statut_livraison)}</select><br><span class="hint" style="font-size:.76rem">${c.livraison_mode === 'retrait' ? 'Retrait salle' : 'Domicile'}</span></td>
    <td>${escapeHtml(c.cree_le)}</td>
  </tr>`).join('');

  el.onchange = async (e) => {
    const s = e.target;
    if (!s.classList || (!s.classList.contains('st-pay') && !s.classList.contains('st-liv'))) return;
    const id = s.dataset.id;
    const tr = s.closest('tr');
    const statut = tr.querySelector('.st-pay').value;
    const statut_livraison = tr.querySelector('.st-liv').value;
    const al = document.getElementById('cmd-alert');
    s.disabled = true;
    try {
      const r = await api('/api/admin/commande/' + id + '/statut', { method: 'POST', body: JSON.stringify({ statut, statut_livraison }) });
      const d = await r.json();
      if (d.ok) { al.className = 'alert show ok'; al.textContent = 'Statut mis à jour ✅'; refresh(); }
      else { al.className = 'alert show err'; al.textContent = d.error || 'Erreur.'; }
    } catch (err) { al.className = 'alert show err'; al.textContent = 'Erreur réseau.'; }
    finally { s.disabled = false; }
  };
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

  $('vente-btn').addEventListener('click', async () => {
    const prenom = $('v-prenom').value.trim();
    const nom = $('v-nom').value.trim();
    const qte = Math.max(1, Math.min(20, parseInt($('v-qte').value, 10) || 1));
    const casq = Math.max(0, Math.min(20, parseInt($('v-casq').value, 10) || 0));
    const al = $('vente-alert');
    if (!prenom || !nom) { al.className = 'alert show err'; al.textContent = 'Prénom et nom obligatoires.'; return; }
    const payload = {
      prenom, nom, email: $('v-email').value.trim(),
      items: [{ taille: $('v-taille').value, qte }],
      casquettes: casq,
      livraison_mode: $('v-livr').value,
    };
    $('vente-btn').disabled = true; $('vente-btn').textContent = 'Enregistrement…';
    try {
      const r = await api('/api/admin/commande/importer', { method: 'POST', body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.ok) {
        al.className = 'alert show ok';
        al.innerHTML = 'Vente enregistrée ✅ — n° ' + escapeHtml(d.numero) + '. Code(s) : <b>' + (d.codes || []).join(', ') + '</b>';
        ['v-prenom', 'v-nom', 'v-email'].forEach((id) => ($(id).value = ''));
        $('v-qte').value = '1'; $('v-casq').value = '0';
        refresh();
      } else { al.className = 'alert show err'; al.textContent = d.error || 'Erreur.'; }
    } catch (e) { al.className = 'alert show err'; al.textContent = 'Erreur réseau.'; }
    finally { $('vente-btn').disabled = false; $('vente-btn').textContent = 'Enregistrer la vente payée'; }
  });

  const savedTarget = sessionStorage.getItem('pm_target');
  if (savedTarget) $('pm-target').value = savedTarget;
  $('pm-target').addEventListener('input', () => {
    sessionStorage.setItem('pm_target', $('pm-target').value);
    renderKPIs();
  });

  $('search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderRows(ALL.filter((p) => `${p.code} ${p.prenom} ${p.nom} ${p.email}`.toLowerCase().includes(q)));
  });

  if (TOKEN) doLogin(TOKEN);
});
