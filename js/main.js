/* ============================================================
   main.js — 0xSaidoss Portfolio (Firebase version)
   Toutes les fonctions Store sont async — on utilise await.
   ============================================================ */
'use strict';

const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

function waitForStore(cb) {
  if (typeof window.Store !== 'undefined' && typeof window.Store.getProjects === 'function') {
    cb();
  } else {
    setTimeout(() => waitForStore(cb), 50);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initNav();
  initMatrix();
  initReveal();
  initStats();
  initTyping();
  initContact();

  waitForStore(() => {
    // Écoute en temps réel — les visiteurs voient les changements instantanément
    Store.onProjectsChange(projects => {
      renderProjectsData(projects);
      initFilter();
    });
    Store.onPostsChange(posts => {
      renderBlogData(posts);
      initTabs();
    });
    Store.onArsenalChange(cats => {
      renderArsenalData(cats);
    });
    // Enregistre la visite (admin exclu)
    Store.recordVisit && Store.recordVisit().catch(() => {});
  });
});

/* ── LOADING STATE ── */
function showLoadingState() {
  ['projectsGrid','blogGrid','arsenalGrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="fb-loading"><span class="fb-spinner"></span> Chargement...</div>`;
  });
}
function hideLoadingState() {}

/* ── CURSOR ── */
function initCursor() {
  const dot=document.getElementById('cursor'),ring=document.getElementById('cursorFollower');
  if(!dot||!ring)return;
  let mx=0,my=0,fx=0,fy=0;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`;},{passive:true});
  (function animRing(){fx+=(mx-fx)*.1;fy+=(my-fy)*.1;ring.style.transform=`translate(${fx}px,${fy}px) translate(-50%,-50%)`;requestAnimationFrame(animRing);})();
  document.addEventListener('mousedown',()=>{dot.classList.add('active');ring.classList.add('active');});
  document.addEventListener('mouseup',()=>{dot.classList.remove('active');ring.classList.remove('active');});
  document.addEventListener('mouseover',e=>{
    if(e.target.closest('a,button,.proj-card,.blog-card,.skill-cat')) ring.classList.add('active');
    else ring.classList.remove('active');
  });
}

/* ── NAV ── */
function initNav() {
  const nav=document.getElementById('nav'),ham=document.getElementById('ham'),links=document.getElementById('navLinks');
  window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40),{passive:true});
  ham?.addEventListener('click',()=>{
    links.classList.toggle('open');
    const o=links.classList.contains('open'),sp=ham.querySelectorAll('span');
    sp[0].style.transform=o?'rotate(45deg) translate(5px,5px)':'';
    sp[1].style.opacity=o?'0':'1';
    sp[2].style.transform=o?'rotate(-45deg) translate(5px,-5px)':'';
  });
  links?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')));
}

/* ── MATRIX ── */
function initMatrix() {
  const c=document.getElementById('matrixCanvas');
  if(!c)return;
  const ctx=c.getContext('2d');
  const resize=()=>{c.width=innerWidth;c.height=innerHeight;};
  resize();window.addEventListener('resize',resize,{passive:true});
  const chars='アイウエオ0123456789ABCDEF<>{}[]|/\\';
  const fs=13;let cols,drops;
  const reset=()=>{cols=Math.floor(c.width/fs);drops=Array(cols).fill(1);};
  reset();window.addEventListener('resize',reset,{passive:true});
  setInterval(()=>{
    ctx.fillStyle='rgba(5,10,14,.05)';ctx.fillRect(0,0,c.width,c.height);
    ctx.font=`${fs}px Share Tech Mono,monospace`;
    drops.forEach((y,i)=>{
      ctx.fillStyle=`rgba(0,255,136,${Math.random()>.9?1:.4})`;
      ctx.fillText(chars[Math.floor(Math.random()*chars.length)],i*fs,y*fs);
      if(y*fs>c.height&&Math.random()>.975)drops[i]=0;drops[i]++;
    });
  },65);
}

/* ── REVEAL ── */
function initReveal() {
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}});
  },{threshold:0.1,rootMargin:'0px 0px -50px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
}

/* ── COUNTERS ── */
function initStats() {
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      const el=e.target,target=+el.dataset.target;
      let cur=0;const step=Math.max(1,Math.ceil(target/40));
      const t=setInterval(()=>{cur=Math.min(cur+step,target);el.textContent=cur+'+';if(cur>=target)clearInterval(t);},40);
      io.unobserve(el);
    });
  },{threshold:0.5});
  document.querySelectorAll('.snum').forEach(el=>io.observe(el));
}

/* ── TYPING ── */
function initTyping() {
  const el=document.getElementById('typingText');
  if(!el)return;
  const phrases=['Binary Exploitation','Reverse Engineering','SOC Analyst','CTF Player / 0xSaidoss','Futur Analyste Cyber'];
  let pi=0,ci=0,del=false;
  const run=()=>{
    const phrase=phrases[pi];
    el.textContent=del?phrase.slice(0,ci--):phrase.slice(0,ci++);
    let d=del?50:90;
    if(!del&&ci>phrase.length){d=1800;del=true;}
    else if(del&&ci<0){del=false;pi=(pi+1)%phrases.length;ci=0;d=400;}
    setTimeout(run,d);
  };
  setTimeout(run,1500);
}

/* ── RENDER PROJECTS (realtime) ── */
async function renderProjectsData(projects) {
  const grid=document.getElementById('projectsGrid');
  if(!grid)return;
  if(!projects||!projects.length){grid.innerHTML='<p style="color:var(--txt3);font-family:var(--mono);font-size:.8rem">// Aucun projet.</p>';return;}

  const [likesArr, commentsArr] = await Promise.all([
    Promise.all(projects.map(p=>Store.getLikes(p.id))),
    Promise.all(projects.map(p=>Store.getComments(p.id))),
  ]);

  grid.innerHTML = projects.map((p,i) => `
    <div class="proj-card reveal" data-category="${p.category||'lab'}" onclick="window.location='/Portfolio/pages/project.html?id=${p.id}'">
      <div class="proj-banner"><span style="position:relative;z-index:1">${p.coverEmoji||'⬡'}</span><div class="proj-banner-ov"></div></div>
      <div class="proj-body">
        <p class="proj-cat">${escHtml(p.category||'lab')}</p>
        <h3 class="proj-title">${escHtml(p.title)}</h3>
        <p class="proj-summary">${escHtml(p.summary||'')}</p>
        <div class="proj-tags">${(p.tags||[]).map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>
        <div class="proj-actions">
          ${p.githubUrl?`<a href="${p.githubUrl}" target="_blank" rel="noopener" class="pbtn-gh" onclick="event.stopPropagation()">↗ GitHub</a>`:''}
          <button class="pBtn-detail" onclick="event.stopPropagation();window.location='/Portfolio/pages/project.html?id=${p.id}'">Détails →</button>
        </div>
        <div class="interact-bar" onclick="event.stopPropagation()">
          <button class="like-btn" id="like-${p.id}" onclick="toggleLike('${p.id}')">
            <span class="heart">♥</span> <span class="like-count">${likesArr[i]}</span>
          </button>
          <span class="comment-count">💬 ${commentsArr[i].length}</span>
        </div>
      </div>
    </div>`).join('');

  // Charger l'état liked pour chaque projet
  projects.forEach(async p => {
    const liked = await Store.hasLiked(p.id);
    document.getElementById(`like-${p.id}`)?.classList.toggle('liked', liked);
  });

  initReveal();
}

/* ── LIKES ── */
async function toggleLike(id) {
  const btn = document.getElementById(`like-${id}`);
  if (!btn) return;
  const liked = await Store.toggleLike(id);
  btn.classList.toggle('liked', liked);
  const count = await Store.getLikes(id);
  btn.querySelector('.like-count').textContent = count;
  const h=btn.querySelector('.heart');h.style.transform='scale(1.5)';setTimeout(()=>h.style.transform='scale(1)',300);
}
async function toggleLikeDetail(id) {
  const btn=document.getElementById('detailLikeBtn');
  if(!btn)return;
  const liked=await Store.toggleLike(id);
  btn.classList.toggle('liked',liked);
  btn.querySelector('.like-count').textContent=await Store.getLikes(id);
}

/* ── ARSENAL (async) ── */
function renderArsenalData(cats) {
  const container=document.getElementById('arsenalGrid');
  if(!container)return;
  if(!cats||!cats.length)return;
  container.innerHTML=cats.map(cat=>`
    <div class="skill-cat">
      <div class="skill-cat-hdr"><span class="skill-ico">${cat.icon||'⬡'}</span><span class="skill-cat-name">${escHtml(cat.name)}</span></div>
      ${cat.skills.map(s=>`
        <div class="skill-item">
          <div class="skill-meta"><span class="skill-n">${escHtml(s.name)}</span><span class="skill-p">${s.pct}%</span></div>
          <div class="skill-bar"><div class="skill-fill" data-pct="${s.pct}"></div></div>
        </div>`).join('')}
      ${cat.tags?.length?`<div class="skill-tags">${cat.tags.map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>`:''}
    </div>`).join('');
  initSkillBars();
}

/* ── BLOG (async) ── */
function renderBlogData(allPosts, filter='all') {
  const grid=document.getElementById('blogGrid');
  if(!grid)return;
  const posts=filter==='all'?allPosts:allPosts.filter(p=>p.type===filter);
  window._lastPosts = allPosts;
  const filtered=filter==='all'?posts:posts.filter(p=>p.type===filter);
  if(!filtered.length){grid.innerHTML='<p style="color:var(--txt3);font-family:var(--mono);font-size:.8rem">// Aucun article publié.</p>';return;}
  grid.innerHTML=filtered.map(p=>`
    <div class="blog-card reveal" onclick="window.location='/Portfolio/pages/post.html?id=${p.id}'">
      <div class="blog-top"><span class="blog-type ${p.type}">${p.type==='writeup'?'Writeup CTF':'Article'}</span><span class="blog-date">${fmtDate(p.createdAt)}</span></div>
      <div class="blog-emoji">${p.coverEmoji||'📄'}</div>
      <h3 class="blog-title">${escHtml(p.title)}</h3>
      <p class="blog-excerpt">${escHtml(p.excerpt||'')}</p>
      <div class="blog-footer"><div class="proj-tags">${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div><span class="blog-read">Lire →</span></div>
    </div>`).join('');
  initReveal();
}

/* ── FILTER / TABS ── */
function initFilter() {
  document.querySelectorAll('.fbtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const f=btn.dataset.f;
      document.querySelectorAll('.proj-card').forEach(c=>c.classList.toggle('hidden',f!=='all'&&!c.dataset.category?.includes(f)));
    });
  });
}
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      renderBlogData(window._lastPosts||[], tab.dataset.tab);
    });
  });
}

/* ── CONTACT — EmailJS ── */
function initContact() {
  const form=document.getElementById('contactForm');
  if(!form)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=form.querySelector('button[type="submit"]');
    const name=form.querySelector('#cname').value.trim();
    const email=form.querySelector('#cemail').value.trim();
    const message=form.querySelector('#cmsg').value.trim();
    btn.textContent='⟳ Envoi...';btn.disabled=true;
    try {
      if(typeof emailjs!=='undefined'&&EMAILJS_SERVICE_ID!=='YOUR_SERVICE_ID'){
        await emailjs.send(EMAILJS_SERVICE_ID,EMAILJS_TEMPLATE_ID,{from_name:name,from_email:email,message,reply_to:email,to_name:'Saidou'},EMAILJS_PUBLIC_KEY);
        showToast('✓ Message envoyé !');
      } else {
        const s=encodeURIComponent(`[Portfolio] Message de ${name}`);
        const b=encodeURIComponent(`De: ${name} <${email}>\n\n${message}`);
        window.open(`mailto:msaidou02.diallo@gmail.com?subject=${s}&body=${b}`);
        showToast('✓ Client mail ouvert !');
      }
      form.reset();
    } catch(err){showToast('✗ Erreur. Écrivez à msaidou02.diallo@gmail.com');}
    btn.textContent='⬡ Envoyer';btn.disabled=false;
  });
}

/* ── COMMENTS (async) ── */
async function renderComments(projectId, containerId) {
  const container=document.getElementById(containerId);
  if(!container)return;
  container.innerHTML=`<div class="fb-loading"><span class="fb-spinner"></span> Chargement...</div>`;
  const [comments, likeCount, liked] = await Promise.all([
    Store.getComments(projectId),
    Store.getLikes(projectId),
    Store.hasLiked(projectId),
  ]);
  container.innerHTML=`
    <div class="interact-bar">
      <button class="like-btn${liked?' liked':''}" id="detailLikeBtn" onclick="toggleLikeDetail('${projectId}')">
        <span class="heart">♥</span> <span class="like-count">${likeCount}</span>&nbsp;J'aime
      </button>
    </div>
    <div class="comments-section">
      <h3>// Commentaires (${comments.length})</h3>
      <form class="comment-form" onsubmit="submitComment(event,'${projectId}','${containerId}')">
        <div class="comment-form-row">
          <input type="text" id="commentName" placeholder="Ton pseudo" required maxlength="50"/>
          <input type="email" id="commentEmail" placeholder="Email (optionnel)" maxlength="100"/>
        </div>
        <textarea id="commentText" placeholder="Ton commentaire..." required maxlength="1000"></textarea>
        <button type="submit" class="comment-submit">⬡ Commenter</button>
      </form>
      <div class="comment-list">
        ${comments.length?comments.map(c=>`
          <div class="comment-item">
            <div class="comment-meta">
              <span class="comment-author">${escHtml(c.author)}</span>
              <span class="comment-date">${fmtDate(c.createdAt)}</span>
            </div>
            <p class="comment-text">${escHtml(c.text)}</p>
          </div>`).join(''):'<p class="no-comments">// Aucun commentaire. Sois le premier !</p>'}
      </div>
    </div>`;
}

async function submitComment(e, projectId, containerId) {
  e.preventDefault();
  const author=document.getElementById('commentName').value.trim();
  const text=document.getElementById('commentText').value.trim();
  if(!author||!text)return;
  const btn=e.target.querySelector('button[type="submit"]');
  btn.textContent='⟳ Envoi...';btn.disabled=true;
  await Store.addComment(projectId,{author,text});
  await renderComments(projectId,containerId);
  showToast('✓ Commentaire ajouté !');
}

/* ── SKILL BARS ── */
function initSkillBars() {
  const bars=document.querySelectorAll('.skill-fill');
  if(!bars.length)return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      const idx=[...document.querySelectorAll('.skill-fill')].indexOf(e.target);
      setTimeout(()=>{e.target.style.width=(e.target.dataset.pct||0)+'%';},idx*55);
      io.unobserve(e.target);
    });
  },{threshold:0.3});
  bars.forEach(b=>io.observe(b));
}

/* ── UTILS ── */
function escHtml(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtDate(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});}
function showToast(msg){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);
}
