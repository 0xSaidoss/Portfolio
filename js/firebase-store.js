/* ============================================================
   firebase-store.js — Firestore + Auth backend
   Remplace store.js (localStorage) par Firebase.

   ÉTAPE 1 : Remplis ta config Firebase ci-dessous.
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════
   CONFIG FIREBASE — portfolio-62901
   ══════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAFvLb_Auw18LG2IRQTmr4J88VqbKcBx8g",
  authDomain:        "portfolio-62901.firebaseapp.com",
  projectId:         "portfolio-62901",
  storageBucket:     "portfolio-62901.firebasestorage.app",
  messagingSenderId: "519604251858",
  appId:             "1:519604251858:web:fdc87e0bbc3e546eab910b"
};

const ADMIN_EMAIL = "msaidou02.diallo@gmail.com";

/* ══════════════════════════════════════════════════════════
   INITIALISATION FIREBASE (SDK modulaire v10 compat)
   ══════════════════════════════════════════════════════════ */
import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc,
         getDocs, getDoc, setDoc, deleteDoc,
         addDoc, updateDoc, query, orderBy,
         onSnapshot, serverTimestamp,
         increment, arrayUnion }                  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const app  = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

/* Nettoyage des anciens localStorage (migration depuis l'ancienne version) */
['cmsv1_projects','cmsv1_posts','cmsv1_arsenal','cmsv1_session',
 'cmsv1_passhash','cmsv1_likes','cmsv1_comments'].forEach(k => {
  try { localStorage.removeItem(k); } catch(e) {}
});

/* ══════════════════════════════════════════════════════════
   DONNÉES PAR DÉFAUT (chargées une seule fois au 1er init)
   ══════════════════════════════════════════════════════════ */
const SAMPLE_PROJECTS = [
  { id:'proj_001', title:'SOC Lab — Suricata IDS + Wazuh SIEM', category:'lab', status:'complete',
    summary:"Mise en place d'un IDS (Suricata) et d'un SIEM (Wazuh) pour la détection et la réponse aux incidents.",
    tags:['Suricata','Wazuh','Ubuntu','VMware','SIEM'], githubUrl:'', coverEmoji:'🛡️',
    content:[{type:'heading',level:2,text:'Objectif'},{type:'text',text:"Construire un **SOC miniature** fonctionnel : Suricata IDS/IPS, Wazuh SIEM, détection temps réel."},{type:'code',lang:'suricata',code:'alert tcp any any -> $HOME_NET 22 (\n  msg:"SSH Brute Force";\n  threshold:type threshold,track by_src,count 5,seconds 60;\n  sid:9000001; rev:1;\n)'},{type:'alert',kind:'success',text:'Lab fonctionnel : détection scans nmap, brute-force SSH, payloads Metasploit.'}],
    createdAt:'2025-03-01T10:00:00Z', updatedAt:'2025-03-01T10:00:00Z' },
  { id:'proj_002', title:'Simulation Réseau Complexe — GNS3', category:'network', status:'complete',
    summary:"Architectures réseau réalistes : DHCP, NAT, DNS, IPV6, Windows Server, EtherChannel, OSPF, EIGRP.",
    tags:['GNS3','OSPF','EIGRP','DHCP','NAT','IPV6'], githubUrl:'', coverEmoji:'🌐',
    content:[{type:'heading',level:2,text:'Description'},{type:'text',text:'Simulation complète réseau entreprise multi-sites dans GNS3.'},{type:'code',lang:'cisco',code:'router ospf 1\n router-id 1.1.1.1\n network 192.168.0.0 0.0.255.255 area 0'}],
    createdAt:'2025-01-15T10:00:00Z', updatedAt:'2025-01-15T10:00:00Z' },
  { id:'proj_003', title:'VPN Sécurisé — OpenVPN', category:'tool', status:'complete',
    summary:"Déploiement OpenVPN avec PKI Easy-RSA, AES-256-GCM.",
    tags:['OpenVPN','PKI','Linux','TLS','AES-256'], githubUrl:'', coverEmoji:'🔐',
    content:[{type:'text',text:'Tunnel **VPN chiffré** Kali↔Ubuntu avec PKI maison Easy-RSA et AES-256-GCM.'}],
    createdAt:'2025-02-10T10:00:00Z', updatedAt:'2025-02-10T10:00:00Z' },
  { id:'proj_004', title:'100+ Machines TryHackMe — 0xSaidoss', category:'ctf', status:'complete',
    summary:"100+ machines résolues depuis décembre 2024 : sécurité réseau, OWASP, PrivEsc, Kali.",
    tags:['TryHackMe','CTF','PrivEsc','OWASP','Kali'], githubUrl:'', coverEmoji:'🚩',
    content:[{type:'text',text:'**100+ machines** résolues depuis décembre 2024.'}],
    createdAt:'2024-12-07T10:00:00Z', updatedAt:'2025-03-01T10:00:00Z' },
  { id:'proj_005', title:'15+ Challenges Binary Exploitation — Root-Me PRO', category:'ctf', status:'complete',
    summary:"15+ challenges BinExp : Stack overflow, Heap, Format String, ELF x86/x64.",
    tags:['Root-Me','Binary Exploitation','C','GHIDRA','GDB-GEF'], githubUrl:'', coverEmoji:'💀',
    content:[{type:'text',text:'Spécialisation **Binary Exploitation** depuis juillet 2025.'},{type:'code',lang:'python',code:"from pwn import *\np = process('./challenge')\npayload = b'A' * 72 + p32(0x080491b6)\np.sendline(payload)\np.interactive()"}],
    createdAt:'2025-07-01T10:00:00Z', updatedAt:'2025-03-01T10:00:00Z' },
];

