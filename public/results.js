'use strict';

const els = {
  form: document.getElementById('resultsForm'),
  urlInput: document.getElementById('resultsUrl'),
  statusPill: document.getElementById('statusPill'),
  resultsMeta: document.getElementById('resultsMeta'),

  siteHost: document.getElementById('siteHost'),
  siteTitle: document.getElementById('siteTitle'),

  coreSwatches: document.getElementById('coreSwatches'),
  accentSwatches: document.getElementById('accentSwatches'),
  paletteSummary: document.getElementById('paletteSummary'),
  btnCopyAllCore: document.getElementById('btnCopyAllCore'),

  bodyFont: document.getElementById('bodyFont'),
  headingFont: document.getElementById('headingFont'),
  weights: document.getElementById('weights'),

  h1Size: document.getElementById('h1Size'),
  h2Size: document.getElementById('h2Size'),
  h3Size: document.getElementById('h3Size'),
  bodySize: document.getElementById('bodySize'),

  radiiChips: document.getElementById('radiiChips'),
  spacingChips: document.getElementById('spacingChips'),
  shadowStack: document.getElementById('shadowStack'),

  cssPreview: document.getElementById('cssPreview'),
  jsonPreview: document.getElementById('jsonPreview'),

  btnCopyCss: document.getElementById('btnCopyCss'),
  btnCopyJson: document.getElementById('btnCopyJson'),
  btnDownloadJson: document.getElementById('btnDownloadJson'),

  toast: document.getElementById('toast'),
  modeToggle: document.getElementById('modeToggle'),
  modeLight: document.getElementById('modeLight'),
  modeDark: document.getElementById('modeDark'),
  contrastRows: document.getElementById('contrastRows'),
  fontPreview: document.getElementById('fontPreview'),
  componentTokens: document.getElementById('componentTokens'),
  twPreview: document.getElementById('twPreview'),
  btnCopyTw: document.getElementById('btnCopyTw'),
  errorState: document.getElementById('errorState'),
  errorCode: document.getElementById('errorCode'),
  errorTitle: document.getElementById('errorTitle'),
  errorMsg: document.getElementById('errorMsg'),
  errorHint: document.getElementById('errorHint'),
  btnRetry: document.getElementById('btnRetry'),
  skeleton: document.getElementById('skeleton'),
  contentGrid: document.getElementById('contentGrid'),
};


function showErrorState(payload){
  if (!els.errorState) return;
  els.errorState.classList.remove('is-hidden');
  if (els.contentGrid) els.contentGrid.classList.add('is-hidden');

  const code = payload?.code || 'failed';
  const title = payload?.title || 'We couldn’t extract this site';
  const msg = payload?.message || 'Try another website and try again.';
  const hint = payload?.hint || '';

  if (els.errorCode) els.errorCode.textContent = String(code).toLowerCase();
  if (els.errorTitle) els.errorTitle.textContent = title;
  if (els.errorMsg) els.errorMsg.textContent = msg;
  if (els.errorHint) els.errorHint.textContent = hint;

  setExportEnabled(false);
}

function hideErrorState(){
  if (!els.errorState) return;
  els.errorState.classList.add('is-hidden');
}

function setSkeleton(isLoading){
  if (els.skeleton) els.skeleton.classList.toggle('is-hidden', !isLoading);
  if (els.contentGrid) els.contentGrid.classList.toggle('is-hidden', isLoading);
}

let lastKit = null;
let lastVariants = null;
    if (els.modeToggle) els.modeToggle.classList.add('is-hidden');
let selectedMode = 'light';
let lastCoreCopyText = '';
let toastTimer = null;

function normalizeUrl(value) {
  let v = String(value || '').trim().replace(/\s+/g, '');
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

function setStatus(text, tone = 'idle') {
  els.statusPill.textContent = text;
  els.statusPill.dataset.tone = tone;
}

function showToast(message) {
  if (!els.toast) return;

  els.toast.textContent = message;

  // Reset animation
  els.toast.classList.remove('is-visible');
  // Force reflow
  void els.toast.offsetWidth;

  els.toast.classList.add('is-visible');

  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove('is-visible');
  }, 1400);
}

function clearNodes(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }
}

function swatch(token, hex) {
  const item = document.createElement('div');
  item.className = 'swatchItem';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.setAttribute('data-copy', hex);
  btn.setAttribute('aria-label', `Copy ${token} ${hex}`);
  btn.title = 'Click to copy';
  btn.style.background = hex;

  const label = document.createElement('div');
  label.className = 'swatchToken';
  label.textContent = token;

  const hexEl = document.createElement('div');
  hexEl.className = 'swatchHex mono';
  hexEl.textContent = hex;
  hexEl.setAttribute('data-copy', hex);
  hexEl.title = 'Click to copy';

  item.appendChild(btn);
  item.appendChild(label);
  item.appendChild(hexEl);
  return item;
}

