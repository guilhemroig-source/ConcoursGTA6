'use strict';

let TOKEN = sessionStorage.getItem('admin_token') || '';
let LAST_RESULT = null;
const $ = (id) => document.getElementById(id);
function lockDraw(){var b=$('draw-btn'); if(b){b.disabled=true; b.style.display='none';} var sd=$('seed'); if(sd) sd.disabled=true; var al=$('alert'); if(al){al.className='alert show'; al.textContent='✅ Tirage effectué — résultat enregistré. Il est définitif.';}}

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

let FX_CV=null, FX_CX=null, FX_PARTS=[];
function fxEnsure(){
  if(FX_CV) return;
  const st=document.createElement('style');
  st.textContent='@keyframes tgPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}'
    +'.tg-rank{font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:#00e5ff;text-align:center;font-size:14px;margin-bottom:6px}'
    +'.tg-reel{font-family:Anton,Oswald,sans-serif;font-weight:800;letter-spacing:.06em;font-size:clamp(28px,7vw,60px);color:#fff;text-shadow:0 0 24px rgba(0,229,255,.6);text-align:center}'
    +'.tg-reel.lock{color:#ffd23f;text-shadow:0 0 34px rgba(255,210,63,.85)}'
    +'.tg-name{font-family:Anton,sans-serif;text-transform:uppercase;font-size:clamp(22px,6vw,48px);text-align:center;margin-top:8px;color:transparent;background:linear-gradient(90deg,#ff2e97,#ffd23f);-webkit-background-clip:text;background-clip:text;opacity:0;transition:opacity .5s,transform .5s;transform:translateY(12px)}'
    +'.tg-name.show{opacity:1;transform:none}'
    +'.tg-lot{text-align:center;color:#e9c9ff;letter-spacing:.14em;text-transform:uppercase;font-size:12px;margin-top:4px;opacity:0;transition:opacity .5s}'
    +'.tg-lot.show{opacity:1}';
  document.head.appendChild(st);
  const c=document.createElement('canvas'); c.id='tg-fx';
  c.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:none';
  document.body.appendChild(c); FX_CV=c; FX_CX=c.getContext('2d');
  const rz=()=>{c.width=innerWidth;c.height=innerHeight}; rz(); addEventListener('resize',rz);
  (function loop(){ FX_CX.clearRect(0,0,c.width,c.height); FX_PARTS=FX_PARTS.filter(p=>p.life>0);
    for(const p of FX_PARTS){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life--;
      FX_CX.save();FX_CX.translate(p.x,p.y);FX_CX.rotate(p.rot);FX_CX.globalAlpha=Math.max(0,p.life/120);FX_CX.fillStyle=p.c;
      FX_CX.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6);FX_CX.restore();}
    requestAnimationFrame(loop); })();
}
function fxBurst(n,x,y){ const COL=['#ff2e97','#00e5ff','#ffd23f','#7b2ff7','#ffffff'];
  x=(x==null)?innerWidth/2:x; y=(y==null)?innerHeight*0.4:y;
  for(let i=0;i<n;i++){FX_PARTS.push({x:x,y:y,vx:(Math.random()-.5)*10,vy:(Math.random()-1.1)*11,g:.28+Math.random()*.15,s:5+Math.random()*7,c:COL[Math.random()*COL.length|0],rot:Math.random()*6,vr:(Math.random()-.5)*.4,life:90+Math.random()*40});}
}
function rndCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const b=(n)=>Array.from({length:n},()=>a[Math.random()*a.length|0]).join(''); return 'GTA6-'+b(4)+'-'+b(4);}
async function revealWinner(stage, idx, total, p){
  stage.innerHTML = `<div class='tg-rank'>Gagnant ${idx} / ${total}</div><div class='tg-reel' id='tg-reel' style='animation:tgPulse 1s infinite'>GTA6-••••-••••</div><div class='tg-name' id='tg-name'>—</div><div class='tg-lot' id='tg-lot'>PlayStation 5 + jeu GTA VI</div>`;
  const reel=document.getElementById('tg-reel'), nm=document.getElementById('tg-name'), lt=document.getElementById('tg-lot');
  const dur=1600+idx*250, t0=performance.now();
  await new Promise((res)=>{(function tick(){const pr=(performance.now()-t0)/dur; if(pr>=1){res();return;} reel.textContent=(pr<0.75||Math.random()>pr)?rndCode():p.code; setTimeout(tick,40+pr*pr*160);})();});
  reel.textContent=p.code; reel.style.animation=''; reel.classList.add('lock'); fxBurst(80);
  await sleep(250);
  nm.textContent=((p.prenom||'')+' '+(p.nom||'')).trim(); nm.classList.add('show'); lt.classList.add('show');
  await sleep(1500);
}
async function fancyReveal(result){
  fxEnsure(); $('results').classList.remove('hidden');
  const stage=$('stage'); stage.textContent='';
  const g=result.gagnants||[];
  for(let i=0;i<g.length;i++){ await revealWinner(stage, i+1, g.length, g[i]); }
  stage.innerHTML = `<div class='tg-rank' style='color:#ffd23f'>🎉 Les ${g.length} gagnants 🎉</div>`;
  await revealList($('gagnants-list'), result.gagnants, 'lot-ps5', 'PS5 + GTA VI');
  await revealList($('sup-list'), result.suppleants, 'lot-sup', 'Suppléant');
  fxBurst(140, innerWidth*0.3, innerHeight*0.35); fxBurst(140, innerWidth*0.7, innerHeight*0.35);
  $('proof-seed').textContent=result.seed; $('proof-n').textContent=result.nb_participants;
}
async function plainReveal(result){
  $('results').classList.remove('hidden');
  const stage=$('stage'); const spin=['🎰','🎲','🎮','💿','🕹️','✨'];
  for(let i=0;i<18;i++){ stage.textContent=spin[i%spin.length]+' MÉLANGE… '+spin[(i+3)%spin.length]; await sleep(70+i*6); }
  stage.textContent='🎉 RÉSULTATS 🎉';
  await revealList($('gagnants-list'), result.gagnants, 'lot-ps5', 'PS5 + GTA VI');
  await revealList($('sup-list'), result.suppleants, 'lot-sup', 'Suppléant');
  $('proof-seed').textContent=result.seed; $('proof-n').textContent=result.nb_participants;
}
async function animateReveal(result){
  try { await fancyReveal(result); }
  catch(e){ console.error('anim', e); try{ await plainReveal(result); }catch(_){} }
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
      if (!d.ok) { a.className = 'alert show err'; a.textContent = d.error || 'Erreur.'; $('draw-btn').disabled=false; $('draw-btn').textContent='🎲 Lancer le tirage'; return; }
      LAST_RESULT = d.resultat; lockDraw();
      await animateReveal(d.resultat);
    } catch (e) {
      a.className = 'alert show err'; a.textContent = 'Erreur réseau.'; $('draw-btn').disabled=false; $('draw-btn').textContent='🎲 Lancer le tirage';
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
