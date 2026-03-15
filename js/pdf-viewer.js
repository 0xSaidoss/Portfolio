/* ============================================================
   pdf-viewer.js — Lecteur PDF style LinkedIn
   Utilise PDF.js (CDN) pour le rendu page par page
   ============================================================ */
'use strict';

/* ── État global des viewers ── */
const PDF_VIEWERS = {};

/* ── Charge PDF.js depuis CDN ── */
function loadPDFJS(cb) {
  if (window.pdfjsLib) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload = () => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    cb();
  };
  document.head.appendChild(s);
}

/* ── Init tous les viewers sur la page ── */
function initAllPDFs() {
  document.querySelectorAll('.pdf-viewer').forEach(el => {
    const id  = el.id;
    const src = el.dataset.src;
    if (!id || !src || PDF_VIEWERS[id]) return;
    loadPDFJS(() => loadPDFViewer(id, src));
  });
}

async function loadPDFViewer(id, src) {
  const el      = document.getElementById(id);
  const canvas  = document.getElementById(id + '_canvas');
  const loading = document.getElementById(id + '_loading');
  if (!el || !canvas) return;

  try {
    const pdf = await pdfjsLib.getDocument(src).promise;
    PDF_VIEWERS[id] = { pdf, cur: 1, total: pdf.numPages };

    // Update page count
    el.querySelectorAll('.pdf-page-info').forEach(pi => {
      pi.innerHTML = `<span class="pdf-cur">1</span> / ${pdf.numPages}`;
    });

    // Hide loading
    if (loading) loading.style.display = 'none';

    // Setup touch/swipe
    setupSwipe(id, el);

    await renderPDFPage(id, 1);
  } catch(e) {
    if (loading) loading.innerHTML = '<span style="color:#ef4444">✗ Impossible de charger le PDF.</span>';
    console.warn('PDF load error:', e);
  }
}

async function renderPDFPage(id, pageNum) {
  const state  = PDF_VIEWERS[id];
  const canvas = document.getElementById(id + '_canvas');
  if (!state || !canvas) return;

  const page    = await state.pdf.getPage(pageNum);
  const wrap    = canvas.parentElement;
  const maxW    = wrap.offsetWidth || 760;
  const viewport= page.getViewport({ scale: 1 });
  const scale   = maxW / viewport.width;
  const scaled  = page.getViewport({ scale });

  canvas.width  = scaled.width;
  canvas.height = scaled.height;

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport: scaled,
  }).promise;

  // Update UI
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelectorAll('.pdf-cur').forEach(s => s.textContent = pageNum);
  el.querySelectorAll('.pdf-prev').forEach(b => b.disabled = pageNum <= 1);
  el.querySelectorAll('.pdf-next').forEach(b => b.disabled = pageNum >= state.total);

  // Slide animation
  canvas.classList.add('pdf-slide-in');
  setTimeout(() => canvas.classList.remove('pdf-slide-in'), 350);
}

function pdfPrev(id) {
  const state = PDF_VIEWERS[id];
  if (!state || state.cur <= 1) return;
  state.cur--;
  renderPDFPage(id, state.cur);
}

function pdfNext(id) {
  const state = PDF_VIEWERS[id];
  if (!state || state.cur >= state.total) return;
  state.cur++;
  renderPDFPage(id, state.cur);
}

/* ── Swipe tactile ── */
function setupSwipe(id, el) {
  let startX = 0;
  el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return;
    dx < 0 ? pdfNext(id) : pdfPrev(id);
  }, {passive:true});
}

/* ── Réinitialise quand le contenu change (SPA) ── */
const _pdfObs = new MutationObserver(() => {
  document.querySelectorAll('.pdf-viewer').forEach(el => {
    if (!PDF_VIEWERS[el.id]) {
      loadPDFJS(() => loadPDFViewer(el.id, el.dataset.src));
    }
  });
});
document.addEventListener('DOMContentLoaded', () => {
  _pdfObs.observe(document.body, { childList:true, subtree:true });
  initAllPDFs();
});