function chip(text) {
  const span = document.createElement('span');
  span.className = 'chip chip--solid mono';
  span.textContent = text;
  span.dataset.copy = text;
  return span;
}

function shadowItem(shadowCss) {
  const wrap = document.createElement('div');
  wrap.className = 'shadowItem';
  wrap.innerHTML = `
    <div class="shadowBox"></div>
    <div class="shadowMeta">
      <div class="mono small">${escapeHtml(shadowCss)}</div>
      <button class="btn btn--ghost btn--sm" type="button" data-copy="${escapeHtml(shadowCss)}">Copy</button>
    </div>
  `;
  wrap.querySelector('.shadowBox').style.boxShadow = shadowCss;
  return wrap;
}


function fontActionsFor(fontName){
  const actions = [];
  if (!fontName) return actions;

  const clean = fontName.replace(/["']/g,'').trim();

  // Heuristic: common Google Fonts families
  const googleCandidates = [
    'Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Nunito',
    'Source Sans 3','Source Sans Pro','DM Sans','Playfair Display','Merriweather'
  ];

  if (googleCandidates.some(f => f.toLowerCase() === clean.toLowerCase())){
    actions.push({
      type:'google',
      label:'Google Fonts',
      href:`https://fonts.google.com/specimen/${encodeURIComponent(clean)}`
    });
  } else if (/^SF |San Francisco|Segoe UI|Helvetica|Arial/i.test(clean)){
    actions.push({
      type:'system',
      label:'System font',
      href:null
    });
  } else {
    actions.push({
      type:'search',
      label:'Search font',
      href:`https://www.google.com/search?q=${encodeURIComponent(clean + ' font')}`
    });
  }

  return actions;
}

function renderFontActions(container, fontName){
  container.innerHTML = '';
  const actions = fontActionsFor(fontName);
  actions.forEach(a => {
    const el = document.createElement(a.href ? 'a' : 'span');
    el.className = 'fontBtn ' + (a.type === 'google' ? 'fontBtn--google' : 'fontBtn--system');
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>${a.label}`;
    if (a.href){
      el.href = a.href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    container.appendChild(el);
  });
}

function hexToRgb(hex){
  const h = String(hex || '').replace('#','');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  if (![r,g,b].every(Number.isFinite)) return null;
  return {r,g,b};
}

function relLum({r,g,b}){
  const srgb = [r,g,b].map(v => v/255).map(c => (c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)));
  return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
}

function contrastRatio(fgHex, bgHex){
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const L1 = relLum(fg);
  const L2 = relLum(bg);
  const hi = Math.max(L1,L2);
  const lo = Math.min(L1,L2);
  return (hi + 0.05) / (lo + 0.05);
}

function wcagBadges(ratio, large=false){
  const aa = ratio >= (large ? 3.0 : 4.5);
  const aaa = ratio >= (large ? 4.5 : 7.0);
  return { aa, aaa };
}

function renderContrast(kit){
  if (!els.contrastRows) return;
  els.contrastRows.innerHTML = '';
  const p = kit.palette || {};
  const checks = [
    { name: 'text on background', fg: p.text, bg: p.background },
    { name: 'text on surface', fg: p.text, bg: p.surface },
    { name: 'primary on background', fg: p.primary, bg: p.background },
    { name: 'link on background', fg: p.link, bg: p.background },
  ];

  checks.forEach(c => {
    if (!c.fg || !c.bg) return;
    const ratio = contrastRatio(c.fg, c.bg);
    if (!ratio) return;

    const { aa, aaa } = wcagBadges(ratio, false);
    const row = document.createElement('div');
    row.className = 'contrastRow';
    row.innerHTML = `<div class="name">${c.name} <span class="mono">(${ratio.toFixed(2)}:1)</span></div>
      <div class="badges">
        <span class="badgePill ${aa ? 'ok' : 'err'}">AA</span>
        <span class="badgePill ${aaa ? 'ok' : 'warn'}">AAA</span>
      </div>`;
    els.contrastRows.appendChild(row);
  });

  if (!els.contrastRows.childElementCount){
    const d = document.createElement('div');
    d.className = 'small';
    d.textContent = 'No contrast data available.';
    els.contrastRows.appendChild(d);
  }
}

function tailwindFromKit(kit){
  const p = kit.palette || {};
  const t = kit.typography || {};
  const fontBody = t.bodyFont ? String(t.bodyFont).replace(/["']/g,'').trim() : '';
  const fontHead = t.headingFont ? String(t.headingFont).replace(/["']/g,'').trim() : '';

  const colors = {
    bg: p.background || '',
    surface: p.surface || '',
    text: p.text || '',
    muted: p.mutedText || '',
    border: p.border || '',
    primary: p.primary || '',
    link: p.link || ''
  };

  const accentLines = (p.accents || []).slice(0,6).map((c,i)=>`      accent${i+1}: '${c}',`).join('\n');

  return `// tailwind.config.js (snippet)\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        brand: {\n          bg: '${colors.bg}',\n          surface: '${colors.surface}',\n          text: '${colors.text}',\n          muted: '${colors.muted}',\n          border: '${colors.border}',\n          primary: '${colors.primary}',\n          link: '${colors.link}',\n${accentLines ? accentLines + '\n' : ''}        }\n      },\n      fontFamily: {\n        body: [${fontBody ? `'${fontBody}',` : ''} 'ui-sans-serif','system-ui'],\n        heading: [${fontHead ? `'${fontHead}',` : ''} 'ui-sans-serif','system-ui'],\n      }\n    }\n  }\n};`;
}

function renderFontPreview(kit){
  if (!els.fontPreview) return;
  const t = kit.typography || {};
  const body = t.bodyFont ? String(t.bodyFont).replace(/["']/g,'').trim() : '';
  const head = t.headingFont ? String(t.headingFont).replace(/["']/g,'').trim() : body;
  const h = els.fontPreview.querySelector('.fontPreview__h');
  const p = els.fontPreview.querySelector('.fontPreview__p');
  if (h) h.style.fontFamily = head ? `${head}, Inter, system-ui, sans-serif` : '';
  if (p) p.style.fontFamily = body ? `${body}, Inter, system-ui, sans-serif` : '';
}

function renderComponents(kit){
  if (!els.componentTokens) return;
  els.componentTokens.innerHTML = '';
  const data = kit.components || null;

  if (!data || (!data.button && !data.input && !data.card)){
    const d = document.createElement('div');
    d.className = 'small';
    d.textContent = 'No component tokens detected.';
    els.componentTokens.appendChild(d);
    return;
  }

  const renderBlock = (name, obj) => {
    if (!obj) return;
    const wrap = document.createElement('div');
    wrap.className = 'compBlock';
    wrap.innerHTML = `<div class="compTitle">${name}</div><div class="compGrid"></div>`;
    const grid = wrap.querySelector('.compGrid');
    Object.entries(obj).forEach(([k,v])=>{
      if (!v) return;
      const ch = document.createElement('span');
      ch.className = 'chip chip--solid mono';
      ch.textContent = `${k}: ${v}`;
      ch.dataset.copy = String(v);
      grid.appendChild(ch);
    });
    els.componentTokens.appendChild(wrap);
  };

  renderBlock('button', data.button);
  renderBlock('input', data.input);
  renderBlock('card', data.card);
}


function cssVarsFromKit(kit) {
  const p = kit.palette || {};
  const t = kit.typography || {};
  const ui = kit.ui || {};

  const lines = [];
  lines.push(':root {');
  if (p.background) lines.push(`  --bg: ${p.background};`);
  if (p.surface) lines.push(`  --surface: ${p.surface};`);
  if (p.text) lines.push(`  --text: ${p.text};`);
  if (p.mutedText) lines.push(`  --muted-text: ${p.mutedText};`);
  if (p.border) lines.push(`  --border: ${p.border};`);
  if (p.primary) lines.push(`  --primary: ${p.primary};`);
  if (p.link) lines.push(`  --link: ${p.link};`);
  (p.accents || []).slice(0, 6).forEach((c, i) => lines.push(`  --accent-${i + 1}: ${c};`));

  if (t.bodyFont) lines.push(`  --font-body: ${JSON.stringify(t.bodyFont)};`);
  if (t.headingFont) lines.push(`  --font-heading: ${JSON.stringify(t.headingFont)};`);

  (ui.radii || []).slice(0, 6).forEach((r, i) => lines.push(`  --radius-${i + 1}: ${r};`));
  (ui.shadows || []).slice(0, 4).forEach((s, i) => lines.push(`  --shadow-${i + 1}: ${s};`));
  (ui.spacing || []).slice(0, 10).forEach((sp, i) => lines.push(`  --space-${i + 1}: ${sp};`));

  lines.push('}');
  return lines.join('\n');
}

function getActiveKit(){
  if (lastVariants && selectedMode === 'dark' && lastVariants.dark) return lastVariants.dark;
  return lastKit;
}

function setExportEnabled(enabled) {
  els.btnCopyCss.disabled = !enabled;
  els.btnCopyJson.disabled = !enabled;
  els.btnDownloadJson.disabled = !enabled;

  if (els.btnCopyAllCore) els.btnCopyAllCore.disabled = !enabled;
  if (els.btnCopyTw) els.btnCopyTw.disabled = !enabled;
}

function renderKit(kit) {
  lastKit = kit;

  els.siteHost.textContent = kit.meta?.host || '—';
  els.siteTitle.textContent = kit.meta?.title || '—';
  els.resultsMeta.textContent = kit.meta?.url || '—';

  const p = kit.palette || {};
  clearNodes(els.coreSwatches);
  clearNodes(els.accentSwatches);

  const corePairs = [
    ['Background', p.background],
    ['Surface', p.surface],
    ['Text', p.text],
    ['Muted', p.mutedText],
    ['Border', p.border],
    ['Primary', p.primary],
    ['Link', p.link],
  ].filter(([,v]) => !!v);

  // Render core (max 6 to match grid density)
  corePairs.slice(0, 6).forEach(([label, v]) => els.coreSwatches.appendChild(swatch(String(label).toLowerCase(), v)));

  // Accents
  (p.accents || []).slice(0, 6).forEach((v, i) => els.accentSwatches.appendChild(swatch(`accent ${i+1}`, v)));

  // Summary line (existing behavior)
  els.paletteSummary.textContent = corePairs.length
    ? `Core colors: ${corePairs.map(([l,v]) => `${l} ${v}`).join(' • ')}`
    : 'No colors detected.';

  renderContrast(kit);
  renderFontPreview(kit);
  renderComponents(kit);
  if (els.twPreview) els.twPreview.textContent = tailwindFromKit(kit);

  // Copy-all text (newline format)
  lastCoreCopyText = corePairs.length
    ? corePairs.map(([l,v]) => `${l}: ${v}`).join('\n')
    : '';

  const t = kit.typography || {};
  els.bodyFont.textContent = t.bodyFont || '—';
  renderFontActions(document.getElementById('bodyFontActions'), t.bodyFont);
  els.headingFont.textContent = t.headingFont || '—';
  renderFontActions(document.getElementById('headingFontActions'), t.headingFont);
  els.weights.textContent = Array.isArray(t.weights) && t.weights.length ? t.weights.map(w => w.value).join(', ') : '—';

  els.h1Size.textContent = t.sizeScale?.h1 || '—';
  els.h2Size.textContent = t.sizeScale?.h2 || '—';
  els.h3Size.textContent = t.sizeScale?.h3 || '—';
  els.bodySize.textContent = t.sizeScale?.body || '—';

  const ui = kit.ui || {};
  clearNodes(els.radiiChips);
  (ui.radii || []).slice(0, 10).forEach(r => els.radiiChips.appendChild(chip(r)));

  clearNodes(els.spacingChips);
  (ui.spacing || []).slice(0, 14).forEach(s => els.spacingChips.appendChild(chip(s)));

  clearNodes(els.shadowStack);
  const sh = ui.shadows || [];
  if (sh.length) sh.slice(0, 4).forEach(s => els.shadowStack.appendChild(shadowItem(s)));
  else {
    const d = document.createElement('div');
    d.className = 'small';
    d.textContent = 'No shadows detected.';
    els.shadowStack.appendChild(d);
  }

  els.cssPreview.textContent = cssVarsFromKit(kit);
  els.jsonPreview.textContent = JSON.stringify(kit, null, 2);

  setExportEnabled(true);
}

async function extract(url) {
  hideErrorState();
  setStatus('Extracting…', 'loading');
  setSkeleton(true);
  setExportEnabled(false);

  try {
    const qs = new URLSearchParams({ url });
    const r = await fetch(`/api/extract?${qs.toString()}`);
    const data = await r.json();

    if (!data.ok){
      setSkeleton(false);
      if (els.modeToggle) els.modeToggle.classList.add('is-hidden');
      showErrorState(data);
      setStatus('Failed', 'err');
      return;
    }
    if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);

    lastVariants = data.variants || { light: data.kit, dark: null };
    selectedMode = 'light';
    if (els.modeToggle){
      const show = !!data.darkModeDetected && !!(lastVariants && lastVariants.dark);
      els.modeToggle.classList.toggle('is-hidden', !show);
      if (els.modeLight) { els.modeLight.classList.add('is-active'); els.modeLight.setAttribute('aria-selected','true'); }
      if (els.modeDark) { els.modeDark.classList.remove('is-active'); els.modeDark.setAttribute('aria-selected','false'); }
    }
    hideErrorState();
    renderKit(data.kit);
    setSkeleton(false);
    setStatus(`Done • ${data.ms}ms`, 'ok');
    showToast('Extracted successfully');
  } catch (e) {
    lastKit = null;
    lastCoreCopyText = '';
    els.siteHost.textContent = '—';
    els.siteTitle.textContent = '—';
    els.paletteSummary.textContent = 'No data yet.';
    els.cssPreview.textContent = '/* extract a kit to generate CSS */';
    els.jsonPreview.textContent = '{}';
    clearNodes(els.coreSwatches);
    clearNodes(els.accentSwatches);
    setExportEnabled(false);

    const msg = e instanceof Error ? e.message : 'Unknown error';
    setSkeleton(false);
    setStatus(msg, 'err');
    showToast(msg);
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = normalizeUrl(els.urlInput.value);
  if (!url) {
    els.urlInput.focus();
    els.urlInput.setCustomValidity('Enter a valid domain like example.com');
    els.form.reportValidity();
    els.urlInput.setCustomValidity('');
    return;
  }
  extract(url);
});

// Click-to-copy for anything with data-copy
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-copy]');
  if (!el) return;

  const text = el.getAttribute('data-copy') || '';
  if (!text) return;

  const ok = await copyToClipboard(text);
  if (ok) showToast(`Copied ${text}`);
  else showToast('Copy failed');
});

els.btnCopyCss.addEventListener('click', async () => {
  const kit = getActiveKit();
  if (!kit) return;
  const ok = await copyToClipboard(cssVarsFromKit(kit));
  showToast(ok ? 'Copied CSS variables' : 'Copy failed');
});

els.btnCopyJson.addEventListener('click', async () => {
  const kit = getActiveKit();
  if (!kit) return;
  const ok = await copyToClipboard(JSON.stringify(kit, null, 2));
  showToast(ok ? 'Copied JSON' : 'Copy failed');
});

els.btnCopyTw.addEventListener('click', async () => {
  const kit = getActiveKit();
  if (!kit) return;
  const ok = await copyToClipboard(tailwindFromKit(kit));
  showToast(ok ? 'Copied Tailwind export' : 'Copy failed');
});

els.btnDownloadJson.addEventListener('click', () => {
  const kit = getActiveKit();
  if (!kit) return;
  const blob = new Blob([JSON.stringify({ variants: lastVariants, active: selectedMode, kit }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const host = kit.meta?.host ? String(kit.meta.host).replaceAll(':', '_') : 'site';
  a.href = URL.createObjectURL(blob);
  a.download = `brandkit-${host}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  showToast('Downloaded JSON');
});

if (els.btnCopyAllCore) {
  els.btnCopyAllCore.addEventListener('click', async () => {
    if (!lastCoreCopyText) return;
    const ok = await copyToClipboard(lastCoreCopyText);
    showToast(ok ? 'Copied all core colors' : 'Copy failed');
  });
}

if (els.modeLight && els.modeDark){
  els.modeLight.addEventListener('click', () => {
    if (!lastVariants) return;
    selectedMode = 'light';
    els.modeLight.classList.add('is-active');
    els.modeDark.classList.remove('is-active');
    els.modeLight.setAttribute('aria-selected','true');
    els.modeDark.setAttribute('aria-selected','false');
    renderKit(lastVariants.light || lastKit);
    showToast('Showing light tokens');
  });
  els.modeDark.addEventListener('click', () => {
    if (!lastVariants || !lastVariants.dark) return;
    selectedMode = 'dark';
    els.modeDark.classList.add('is-active');
    els.modeLight.classList.remove('is-active');
    els.modeDark.setAttribute('aria-selected','true');
    els.modeLight.setAttribute('aria-selected','false');
    renderKit(lastVariants.dark);
    showToast('Showing dark tokens');
  });
}

// Auto-run if url query param exists
const params = new URLSearchParams(window.location.search);
const initialUrl = params.get('url');
if (initialUrl) {
  els.urlInput.value = initialUrl;
  const normalized = normalizeUrl(initialUrl);
  if (normalized) extract(normalized);
} else {
  setSkeleton(false);
  if (els.modeToggle) els.modeToggle.classList.add('is-hidden');
  setStatus('Ready', 'idle');
  setExportEnabled(false);
}