const SAMPLE_POSTS = [
  { id:'post_001', type:'article', published:true, title:"Mon parcours : de zéro à 100+ machines TryHackMe",
    category:'Parcours', coverEmoji:'🚀', excerpt:"Comment j'ai découvert la cybersécurité en première sans ordinateur.",
    tags:['TryHackMe','Parcours','Binary Exploitation','Kali Linux'],
    content:[{type:'text',text:"Découverte de la cybersécurité en **première** en Côte d'Ivoire. Pas d'ordinateur. Apprentissage depuis mon téléphone."},{type:'alert',kind:'success',text:"100+ machines THM · 15+ challenges Root-Me BinExp · Labs SOC · GNS3 multi-sites"}],
    createdAt:'2025-03-01T09:00:00Z', updatedAt:'2025-03-01T09:00:00Z' },
  { id:'post_002', type:'writeup', published:true, title:'Writeup Root-Me — ELF x86 Stack Buffer Overflow',
    category:'Root-Me', coverEmoji:'💥', excerpt:"Exploitation buffer overflow ELF x86 : GHIDRA, GDB-GEF, pwntools.",
    tags:['Root-Me','Binary Exploitation','Buffer Overflow','x86'],
    content:[{type:'code',lang:'c',code:'void vuln(void) {\n  char local_48 [64];\n  gets(local_48); // VULNERABLE\n}'},{type:'code',lang:'python',code:"from pwn import *\np = process('./challenge')\npayload = b'A' * 72 + p32(0x080491b6)\np.sendline(payload)\np.interactive()"},{type:'alert',kind:'success',text:"Flag obtenu !"}],
    createdAt:'2025-02-05T14:00:00Z', updatedAt:'2025-02-05T14:00:00Z' },
];

