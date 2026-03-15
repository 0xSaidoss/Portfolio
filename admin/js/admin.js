/* ============================================================
   admin.js — Full CMS Admin Panel
   Views: dashboard, projects, posts, settings
   Block editor: text, heading, code, image, quote, list, alert, divider
   ============================================================ */
'use strict';

/* ── State ── */
let currentView = 'dashboard';
let editingDoc   = null;   // { kind: 'project'|'post', data: {} }
let pendingBlocks = [];    // draft blocks
let blockPickerCb = null;  // callback when a block type is chosen
let imgCb = null;          // callback when image is confirmed

/* ── Boot ── */
function waitForStore(cb) {
  if (typeof window.Store !== 'undefined' && typeof window.Store.onAuthReady === 'function') {
    cb();
  } else {
    setTimeout(() => waitForStore(cb), 50);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminCursor();
  waitForStore(() => {
    initLogin();
    initSidebar();
    // Attendre que Firebase Auth soit prêt
    Store.onAuthReady(user => {
      if (user) {
        showAdmin();
      } else {
        openModal('loginModal');
      }
    });
  });
});

/* ── Admin Cursor ── */
function initAdminCursor() {
  const dot  = document.getElementById('cursor');
  const ring = document.getElementById('cursorFollower');
  if (!dot || !ring) return;
  let mx=0,my=0,fx=0,fy=0;
  document.addEventListener('mousemove', e => {
    mx=e.clientX; my=e.clientY;
    dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`;
  }, {passive:true});
  (function animRing(){
    fx+=(mx-fx)*.1; fy+=(my-fy)*.1;
    ring.style.transform=`translate(${fx}px,${fy}px) translate(-50%,-50%)`;
    requestAnimationFrame(animRing);
  })();
  document.addEventListener('mousedown',()=>{dot.classList.add('active');ring.classList.add('active');});
  document.addEventListener('mouseup',  ()=>{dot.classList.remove('active');ring.classList.remove('active');});
  // Re-bind hover on dynamic content via event delegation
  document.addEventListener('mouseover', e => {
    if (e.target.closest('a,button,.snav-btn,.proj-card,.settings-card,.admin-table tr'))
      ring.classList.add('active');
    else
      ring.classList.remove('active');
  });
}

/* ── Login ── */
function initLogin() {
  const btn   = document.getElementById('loginBtn');
  const email = document.getElementById('loginEmail');
  const input = document.getElementById('loginInput');
  const err   = document.getElementById('loginError');

  const attempt = async () => {
    btn.textContent = '⟳ Connexion...'; btn.disabled = true;
    // Store.login(password) uses ADMIN_EMAIL from firebase-store.js
    // but we pass email too in case user changed it
    const ok = await Store.login(input.value, email?.value);
    btn.textContent = 'CONNEXION →'; btn.disabled = false;
    if (ok) {
      closeModal('loginModal');
      showAdmin();
      err.style.display = 'none';
    } else {
      err.style.display = 'block';
      input.value = '';
      input.focus();
    }
  };
  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', e => e.key === 'Enter' && attempt());
}

function showAdmin() {
  closeModal('loginModal');
  document.getElementById('adminShell').style.display = 'flex';
  renderView('dashboard');
}

/* ── Sidebar nav ── */
function initSidebar() {
  document.querySelectorAll('.snav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderView(btn.dataset.view);
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await Store.logout();
    location.reload();
  });
}

/* ════════════════════════════════════════════════════════════
   VIEWS
   ════════════════════════════════════════════════════════════ */
function renderView(view) {
  currentView = view;
  const main = document.getElementById('adminMain');
  switch (view) {
    case 'dashboard': viewDashboard().then(html => main.innerHTML = html); return;
    case 'projects':  viewProjects().then(html  => { main.innerHTML = html;  }); return;
    case 'posts':     viewPosts().then(html    => { main.innerHTML = html;  }); return;
    case 'settings':  main.innerHTML = viewSettings();  initSettingsEvents(); break;
    case 'arsenal':   viewArsenal().then(html   => { main.innerHTML = html; initArsenalEvents(); }); return;
    case 'comments':  viewComments().then(html  => { main.innerHTML = html; }); return;
  }
}

/* ── Dashboard ── */
async function viewDashboard() {
  const [projs, posts, visits] = await Promise.all([
    Store.getProjects(), Store.getPosts(), Store.getVisits()
  ]);
  const published = posts.filter(p=>p.published).length;
  const today  = new Date().toISOString().slice(0,10);
  const todayV = (visits.daily||{})[today] || 0;
  const uniqueV = (visits.unique||[]).length;
  const recent = [...projs.slice(0,3).map(p=>({...p,kind:'project'})), ...posts.slice(0,3).map(p=>({...p,kind:'post'}))].slice(0,5);

  // Build last 7 days chart data
  const last7 = [];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=d.toISOString().slice(0,10);
    last7.push({ label: d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}), val: (visits.daily||{})[key]||0 });
  }
  const maxV = Math.max(1, ...last7.map(d=>d.val));

  return `
  <div class="view-header">
    <div><p class="view-title">Dashboard</p><p class="view-subtitle">// Vue d'ensemble du contenu</p></div>
    <a href="/Portfolio/index.html" target="_blank" class="btn btn-ghost btn-sm">↗ Voir le site</a>
  </div>

  <p class="dash-recent-title" style="margin-bottom:.75rem">// Visites</p>
  <div class="dash-stats" style="margin-bottom:1.5rem">
    <div class="dash-stat dash-stat-cyan"><span class="ds-num">${visits.total||0}</span><span class="ds-lbl">Visites totales</span></div>
    <div class="dash-stat dash-stat-green"><span class="ds-num">${uniqueV}</span><span class="ds-lbl">Visiteurs uniques</span></div>
    <div class="dash-stat"><span class="ds-num">${todayV}</span><span class="ds-lbl">Aujourd'hui</span></div>
    <div class="dash-stat"><span class="ds-num">${Object.keys(visits.daily||{}).length}</span><span class="ds-lbl">Jours actifs</span></div>
  </div>

  <div class="visits-chart-wrap" style="margin-bottom:2rem">
    <p class="dash-recent-title" style="margin-bottom:.75rem">// 7 derniers jours</p>
    <div class="visits-chart">
      ${last7.map(d=>`
        <div class="vc-col">
          <div class="vc-bar-wrap">
            <div class="vc-bar" style="height:${Math.round((d.val/maxV)*100)}%" title="${d.val} visite${d.val!==1?'s':''}">
              ${d.val>0?`<span class="vc-val">${d.val}</span>`:''}
            </div>
          </div>
          <span class="vc-lbl">${d.label}</span>
        </div>`).join('')}
    </div>
  </div>

  <p class="dash-recent-title" style="margin-bottom:.75rem">// Contenu</p>
  <div class="dash-stats">
    <div class="dash-stat"><span class="ds-num">${projs.length}</span><span class="ds-lbl">Projets</span></div>
    <div class="dash-stat"><span class="ds-num">${posts.filter(p=>p.type==='article').length}</span><span class="ds-lbl">Articles</span></div>
    <div class="dash-stat"><span class="ds-num">${posts.filter(p=>p.type==='writeup').length}</span><span class="ds-lbl">Writeups</span></div>
    <div class="dash-stat"><span class="ds-num">${published}</span><span class="ds-lbl">Publiés</span></div>
  </div>
  <p class="dash-recent-title">// Contenu récent</p>
  <div class="tbl-wrap">
    <table class="admin-table">
      <thead><tr><th>Titre</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>
        ${recent.map(item => `
        <tr>
          <td class="td-title">${esc(item.title)}</td>
          <td><span class="badge badge-cyan">${item.kind==='project'?'Projet':item.type==='writeup'?'Writeup':'Article'}</span></td>
          <td>${fmtDate(item.updatedAt)}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-ghost" onclick="${item.kind==='project'?`openProjectEditor('${item.id}')`:`openPostEditor('${item.id}')`}">Éditer</button>
          </td>
        </tr>`).join('')}
        ${!recent.length ? '<tr><td colspan="4" style="text-align:center;color:var(--txt3)">// Aucun contenu</td></tr>' : ''}
      </tbody>
    </table>
  </div>`;
}

/* ── Projects View ── */
async function viewProjects() {
  const projs = await Store.getProjects();
  return `
  <div class="view-header">
    <div><p class="view-title">Projets</p><p class="view-subtitle">// ${projs.length} projet(s)</p></div>
    <button class="btn btn-green" onclick="openProjectEditor()">+ Nouveau projet</button>
  </div>
  <div class="tbl-wrap">
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Titre</th><th>Catégorie</th><th>Statut</th><th>Blocs</th><th>Actions</th></tr></thead>
      <tbody>
        ${projs.map(p=>`
        <tr>
          <td style="font-size:1.3rem">${p.coverEmoji||'⬡'}</td>
          <td class="td-title">${esc(p.title)}</td>
          <td><span class="badge badge-cyan">${esc(p.category||'')}</span></td>
          <td><span class="badge ${statusBadge(p.status)}">${statusLabel(p.status)}</span></td>
          <td style="color:var(--txt3)">${(p.content||[]).length}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-cyan" onclick="openProjectEditor('${p.id}')">Éditer</button>
            <button class="btn btn-sm btn-ghost" onclick="previewItem('project','${p.id}')">↗</button>
            <button class="btn btn-sm btn-red" onclick="deleteItem('project','${p.id}')">✕</button>
          </td>
        </tr>`).join('')}
        ${!projs.length ? `<tr><td colspan="6"><div class="empty-state"><p>// Aucun projet créé.</p><button class="btn btn-green" onclick="openProjectEditor()">+ Créer le premier</button></div></td></tr>` : ''}
      </tbody>
    </table>
  </div>`;
}

/* ── Posts View ── */
async function viewPosts() {
  const posts = await Store.getPosts();
  return `
  <div class="view-header">
    <div><p class="view-title">Articles & Writeups</p><p class="view-subtitle">// ${posts.length} publication(s)</p></div>
    <div style="display:flex;gap:.6rem">
      <button class="btn btn-cyan" onclick="openPostEditor(null,'article')">+ Article</button>
      <button class="btn btn-red"  onclick="openPostEditor(null,'writeup')">+ Writeup CTF</button>
    </div>
  </div>
  <div class="tbl-wrap">
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Titre</th><th>Type</th><th>Catégorie</th><th>Publié</th><th>Blocs</th><th>Actions</th></tr></thead>
      <tbody>
        ${posts.map(p=>`
        <tr>
          <td style="font-size:1.3rem">${p.coverEmoji||'📄'}</td>
          <td class="td-title">${esc(p.title)}</td>
          <td><span class="badge ${p.type==='writeup'?'badge-red':'badge-cyan'}">${p.type==='writeup'?'Writeup':'Article'}</span></td>
          <td style="color:var(--txt3)">${esc(p.category||'')}</td>
          <td>
            <button class="btn btn-sm ${p.published?'btn-green':'btn-ghost'}" onclick="togglePublish('${p.id}')">
              ${p.published ? '✓ Publié' : '○ Brouillon'}
            </button>
          </td>
          <td style="color:var(--txt3)">${(p.content||[]).length}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-cyan" onclick="openPostEditor('${p.id}')">Éditer</button>
            <button class="btn btn-sm btn-ghost" onclick="previewItem('post','${p.id}')">↗</button>
            <button class="btn btn-sm btn-red" onclick="deleteItem('post','${p.id}')">✕</button>
          </td>
        </tr>`).join('')}
        ${!posts.length ? `<tr><td colspan="7"><div class="empty-state"><p>// Aucune publication.</p></div></td></tr>` : ''}
      </tbody>
    </table>
  </div>`;
}

/* ── Settings View ── */
function viewSettings() {
  return `
  <div class="view-header">
    <div><p class="view-title">Paramètres</p></div>
  </div>
  <div class="settings-card">
    <h3>// Changer le mot de passe</h3>
    <div class="field" style="margin-bottom:.75rem">
      <label class="label">Nouveau mot de passe</label>
      <input id="newPass" class="input" type="password" placeholder="Nouveau mot de passe"/>
    </div>
    <div class="field" style="margin-bottom:1rem">
      <label class="label">Confirmer</label>
      <input id="confPass" class="input" type="password" placeholder="Confirmer le mot de passe"/>
    </div>
    <button class="btn btn-cyan" id="savePassBtn">Enregistrer</button>
    <div id="passMsg" style="font-family:var(--mono);font-size:.72rem;margin-top:.75rem"></div>
  </div>
  <div class="settings-card" style="margin-top:1.5rem;max-width:480px">
    <h3>// Export / Import</h3>
    <p style="font-family:var(--mono);font-size:.75rem;color:var(--txt3);margin-bottom:1rem">Exporte tout le contenu en JSON pour sauvegarde.</p>
    <div style="display:flex;gap:.75rem;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" id="exportBtn">↓ Exporter JSON</button>
      <label class="btn btn-ghost btn-sm" style="cursor:pointer">↑ Importer JSON<input type="file" id="importFile" accept=".json" style="display:none"/></label>
    </div>
    <div id="importMsg" style="font-family:var(--mono);font-size:.72rem;margin-top:.75rem"></div>
  </div>`;
}
function initSettingsEvents() {
  document.getElementById('savePassBtn')?.addEventListener('click', async () => {
    const n = document.getElementById('newPass').value;
    const c = document.getElementById('confPass').value;
    const msg = document.getElementById('passMsg');
    if (!n) { msg.style.color='var(--red)'; msg.textContent='// Saisir un mot de passe.'; return; }
    if (n !== c) { msg.style.color='var(--red)'; msg.textContent='// Les mots de passe ne correspondent pas.'; return; }
    await Store.setPassword(n);
    msg.style.color='var(--green)'; msg.textContent='// Mot de passe mis à jour.';
  });
  document.getElementById('exportBtn')?.addEventListener('click', async () => {
    const [projs, posts] = await Promise.all([Store.getProjects(), Store.getPosts()]);
    const data = { projects: projs, posts: posts, exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='portfolio-backup.json'; a.click();
  });
  document.getElementById('importFile')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.projects) localStorage.setItem('cmsv1_projects', JSON.stringify(d.projects));
        if (d.posts)    localStorage.setItem('cmsv1_posts',    JSON.stringify(d.posts));
        document.getElementById('importMsg').style.color = 'var(--green)';
        document.getElementById('importMsg').textContent = '// Importé avec succès.';
        renderView('dashboard');
      } catch { document.getElementById('importMsg').style.color='var(--red)'; document.getElementById('importMsg').textContent='// Fichier JSON invalide.'; }
    };
    reader.readAsText(file);
  });
}


/* ── Arsenal View ── */
async function viewArsenal() {
  const cats = await Store.getArsenal();
  return `
  <div class="view-header">
    <div><p class="view-title">Arsenal Technique</p><p class="view-subtitle">// Gérer les catégories de compétences</p></div>
    <button class="btn btn-cyan btn-sm" onclick="openArsenalEditor()">+ Nouvelle catégorie</button>
  </div>
  <div class="arsenal-list" id="arsenalList">
    ${cats.length ? cats.map(cat => `
    <div class="settings-card" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h3>${esc(cat.icon||'⬡')} ${esc(cat.name)}</h3>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-sm btn-cyan" onclick="openArsenalEditor('${cat.id}')">Éditer</button>
          <button class="btn btn-sm btn-red" onclick="deleteArsenalCat('${cat.id}')">✕</button>
        </div>
      </div>
      <div class="arsenal-admin-grid">
        ${(cat.skills||[]).map(s => `
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-family:var(--mono);font-size:.75rem;color:var(--txt2);flex:1">${esc(s.name)}</span>
            <div class="skill-bar" style="width:120px;height:4px"><div class="skill-fill" style="width:${s.pct}%;transition:none"></div></div>
            <span style="font-family:var(--mono);font-size:.7rem;color:var(--green);width:32px">${s.pct}%</span>
          </div>`).join('')}
      </div>
      ${cat.tags?.length ? `<div class="skill-tags" style="margin-top:.75rem">${cat.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`).join('') : '<div class="empty-state"><p>// Aucune catégorie. Crée la première !</p></div>'}
  </div>`;
}

let editingArsenal = null;
async function openArsenalEditor(id = null) {
  const arsenalCats = await Store.getArsenal();
  const existing = id ? arsenalCats.find(c => c.id === id) : null;
  editingArsenal = existing ? JSON.parse(JSON.stringify(existing)) : { id: Store.uid(), name:'', icon:'⬡', skills:[], tags:[] };
  document.getElementById('arsenalInner').innerHTML = renderArsenalEditor();
  openModal('arsenalModal');
}
function renderArsenalEditor() {
  const c = editingArsenal;
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
    <h2>// ${c.name||'Nouvelle catégorie'}</h2>
    <button class="btn btn-ghost btn-sm" onclick="closeModal('arsenalModal')">✕</button>
  </div>
  <div class="field" style="margin-bottom:.75rem">
    <label class="label">Icône (emoji)</label>
    <input id="arsCatIcon" class="input" value="${esc(c.icon||'⬡')}" placeholder="💀" style="max-width:80px"/>
  </div>
  <div class="field" style="margin-bottom:1rem">
    <label class="label">Nom de la catégorie</label>
    <input id="arsCatName" class="input" value="${esc(c.name||'')}" placeholder="Binary Exploitation"/>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
    <label class="label" style="margin:0">Compétences</label>
    <button class="btn btn-ghost btn-sm" onclick="addArsenalSkill()">+ Ajouter</button>
  </div>
  <div id="arsSkillsList" style="margin-bottom:1rem">
    ${c.skills.map((s,i) => `
    <div class="arsenal-item-row" data-idx="${i}">
      <input class="input" value="${esc(s.name)}" placeholder="Nom compétence" oninput="updateArsenalSkill(${i},'name',this.value)"/>
      <div style="display:flex;align-items:center;gap:.4rem">
        <input type="range" min="0" max="100" value="${s.pct}" class="ars-range" oninput="updateArsenalSkill(${i},'pct',+this.value);this.nextElementSibling.textContent=this.value+'%'" style="flex:1"/>
        <span style="font-family:var(--mono);font-size:.72rem;color:var(--green);width:36px">${s.pct}%</span>
      </div>
      <input type="number" class="input pct-input" min="0" max="100" value="${s.pct}" oninput="updateArsenalSkill(${i},'pct',+this.value)"/>
      <button class="btn btn-sm btn-red" onclick="removeArsenalSkill(${i})">✕</button>
    </div>`).join('')}
  </div>
  <div class="field" style="margin-bottom:1.5rem">
    <label class="label">Tags (séparés par virgule)</label>
    <input id="arsCatTags" class="input" value="${esc((c.tags||[]).join(', '))}" placeholder="Buffer Overflow, Heap..."/>
  </div>
  <div style="display:flex;gap:.75rem">
    <button class="btn btn-cyan" style="flex:1;justify-content:center" onclick="saveArsenal()">⬡ Enregistrer</button>
    <button class="btn btn-ghost" onclick="closeModal('arsenalModal')">Annuler</button>
  </div>`;
}
function addArsenalSkill() {
  editingArsenal.skills.push({ name:'', pct: 70 });
  document.getElementById('arsSkillsList').innerHTML = editingArsenal.skills.map((s,i) => `
    <div class="arsenal-item-row">
      <input class="input" value="${esc(s.name)}" placeholder="Nom compétence" oninput="updateArsenalSkill(${i},'name',this.value)"/>
      <div style="display:flex;align-items:center;gap:.4rem">
        <input type="range" min="0" max="100" value="${s.pct}" class="ars-range" oninput="updateArsenalSkill(${i},'pct',+this.value);this.nextElementSibling.textContent=this.value+'%'" style="flex:1"/>
        <span style="font-family:var(--mono);font-size:.72rem;color:var(--green);width:36px">${s.pct}%</span>
      </div>
      <input type="number" class="input pct-input" min="0" max="100" value="${s.pct}" oninput="updateArsenalSkill(${i},'pct',+this.value)"/>
      <button class="btn btn-sm btn-red" onclick="removeArsenalSkill(${i})">✕</button>
    </div>`).join('');
}
function updateArsenalSkill(idx, key, val) { if (editingArsenal.skills[idx]) editingArsenal.skills[idx][key] = val; }
function removeArsenalSkill(idx) {
  editingArsenal.skills.splice(idx, 1);
  document.getElementById('arsenalInner').innerHTML = renderArsenalEditor();
}
async function saveArsenal() {
  editingArsenal.icon  = document.getElementById('arsCatIcon').value.trim() || '⬡';
  editingArsenal.name  = document.getElementById('arsCatName').value.trim();
  editingArsenal.tags  = document.getElementById('arsCatTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if (!editingArsenal.name) { showToast('// Nom requis.'); return; }
  try { await Store.upsertArsenalCat(editingArsenal); closeModal('arsenalModal'); renderView('arsenal'); showToast('✓ Catégorie enregistrée !'); } catch(e) { showToast('✗ Erreur sauvegarde.'); }
}
async function deleteArsenalCat(id) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  try { await Store.deleteArsenalCat(id); renderView('arsenal'); showToast('✓ Catégorie supprimée.'); } catch(e) { showToast('✗ Erreur.'); }
}
function initArsenalEvents() {}

/* ── Comments View ── */
async function viewComments() {
  const [projects, posts] = await Promise.all([Store.getProjects(), Store.getPosts()]);
  const all = [...projects, ...posts];
  let html = `
  <div class="view-header">
    <div><p class="view-title">Commentaires</p><p class="view-subtitle">// Modération des commentaires</p></div>
  </div>`;
  let total = 0;
  for (const item of all) {
    const comments = await Store.getComments(item.id);
    if (!comments.length) continue;
    total += comments.length;
    html += `
    <div class="settings-card" style="margin-bottom:1.25rem">
      <h3 style="font-size:.85rem;margin-bottom:1rem;color:var(--cyan)">${esc(item.title)}</h3>
      ${comments.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:.65rem 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="display:flex;gap:.75rem;align-items:baseline;margin-bottom:.3rem">
            <span style="font-family:var(--mono);font-size:.78rem;color:var(--cyan)">${esc(c.author)}</span>
            <span style="font-family:var(--mono);font-size:.65rem;color:var(--txt3)">${fmtDate(c.createdAt)}</span>
          </div>
          <p style="font-size:.88rem;color:var(--txt2)">${esc(c.text)}</p>
        </div>
        <button class="btn btn-sm btn-red" onclick="deleteCommentAdmin('${item.id}','${c.id}')" style="flex-shrink:0;margin-left:.75rem">✕</button>
      </div>`).join('')}
    </div>`;
  }
  if (total === 0) html += '<div class="empty-state"><p>// Aucun commentaire.</p></div>';
  return html;
}
async function deleteCommentAdmin(projectId, commentId) {
  try { await Store.deleteComment(projectId, commentId); renderView('comments'); showToast('✓ Commentaire supprimé.'); } catch(e) { showToast('✗ Erreur.'); }
}

/* ════════════════════════════════════════════════════════════
   EDITORS
   ════════════════════════════════════════════════════════════ */

/* ── PROJECT EDITOR ── */
async function openProjectEditor(id = null) {
  const existing = id ? await Store.getProject(id) : null;
  editingDoc = { kind: 'project', data: existing ? JSON.parse(JSON.stringify(existing)) : { id: Store.uid(), title:'', category:'lab', status:'wip', summary:'', tags:[], githubUrl:'', coverEmoji:'⬡', content:[] } };
  pendingBlocks = JSON.parse(JSON.stringify(editingDoc.data.content || []));
  renderEditorModal('project');
}

/* ── POST EDITOR ── */
async function openPostEditor(id = null, typeHint = 'article') {
  const existing = id ? await Store.getPost(id) : null;
  editingDoc = { kind: 'post', data: existing ? JSON.parse(JSON.stringify(existing)) : { id: Store.uid(), type: typeHint, title:'', category:'', excerpt:'', tags:[], coverEmoji: typeHint==='writeup'?'🚩':'📝', content:[], published: false } };
  pendingBlocks = JSON.parse(JSON.stringify(editingDoc.data.content || []));
  renderEditorModal('post');
}

/* ── Render editor modal ── */
function renderEditorModal(kind) {
  const d = editingDoc.data;
  const isPost = kind === 'post';
  const title = isPost
    ? (d.type==='writeup' ? '// Éditeur Writeup CTF' : '// Éditeur Article')
    : '// Éditeur Projet';

  document.getElementById('editorInner').innerHTML = `
  <div class="editor-topbar">
    <h2>${title}</h2>
    <div class="editor-actions">
      <button class="btn btn-ghost btn-sm" onclick="closeEditorModal()">✕ Fermer</button>
      ${isPost ? `<button class="btn btn-sm ${d.published?'btn-amber':'btn-ghost'}" id="publishToggleBtn" onclick="toggleDraftInEditor()">
        ${d.published ? '● Dépublier' : '○ Publier'}
      </button>` : ''}
      <button class="btn btn-cyan btn-sm" onclick="saveEditor()">✓ Enregistrer</button>
    </div>
  </div>

  <!-- Meta fields -->
  <div class="editor-fields">
    <div class="editor-fields-row">
      <div class="field">
        <label class="label">Titre *</label>
        <input id="ef_title" class="input" value="${esc(d.title||'')}" placeholder="Titre du ${isPost?'post':'projet'}"/>
      </div>
      <div class="field">
        <label class="label">Emoji / Icône</label>
        <input id="ef_emoji" class="input" value="${esc(d.coverEmoji||'')}" placeholder="⬡ 🛡️ 🚩"/>
      </div>
    </div>
    ${isPost ? `
    <div class="editor-fields-row">
      <div class="field">
        <label class="label">Type</label>
        <select id="ef_type" class="select input">
          <option value="article" ${d.type==='article'?'selected':''}>Article technique</option>
          <option value="writeup" ${d.type==='writeup'?'selected':''}>Writeup CTF</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Catégorie</label>
        <input id="ef_category" class="input" value="${esc(d.category||'')}" placeholder="HackTheBox, IDS/IPS, Réseau..."/>
      </div>
    </div>
    <div class="field">
      <label class="label">Résumé / Extrait</label>
      <textarea id="ef_excerpt" class="textarea" placeholder="Courte description affichée sur la card...">${esc(d.excerpt||'')}</textarea>
    </div>` : `
    <div class="editor-fields-row">
      <div class="field">
        <label class="label">Catégorie</label>
        <select id="ef_category" class="select input">
          <option value="lab"     ${d.category==='lab'    ?'selected':''}>Lab</option>
          <option value="network" ${d.category==='network'?'selected':''}>Réseau</option>
          <option value="tool"    ${d.category==='tool'   ?'selected':''}>Outil</option>
          <option value="ctf"     ${d.category==='ctf'    ?'selected':''}>CTF</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Statut</label>
        <select id="ef_status" class="select input">
          <option value="wip"      ${d.status==='wip'     ?'selected':''}>En cours</option>
          <option value="complete" ${d.status==='complete'?'selected':''}>Terminé</option>
          <option value="ctf"      ${d.status==='ctf'     ?'selected':''}>CTF</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label class="label">Résumé</label>
      <textarea id="ef_summary" class="textarea" placeholder="Courte description...">${esc(d.summary||'')}</textarea>
    </div>
    <div class="field">
      <label class="label">Lien GitHub (optionnel)</label>
      <input id="ef_github" class="input" value="${esc(d.githubUrl||'')}" placeholder="https://github.com/..."/>
    </div>`}
    <div class="field">
      <label class="label">Tags (séparés par virgule)</label>
      <input id="ef_tags" class="input" value="${esc((d.tags||[]).join(', '))}" placeholder="Suricata, Python, GNS3..."/>
    </div>
  </div>

  <!-- Block editor -->
  <div class="blocks-section">
    <p class="blocks-section-title">Contenu — Blocs</p>
    <div class="block-list" id="blockList"></div>
    <button class="add-block-btn" onclick="openBlockPicker()">+ Ajouter un bloc</button>
  </div>`;

  openModal('editorModal');
  renderBlockList();
}

function closeEditorModal() {
  closeModal('editorModal');
  editingDoc = null; pendingBlocks = [];
}

function toggleDraftInEditor() {
  if (!editingDoc) return;
  editingDoc.data.published = !editingDoc.data.published;
  const btn = document.getElementById('publishToggleBtn');
  if (btn) {
    btn.textContent = editingDoc.data.published ? '● Dépublier' : '○ Publier';
    btn.className = `btn btn-sm ${editingDoc.data.published?'btn-amber':'btn-ghost'}`;
  }
}

async function saveEditor() {
  if (!editingDoc) return;
  const d = editingDoc.data;
  const kind = editingDoc.kind;

  // Collect fields
  d.title       = document.getElementById('ef_title')?.value.trim()    || '';
  d.coverEmoji  = document.getElementById('ef_emoji')?.value.trim()    || '⬡';
  d.tags        = (document.getElementById('ef_tags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean);

  if (kind === 'post') {
    d.type     = document.getElementById('ef_type')?.value     || 'article';
    d.category = document.getElementById('ef_category')?.value || '';
    d.excerpt  = document.getElementById('ef_excerpt')?.value.trim() || '';
  } else {
    d.category = document.getElementById('ef_category')?.value || 'lab';
    d.status   = document.getElementById('ef_status')?.value   || 'wip';
    d.summary  = document.getElementById('ef_summary')?.value.trim()  || '';
    d.githubUrl= document.getElementById('ef_github')?.value.trim()   || '';
  }

  if (!d.title) { showToast('// Titre requis.'); return; }
  d.content = JSON.parse(JSON.stringify(pendingBlocks));

  const btn = document.querySelector('.editor-topbar .btn-cyan');
  if (btn) { btn.textContent = '⟳ Sauvegarde...'; btn.disabled = true; }

  try {
    if (kind === 'project') {
      await Store.upsertProject(d);
    } else {
      await Store.upsertPost(d);
    }
    closeEditorModal();
    renderView(kind === 'project' ? 'projects' : 'posts');
    showToast(`✓ "${d.title}" enregistré dans Firebase !`);
  } catch(e) {
    showToast('✗ Erreur sauvegarde. Réessaie.');
    if (btn) { btn.textContent = '✓ Enregistrer'; btn.disabled = false; }
  }
}

/* ════════════════════════════════════════════════════════════
   BLOCK EDITOR
   ════════════════════════════════════════════════════════════ */

const BLOCK_TYPES = [
  { type:'heading',  icon:'H', label:'Titre' },
  { type:'text',     icon:'¶', label:'Paragraphe' },
  { type:'code',     icon:'<>', label:'Code' },
  { type:'image',    icon:'🖼', label:'Image' },
  { type:'quote',    icon:'❝', label:'Citation' },
  { type:'list',     icon:'≡', label:'Liste' },
  { type:'alert',    icon:'⚠', label:'Alerte' },
  { type:'divider',  icon:'—', label:'Séparateur' },
];

function openBlockPicker() {
  const grid = document.getElementById('blockPickerGrid');
  grid.innerHTML = BLOCK_TYPES.map(bt => `
    <button class="bpick-btn" onclick="addBlock('${bt.type}')">
      <span class="bpick-icon">${bt.icon}</span>
      <span class="bpick-label">${bt.label}</span>
    </button>`).join('');
  openModal('blockPickerModal');
}

function addBlock(type) {
  closeModal('blockPickerModal');
  if (type === 'image') {
    openImagePicker(block => {
      pendingBlocks.push(block);
      renderBlockList();
    });
    return;
  }
  const newBlock = defaultBlock(type);
  pendingBlocks.push(newBlock);
  renderBlockList();
  // auto-scroll to new block
  setTimeout(() => {
    const list = document.getElementById('blockList');
    list?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }, 50);
}

function defaultBlock(type) {
  switch(type) {
    case 'heading':  return { type, level: 2, text: '' };
    case 'text':     return { type, text: '' };
    case 'code':     return { type, lang: 'bash', code: '' };
    case 'quote':    return { type, text: '', source: '' };
    case 'divider':  return { type };
    case 'list':     return { type, ordered: false, items: [''] };
    case 'alert':    return { type, kind: 'info', text: '' };
    default:         return { type };
  }
}

function renderBlockList() {
  const list = document.getElementById('blockList');
  if (!list) return;
  if (!pendingBlocks.length) {
    list.innerHTML = `<div style="font-family:var(--mono);font-size:.75rem;color:var(--txt3);text-align:center;padding:1.5rem;border:1px dashed var(--border);border-radius:3px">// Aucun bloc. Clique "Ajouter un bloc" pour commencer.</div>`;
    return;
  }
  list.innerHTML = pendingBlocks.map((b, i) => renderBlockItem(b, i)).join('');
}

function renderBlockItem(block, idx) {
  const preview = blockPreview(block);
  const editFields = blockEditFields(block, idx);
  return `
  <div class="block-item" id="blk_${idx}">
    <div class="block-item-header" onclick="toggleBlockEdit(${idx})">
      <span class="block-drag" title="Déplacer">⠿</span>
      <span class="block-type-badge">${block.type}</span>
      <span class="block-preview">${preview}</span>
      <span class="block-ctrl">
        ${idx > 0 ? `<button onclick="event.stopPropagation();moveBlock(${idx},-1)" title="Monter">↑</button>` : ''}
        ${idx < pendingBlocks.length-1 ? `<button onclick="event.stopPropagation();moveBlock(${idx},1)" title="Descendre">↓</button>` : ''}
        <button class="del-btn" onclick="event.stopPropagation();removeBlock(${idx})" title="Supprimer">✕</button>
      </span>
    </div>
    <div class="block-edit-area collapsed" id="blkedit_${idx}">
      ${editFields}
    </div>
  </div>`;
}

function blockPreview(b) {
  switch(b.type) {
    case 'heading':  return `H${b.level||2}: ${esc(b.text||'...')}`;
    case 'text':     return esc((b.text||'...').slice(0,80));
    case 'code':     return `[${esc(b.lang||'code')}] ${esc((b.code||'').split('\n')[0]||'...')}`;
    case 'image':    return b.src ? `🖼 ${esc(b.caption||b.src.slice(0,40)+'...')}` : '🖼 (aucune image)';
    case 'quote':    return `❝ ${esc((b.text||'...').slice(0,60))}`;
    case 'divider':  return '──────────────';
    case 'list':     return `${b.ordered?'1.':'•'} ${esc((b.items||[''])[0]||'...')}`;
    case 'alert':    return `[${b.kind||'info'}] ${esc((b.text||'...').slice(0,60))}`;
    default: return b.type;
  }
}

function blockEditFields(b, idx) {
  switch(b.type) {

    case 'heading':
      return `
      <div style="display:grid;grid-template-columns:100px 1fr;gap:.6rem">
        <div class="field">
          <label class="label">Niveau</label>
          <select class="select input" onchange="updateBlock(${idx},'level',+this.value)">
            ${[2,3,4].map(l=>`<option value="${l}" ${b.level==l?'selected':''}>${l===2?'H2 — Grand':'H'+(l)+(l===3?' — Moyen':' — Petit')}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label">Texte du titre</label>
          <input class="input" value="${esc(b.text||'')}" oninput="updateBlock(${idx},'text',this.value)" placeholder="Votre titre..."/>
        </div>
      </div>`;

    case 'text':
      return `
      <div class="field">
        <label class="label">Contenu — Markdown inline supporté : **gras**, *italique*, \`code\`, [lien](url)</label>
        <textarea class="textarea" rows="5" oninput="updateBlock(${idx},'text',this.value)" placeholder="Votre paragraphe...">${esc(b.text||'')}</textarea>
      </div>`;

    case 'code':
      return `
      <div style="display:grid;grid-template-columns:140px 1fr;gap:.6rem">
        <div class="field">
          <label class="label">Langage</label>
          <select class="input" onchange="updateBlock(${idx},'lang',this.value)" style="font-family:var(--mono);font-size:.78rem">
            ${['bash','python','c','cpp','javascript','typescript','html','css','sql','mysql','php','java','rust','go','yaml','json','dockerfile','nginx','suricata','cisco','powershell','asm','ruby','perl','makefile','text'].map(l=>`<option value="${l}" ${(b.lang||'bash')===l?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label">Code</label>
          <textarea class="textarea" rows="8" style="font-family:var(--mono);font-size:.8rem" oninput="updateBlock(${idx},'code',this.value)" placeholder="// Votre code ici...">${esc(b.code||'')}</textarea>
        </div>
      </div>`;

    case 'image':
      return `
      <div class="field" style="margin-bottom:.5rem">
        ${b.src ? `<img src="${b.src}" style="max-height:180px;border-radius:3px;border:1px solid var(--border);object-fit:cover;width:100%;margin-bottom:.5rem"/>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openImagePicker(function(blk){pendingBlocks[${idx}]=blk;renderBlockList()})">
          ${b.src ? '🔄 Changer l\'image' : '🖼 Choisir une image'}
        </button>
      </div>
      <div class="field">
        <label class="label">Légende</label>
        <input class="input" value="${esc(b.caption||'')}" oninput="updateBlock(${idx},'caption',this.value)" placeholder="Description de l'image..."/>
      </div>`;

    case 'quote':
      return `
      <div class="field" style="margin-bottom:.5rem">
        <label class="label">Citation</label>
        <textarea class="textarea" rows="3" oninput="updateBlock(${idx},'text',this.value)" placeholder="Texte de la citation...">${esc(b.text||'')}</textarea>
      </div>
      <div class="field">
        <label class="label">Source (optionnel)</label>
        <input class="input" value="${esc(b.source||'')}" oninput="updateBlock(${idx},'source',this.value)" placeholder="Auteur ou source..."/>
      </div>`;

    case 'divider':
      return `<p style="font-family:var(--mono);font-size:.72rem;color:var(--txt3)">// Ligne de séparation — aucun champ requis.</p>`;

    case 'list':
      return `
      <div class="field" style="margin-bottom:.5rem">
        <label class="label">Type</label>
        <select class="select input" style="max-width:200px" onchange="updateBlock(${idx},'ordered',this.value==='true')">
          <option value="false" ${!b.ordered?'selected':''}>• Liste à puces</option>
          <option value="true"  ${b.ordered ?'selected':''}>1. Liste numérotée</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Items (un par ligne)</label>
        <textarea class="textarea" rows="5" oninput="updateBlockItems(${idx},this.value)" placeholder="Item 1&#10;Item 2&#10;Item 3">${esc((b.items||['']).join('\n'))}</textarea>
      </div>`;

    case 'alert':
      return `
      <div style="display:grid;grid-template-columns:140px 1fr;gap:.6rem">
        <div class="field">
          <label class="label">Type</label>
          <select class="select input" onchange="updateBlock(${idx},'kind',this.value)">
            <option value="info"    ${b.kind==='info'   ?'selected':''}>ℹ Info</option>
            <option value="warning" ${b.kind==='warning'?'selected':''}>⚠ Avertissement</option>
            <option value="danger"  ${b.kind==='danger' ?'selected':''}>⛔ Danger</option>
            <option value="success" ${b.kind==='success'?'selected':''}>✓ Succès</option>
          </select>
        </div>
        <div class="field">
          <label class="label">Message</label>
          <textarea class="textarea" rows="3" oninput="updateBlock(${idx},'text',this.value)" placeholder="Contenu de l'alerte...">${esc(b.text||'')}</textarea>
        </div>
      </div>`;

    default: return '';
  }
}

function toggleBlockEdit(idx) {
  const el = document.getElementById(`blkedit_${idx}`);
  if (el) el.classList.toggle('collapsed');
}

function updateBlock(idx, key, val) {
  if (pendingBlocks[idx]) pendingBlocks[idx][key] = val;
  // update preview without full re-render
  const prev = document.querySelector(`#blk_${idx} .block-preview`);
  if (prev) prev.textContent = blockPreview(pendingBlocks[idx]);
}

function updateBlockItems(idx, text) {
  if (pendingBlocks[idx]) pendingBlocks[idx].items = text.split('\n');
  const prev = document.querySelector(`#blk_${idx} .block-preview`);
  if (prev) prev.textContent = blockPreview(pendingBlocks[idx]);
}

function moveBlock(idx, dir) {
  const ni = idx + dir;
  if (ni < 0 || ni >= pendingBlocks.length) return;
  [pendingBlocks[idx], pendingBlocks[ni]] = [pendingBlocks[ni], pendingBlocks[idx]];
  renderBlockList();
}

function removeBlock(idx) {
  pendingBlocks.splice(idx, 1);
  renderBlockList();
}

/* ════════════════════════════════════════════════════════════
   IMAGE PICKER
   ════════════════════════════════════════════════════════════ */
function openImagePicker(cb) {
  imgCb = cb;
  document.getElementById('imgFileInput').value = '';
  document.getElementById('imgUrlInput').value  = '';
  document.getElementById('imgCaption').value   = '';
  document.getElementById('imgPreview').innerHTML = '';
  openModal('imageModal');

  document.getElementById('imgFileInput').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('imgPreview').innerHTML = `<img src="${ev.target.result}" style="max-height:160px;border-radius:3px;border:1px solid var(--border);width:100%;object-fit:cover"/>`;
    };
    reader.readAsDataURL(file);
  };

  document.getElementById('imgUrlInput').oninput = e => {
    const url = e.target.value;
    if (url) document.getElementById('imgPreview').innerHTML = `<img src="${url}" style="max-height:160px;border-radius:3px;border:1px solid var(--border);width:100%;object-fit:cover" onerror="this.style.display='none'"/>`;
  };

  document.getElementById('imgConfirmBtn').onclick = () => {
    const fileInput = document.getElementById('imgFileInput');
    const urlInput  = document.getElementById('imgUrlInput');
    const caption   = document.getElementById('imgCaption').value.trim();

    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = ev => {
        if (imgCb) imgCb({ type: 'image', src: ev.target.result, caption });
        closeModal('imageModal');
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else if (urlInput.value.trim()) {
      if (imgCb) imgCb({ type: 'image', src: urlInput.value.trim(), caption });
      closeModal('imageModal');
    } else {
      showToast('// Sélectionne une image ou saisis une URL.');
    }
  };
}

/* ════════════════════════════════════════════════════════════
   ACTIONS
   ════════════════════════════════════════════════════════════ */
async function deleteItem(kind, id) {
  if (!confirm('Supprimer définitivement ?')) return;
  try {
    if (kind === 'project') { await Store.deleteProject(id); }
    else { await Store.deletePost(id); }
    renderView(kind === 'project' ? 'projects' : 'posts');
    showToast('✓ Supprimé.');
  } catch(e) { showToast('✗ Erreur suppression.'); }
}

function previewItem(kind, id) {
  const url = kind === 'project' ? `/pages/project.html?id=${id}` : `/pages/post.html?id=${id}`;
  window.open(url, '_blank');
}

async function togglePublish(id) {
  const post = await Store.getPost(id);
  if (!post) return;
  post.published = !post.published;
  Store.upsertPost(post);
  renderView('posts');
  showToast(post.published ? '// Publié.' : '// Dépublié.');
}

/* ── Utils ── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function esc(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); }
function statusBadge(s) { return {complete:'badge-green',wip:'badge-amber',ctf:'badge-red'}[s]||'badge-cyan'; }
function statusLabel(s) { return {complete:'Terminé',wip:'En cours',ctf:'CTF'}[s]||s; }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

// Close modals on overlay click
document.addEventListener('click', e => {
  ['editorModal','blockPickerModal','imageModal'].forEach(id => {
    const overlay = document.getElementById(id);
    if (e.target === overlay) closeModal(id);
  });
});
// Keyboard close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ['editorModal','arsenalModal','blockPickerModal','imageModal'].forEach(id => closeModal(id));
});