const SAMPLE_ARSENAL = [
  { id:'ars_001', name:'Binary Exploitation & RE', icon:'💀',
    skills:[{name:'Binary Exploitation (C)',pct:80},{name:'Reverse Engineering',pct:72},{name:'Langage C',pct:68},{name:'GHIDRA / IDA / GDB-GEF',pct:74}],
    tags:['Stack Overflow','Heap','Format String','ELF x86/x64'] },
  { id:'ars_002', name:'Réseaux', icon:'🌐',
    skills:[{name:'TCP/IP, DHCP, DNS, NAT',pct:85},{name:'OSPF, EIGRP, RIPV2',pct:80},{name:'VLAN, Routing, Switching',pct:82},{name:'GNS3',pct:85}],
    tags:['GNS3','OpenVPN','Fibre Optique','Windows Server'] },
  { id:'ars_003', name:'SOC & Défense', icon:'🛡️',
    skills:[{name:'Suricata IDS/IPS',pct:78},{name:'Wazuh SIEM',pct:75},{name:'Firewalls / IPTables',pct:78},{name:'Détection menaces',pct:76}],
    tags:['Suricata','Wazuh','Nmap','Burp Suite'] },
  { id:'ars_004', name:'Linux & Scripting', icon:'🐧',
    skills:[{name:'Kali Linux',pct:88},{name:'Ubuntu / CentOS',pct:82},{name:'Bash Scripting',pct:78},{name:'Python',pct:70}],
    tags:['Kali','Ubuntu','VMware'] },
  { id:'ars_005', name:'Web & CTF', icon:'🚩',
    skills:[{name:'OWASP Top 10',pct:75},{name:'Sécurité Web',pct:72},{name:'Privilege Escalation',pct:82},{name:'SQL',pct:68}],
    tags:['TryHackMe','Root-Me','SQLi','XSS'] },
];

/* ══════════════════════════════════════════════════════════
   ÉTAT AUTH (observable)
   ══════════════════════════════════════════════════════════ */
let _currentUser = null;
let _authReady   = false;
let _authCallbacks = [];

onAuthStateChanged(auth, user => {
  _currentUser = user;
  _authReady   = true;
  _authCallbacks.forEach(cb => cb(user));
  _authCallbacks = [];
});

function onAuthReady(cb) {
  if (_authReady) cb(_currentUser);
  else _authCallbacks.push(cb);
}

/* ══════════════════════════════════════════════════════════
   UTILITAIRES
   ══════════════════════════════════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function escHtml(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function parseInline(s='') {
  return escHtml(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code class="inline-code">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" rel="noopener" class="content-link">$1</a>');
}

/* ══════════════════════════════════════════════════════════
   AUTH ADMIN (Firebase Email/Password)
   ══════════════════════════════════════════════════════════ */
async function loginAdmin(password, email) {
  try {
    const emailToUse = (email && email.trim()) ? email.trim() : ADMIN_EMAIL;
    await signInWithEmailAndPassword(auth, emailToUse, password);
    return true;
  } catch(e) {
    console.error('Login error:', e.code);
    return false;
  }
}
async function logoutAdmin() { await signOut(auth); }
function isLoggedIn() { return !!_currentUser; }
function getCurrentUser() { return _currentUser; }

/* ══════════════════════════════════════════════════════════
   PROJETS
   ══════════════════════════════════════════════════════════ */
async function getProjects() {
  try {
    const snap = await getDocs(query(collection(db,'projects'), orderBy('createdAt','desc')));
    if (snap.empty) {
      // Premier lancement : seed les données par défaut
      await seedCollection('projects', SAMPLE_PROJECTS);
      return SAMPLE_PROJECTS;
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error('getProjects:', e); return SAMPLE_PROJECTS; }
}

async function getProject(id) {
  try {
    const snap = await getDoc(doc(db,'projects',id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch(e) { return null; }
}

async function upsertProject(data) {
  const now = new Date().toISOString();
  const id  = data.id || uid();
  await setDoc(doc(db,'projects',id), { ...data, id, updatedAt: now,
    createdAt: data.createdAt || now }, { merge: true });
  return id;
}

async function deleteProject(id) {
  await deleteDoc(doc(db,'projects',id));
}

/* ══════════════════════════════════════════════════════════
   ARTICLES & WRITEUPS
   ══════════════════════════════════════════════════════════ */
async function getPosts() {
  try {
    const snap = await getDocs(query(collection(db,'posts'), orderBy('createdAt','desc')));
    if (snap.empty) {
      await seedCollection('posts', SAMPLE_POSTS);
      return SAMPLE_POSTS;
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return SAMPLE_POSTS; }
}

async function getPublishedPosts() {
  const all = await getPosts();
  return all.filter(p => p.published);
}

async function getPost(id) {
  try {
    const snap = await getDoc(doc(db,'posts',id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch(e) { return null; }
}

async function upsertPost(data) {
  const now = new Date().toISOString();
  const id  = data.id || uid();
  await setDoc(doc(db,'posts',id), { ...data, id, updatedAt: now,
    createdAt: data.createdAt || now }, { merge: true });
  return id;
}

async function deletePost(id) { await deleteDoc(doc(db,'posts',id)); }

/* ══════════════════════════════════════════════════════════
   ARSENAL TECHNIQUE
   ══════════════════════════════════════════════════════════ */
async function getArsenal() {
  try {
    const snap = await getDocs(collection(db,'arsenal'));
    if (snap.empty) {
      await seedCollection('arsenal', SAMPLE_ARSENAL);
      return SAMPLE_ARSENAL;
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return SAMPLE_ARSENAL; }
}

async function upsertArsenalCat(data) {
  const id = data.id || uid();
  await setDoc(doc(db,'arsenal',id), { ...data, id }, { merge: true });
}

async function deleteArsenalCat(id) { await deleteDoc(doc(db,'arsenal',id)); }

/* ══════════════════════════════════════════════════════════
   LIKES
   ══════════════════════════════════════════════════════════ */
function _getFingerprint() {
  let fp = localStorage.getItem('saidoss_fp');
  if (!fp) { fp = Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem('saidoss_fp',fp); }
  return fp;
}

async function getLikes(projectId) {
  try {
    const snap = await getDoc(doc(db,'likes',projectId));
    return snap.exists() ? (snap.data().count || 0) : 0;
  } catch(e) { return 0; }
}

async function hasLiked(projectId) {
  const fp = _getFingerprint();
  try {
    const snap = await getDoc(doc(db,'likes',projectId));
    return snap.exists() ? (snap.data().users || []).includes(fp) : false;
  } catch(e) { return false; }
}

async function toggleLike(projectId) {
  const fp = _getFingerprint();
  const ref = doc(db,'likes',projectId);
  try {
    const snap = await getDoc(ref);
    const users = snap.exists() ? (snap.data().users || []) : [];
    if (users.includes(fp)) {
      // Unlike
      const newUsers = users.filter(u => u !== fp);
      await setDoc(ref, { count: newUsers.length, users: newUsers });
      return false;
    } else {
      // Like
      const newUsers = [...users, fp];
      await setDoc(ref, { count: newUsers.length, users: newUsers });
      return true;
    }
  } catch(e) { return false; }
}

/* ══════════════════════════════════════════════════════════
   COMMENTAIRES
   ══════════════════════════════════════════════════════════ */
async function getComments(projectId) {
  try {
    const snap = await getDocs(
      query(collection(db,'comments',projectId,'items'), orderBy('createdAt','asc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function addComment(projectId, data) {
  await addDoc(collection(db,'comments',projectId,'items'), {
    author: data.author,
    text:   data.text,
    createdAt: new Date().toISOString(),
  });
}

async function deleteComment(projectId, commentId) {
  await deleteDoc(doc(db,'comments',projectId,'items',commentId));
}

/* ══════════════════════════════════════════════════════════
   VISITES
   Admin exclus (pas de Firebase Auth session sur page publique)
   ══════════════════════════════════════════════════════════ */
async function recordVisit() {
  if (isLoggedIn()) return; // Ne pas compter l'admin
  const fp    = _getFingerprint();
  const today = new Date().toISOString().slice(0,10);
  const ref   = doc(db,'meta','visits');
  try {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { total:0, daily:{}, unique:[] };
    data.total = (data.total||0) + 1;
    data.daily = data.daily || {};
    data.daily[today] = (data.daily[today]||0) + 1;
    data.unique = data.unique || [];
    if (!data.unique.includes(fp)) data.unique.push(fp);
    // Garde seulement 30 jours
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
    Object.keys(data.daily).forEach(d => { if(new Date(d)<cutoff) delete data.daily[d]; });
    await setDoc(ref, data);
  } catch(e) { console.warn('recordVisit:', e); }
}

async function getVisits() {
  try {
    const snap = await getDoc(doc(db,'meta','visits'));
    return snap.exists() ? snap.data() : { total:0, daily:{}, unique:[] };
  } catch(e) { return { total:0, daily:{}, unique:[] }; }
}

/* ══════════════════════════════════════════════════════════
   SEED (premier lancement)
   ══════════════════════════════════════════════════════════ */
async function seedCollection(colName, items) {
  for (const item of items) {
    await setDoc(doc(db, colName, item.id), item);
  }
}


/* ══════════════════════════════════════════════════════════
   TEMPS RÉEL — onSnapshot listeners
   Les visiteurs voient les changements instantanément
   ══════════════════════════════════════════════════════════ */
function onProjectsChange(callback) {
  return onSnapshot(
    query(collection(db,'projects'), orderBy('createdAt','desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => console.warn('onProjectsChange:', err)
  );
}

function onPostsChange(callback) {
  return onSnapshot(
    query(collection(db,'posts'), orderBy('createdAt','desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.published)),
    err  => console.warn('onPostsChange:', err)
  );
}

function onArsenalChange(callback) {
  return onSnapshot(
    collection(db,'arsenal'),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => console.warn('onArsenalChange:', err)
  );
}

/* ══════════════════════════════════════════════════════════
   CONTENT BLOCKS RENDERER (inchangé, ne touche pas Firebase)
   ══════════════════════════════════════════════════════════ */
function renderBlock(block) {
  switch(block.type) {
    case 'heading':
      return `<h${block.level||2} class="content-heading lv${block.level||2}">${escHtml(block.text)}</h${block.level||2}>`;
    case 'text':
      return `<p class="content-text">${parseInline(block.text)}</p>`;
    case 'code':
      return `<div class="content-code-block">
        <div class="code-hdr"><span>${escHtml(block.lang||'code')}</span>
          <button class="copy-btn btn btn-sm btn-ghost" onclick="copyBlock(this)">Copy</button>
        </div>
        <pre><code class="lang-${escHtml(block.lang||'text')}">${escHtml(block.code)}</code></pre>
      </div>`;
    case 'image':
      return `<figure class="content-image">
        <img src="${block.src}" alt="${escHtml(block.caption||'')}" loading="lazy"/>
        ${block.caption?`<figcaption>${escHtml(block.caption)}</figcaption>`:''}
      </figure>`;
    case 'quote':
      return `<blockquote class="content-quote">
        <p>${parseInline(block.text)}</p>
        ${block.source?`<cite>— ${escHtml(block.source)}</cite>`:''}
      </blockquote>`;
    case 'divider': return `<hr class="content-divider"/>`;
    case 'list':
      const li = (block.items||[]).map(i=>`<li>${parseInline(i)}</li>`).join('');
      return block.ordered ? `<ol class="content-list">${li}</ol>` : `<ul class="content-list">${li}</ul>`;
    case 'alert':
      const icons = {info:'ℹ',warning:'⚠',danger:'⛔',success:'✓'};
      return `<div class="content-alert alert-${block.kind||'info'}">
        <span class="alert-icon">${icons[block.kind]||'ℹ'}</span>
        <span>${parseInline(block.text)}</span>
      </div>`;
    default: return '';
  }
}
function renderBlocks(blocks=[]) { return (blocks||[]).map(renderBlock).join('\n'); }

/* ══════════════════════════════════════════════════════════
   EXPORT GLOBAL (compatible avec l'ancien Store.xxx)
   ══════════════════════════════════════════════════════════ */
window.Store = {
  uid,
  /* auth */
  login: loginAdmin, logout: logoutAdmin, isLoggedIn, onAuthReady, getCurrentUser,
  /* projects */
  getProjects, getProject, upsertProject, deleteProject,
  /* posts */
  getPosts, getPost, getPublishedPosts, upsertPost, deletePost,
  /* arsenal */
  getArsenal, upsertArsenalCat, deleteArsenalCat,
  /* likes */
  getLikes, hasLiked, toggleLike,
  /* comments */
  getComments, addComment, deleteComment,
  /* visits */
  recordVisit, getVisits,
  /* realtime */
  onProjectsChange, onPostsChange, onArsenalChange,
  /* render */
  renderBlocks, renderBlock, escHtml, parseInline,
};

function copyBlock(btn) {
  const code = btn.closest('.content-code-block').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(()=>{ btn.textContent='Copied!'; setTimeout(()=>btn.textContent='Copy',2000); });
}
