import { KDP, TRIMS, PAPERS, coverSpec } from './kdp-specs.js';
import { loadAllFonts, FONT_PAIRS, FONT_FILES, fam } from './fonts.js';
import { ICON_IDS, iconSvg } from './icons.js';
import { images, drawLogo, drawBadge, renderCover, LOGO_LAYOUTS, LOGO_DEFAULT_ROLES, role } from './draw.js';
import { renderPage, renderGuide, renderShelf, frontThumb } from './draw2.js';
import { PRESETS, extractPalette, contrast, rate, fixContrast, printWarn, colorName, hexToHsl } from './color.js';
import { newProject, ensureBooks, addImage, autosave, loadAutosave, clearAutosave, saveSbk, openSbk, normalize } from './store.js';
import { demoProject } from './demo.js';
import { ART_STYLES, RULE_SUGGESTIONS, styleBlock, characterBlocks, coverPrompt, interiorPrefix } from './prompt.js';
import { makers, slug, download, tick, toBlob } from './exporter.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RNAMES = ['primary', 'secondary', 'accent', 'background', 'textDark', 'textLight'];

let P = newProject(); ensureBooks(P, 3);
let step = 0, bi = 0, zoom = 1, dirty = false, autosaveOn = true;
const ui = { guides: { cut: true, bleed: true, safe: true, spine: true, barcode: true }, all: false, pageKind: 'title', guidePage: 0, shelfStyle: 'row', shelfRatio: 'square', focus: 0, bleedPages: true };
const visited = new Set([0]);
let undoStack = [], redoStack = [], lastSnap = '';
let info = null, stageCanvas = null;

/* ---------- toast / dialog / progress ---------- */
let toastT;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 3200); }
function ask(title, body, yes = 'Continue', no = 'Cancel') {
  return new Promise((res) => { const d = $('#dlg'); d.innerHTML = `<h4>${esc(title)}</h4><p>${body}</p><div class="btns">${no ? `<button class="btn line" value="no">${no}</button>` : ''}<button class="btn" value="yes">${yes}</button></div>`; d.onclose = () => res(d.returnValue === 'yes'); d.querySelectorAll('button').forEach((b) => (b.onclick = () => { d.returnValue = b.value; d.close(); })); d.returnValue = 'no'; d.showModal(); });
}
const progress = (() => { const el = $('#progress'), bar = $('i', el), lab = $('span', el); return { start() { el.hidden = false; bar.style.width = '0'; lab.textContent = ''; }, set(i, n, name) { bar.style.width = (100 * i / n) + '%'; lab.textContent = `Exporting ${name} (${i + 1}/${n})`; }, end() { bar.style.width = '100%'; setTimeout(() => (el.hidden = true), 400); } }; })();

/* ---------- state helpers ---------- */
const getP = (path) => path.split('.').reduce((o, k) => o?.[k], P);
function setP(path, val) { const ks = path.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], P)[last] = val; }
const snap = () => JSON.stringify(P);
function commit() { const s = snap(); if (s !== lastSnap) { undoStack.push(lastSnap); if (undoStack.length > 50) undoStack.shift(); redoStack = []; lastSnap = s; } dirty = true; queueAutosave(); }
function restore(s) { P = normalize(JSON.parse(s)); lastSnap = s; ensureNames(); render(true); queueAutosave(); }
function undo() { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); }
let asT; function queueAutosave() { if (!autosaveOn) return; clearTimeout(asT); asT = setTimeout(async () => { try { await autosave(P); } catch { if (autosaveOn) { autosaveOn = false; toast('Autosave is off in this browser. Save your project file to keep your work.', true); } } }, 5000); }
const ensureNames = () => { $('#projName').textContent = P.series.name || 'Untitled series'; };
const slugP = () => slug(P.series.name);

/* ---------- image intake ---------- */
async function pickImage(file) {
  if (!file) return null;
  if (file.size > 25 * 1024 * 1024) { toast('Image is too large (max 25 MB).', true); return null; }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast("We couldn't open this image. Try a PNG or JPG.", true); return null; }
  try { return await addImage(file, undefined, file.name); } catch { toast("We couldn't open this image. Try a PNG or JPG.", true); return null; }
}
function chooseFile() { return new Promise((res) => { const i = $('#fileImg'); i.value = ''; i.onchange = () => res(i.files[0]); i.click(); }); }

/* ---------- steps ---------- */
const STEPS = ['Setup', 'Colors', 'Fonts', 'Logo', 'Book badge', 'Covers', 'Series pages', 'AI style prompt', 'Style guide', 'Showcase'];
function setupOk() { const s = P.series; return s.name.length >= 2 && s.name.length <= 40 && s.author.trim().length > 0; }
function isDone(i) {
  if (i === 0) return setupOk();
  if (i === 1) return !!P.palette.sourceImageId || !!P.palette.preset;
  if (i === 5) return P.books.length > 0 && P.books.every((b) => b.title && b.imageId);
  if (i === 7) return P.stylePrompt.heroes.length > 0;
  return visited.has(i) && i !== 0;
}
function renderRail() {
  $('#rail').innerHTML = '<div class="cap">Steps</div>' + STEPS.map((s, i) => `<button class="step ${i === step ? 'on' : ''} ${isDone(i) ? 'done' : ''}" data-step="${i}"><span class="n">${isDone(i) ? '✓' : i + 1}</span>${s}</button>`).join('');
}
$('#rail').addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) { step = +b.dataset.step; visited.add(step); render(true); } });

/* ---------- panel builders ---------- */
const H = (t, lead, help) => `<h2>${t}<span class="dot">.</span></h2><p class="lead">${lead}</p>${help ? `<details class="help"><summary>What is this?</summary><p>${help}</p></details>` : ''}`;
const field = (label, inner, note) => `<div class="f"><label>${label}</label>${inner}${note ? `<div class="note">${note}</div>` : ''}</div>`;
const inp = (path, o = {}) => `<input type="${o.type || 'text'}" data-p="${path}" ${o.t ? `data-t="${o.t}"` : ''} value="${esc(getP(path))}" ${o.attrs || ''} ${o.re ? 'data-re="1"' : ''}>`;
const sel = (path, opts, o = {}) => `<select data-p="${path}" ${o.re ? 'data-re="1"' : ''}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(getP(path)) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const chk = (path, label, o = {}) => `<label class="chk"><input type="checkbox" data-p="${path}" data-t="c" ${getP(path) ? 'checked' : ''} ${o.re ? 'data-re="1"' : ''}>${label}</label>`;
const range = (path, min, max, stepv) => `<input type="range" data-p="${path}" data-t="n" min="${min}" max="${max}" step="${stepv}" value="${getP(path)}">`;
const roleSel = (path) => sel(path, RNAMES.map((r) => [r, r]));

function panelSetup() {
  const s = P.series, errName = s.name && (s.name.length < 2 || s.name.length > 40);
  return H('Set up your series', 'Start with the basics — everything else reads from here.', 'Every other step uses this info. You can change it later; covers and logos redraw automatically.') +
    `<div class="btns" style="margin-bottom:14px"><button class="btn mustard sm" data-act="demo">Load demo project</button></div>` +
    field('Series name', `<input type="text" data-p="series.name" maxlength="40" value="${esc(s.name)}" class="${errName ? 'err' : ''}" placeholder="Little Nature Detectives">`, '2–40 characters') +
    field('Tagline (optional)', inp('series.tagline', { attrs: 'maxlength="60"' }), '60 characters max') +
    field('Author name', inp('series.author', { attrs: 'maxlength="40"' })) +
    `<div class="grid2">${field('Age range', sel('series.ageRange', ['0-3', '3-5', '3-7', '4-8', '6-9'].map((x) => [x, x])))}${field('Planned books', `<input type="number" id="plan" min="1" max="12" value="${P.books.length}">`)}</div>` +
    '<h3>Print</h3>' +
    `<div class="grid2">${field('Trim size (in)', sel('print.trim', Object.keys(TRIMS).map((x) => [x, x.replace('x', ' × ')])))}${field('Default page count', `<input type="number" id="pages" min="${KDP.MIN_PAGES}" step="2" value="${P.print.pages}">`, `Even, min ${KDP.MIN_PAGES}`)}</div>` +
    field('Paper', sel('print.paper', Object.entries(PAPERS))) +
    (() => { const sp = coverSpec(P.print.trim, P.print.pages, P.print.paper); return `<div class="card"><span class="lbl">Full cover</span><b>${sp.coverW.toFixed(4)} × ${sp.coverH.toFixed(4)} in</b><div class="note">${sp.pxW} × ${sp.pxH} px at 300 DPI · spine ${sp.spine.toFixed(4)} in</div></div>`; })();
}

function contrastRows() {
  const L = P.logo.colorRoles, pl = P.palette;
  const rows = [
    ['Logo text on logo shape', pl[L.text], pl[L.fill], 3, 'logo'], ['Dark text on background (back cover)', pl.textDark, pl.background, 4.5, 'textDark'], ['Light text on primary (title band)', pl.textLight, pl.primary, 3, 'textLight'],
  ];
  return rows.map(([label, fg, bg, need, key]) => { const r = contrast(fg, bg), q = rate(r, need); return `<div class="contrast"><span>${label} <small>${r.toFixed(1)}:1</small></span><span class="tag ${q === 'Good' ? 'ok' : q === 'Fair' ? 'warn' : 'bad'}">${q}</span>${q === 'Poor' ? `<button class="btn sm line" data-act="fixc" data-k="${key}">Fix</button>` : ''}</div>`; }).join('');
}
function panelColors() {
  const pl = P.palette;
  return H('Series colors', 'One picture in, one palette out.', 'We pull 6 colors from your best picture and give each a role (primary, accent…). Everything else uses roles, so changing a color here recolors the whole series.') +
    `<div class="drop" id="dropImg" data-act="pickSrc">${pl.sourceImageId && images.has(pl.sourceImageId) ? 'Image loaded — click to replace' : 'Drop a cover or best page here (PNG/JPG/WebP, max 25 MB)'}</div>` +
    `<div class="btns" style="margin:10px 0 14px"><button class="btn sm" data-act="reextract" ${pl.sourceImageId ? '' : 'disabled'}>Re-extract</button>${P.books.find((b) => b.imageId) ? '<button class="btn sm line" data-act="useBook1">Use Book 1 art</button>' : ''}</div>` +
    `<div class="sw">${RNAMES.map((r) => { const hex = pl[r], [h, s, l] = hexToHsl(hex); return `<div class="swatch" draggable="true" data-role="${r}"><div class="c" style="background:${hex}"><input type="color" value="${hex.toLowerCase()}" data-color="${r}" aria-label="${r}"><button class="lk ${pl.locked.includes(r) ? 'on' : ''}" data-lock="${r}" title="Lock">${pl.locked.includes(r) ? '🔒' : '🔓'}</button></div><div class="t">${r}<input type="text" value="${hex}" data-hex="${r}" maxlength="7"><div class="hsl">H${Math.round(h)} S${Math.round(s * 100)} L${Math.round(l * 100)} · ${colorName(hex)}</div>${printWarn(hex) ? '<div class="hsl" style="color:#c98a0b">May print slightly duller</div>' : ''}</div></div>`; }).join('')}</div>` +
    '<div class="note">Drag one swatch onto another to swap roles. Locked colors are kept when re-extracting.</div>' +
    '<h3>Seasonal presets</h3><div class="btns">' + Object.keys(PRESETS).map((k) => `<button class="btn sm line" data-act="preset" data-k="${k}">${k}</button>`).join('') + '</div>' +
    '<h3>Contrast check</h3>' + contrastRows() +
    '<div class="note">Colors that are very vivid (saturation &gt; 90%) can print duller than on screen.</div>';
}

function panelFonts() {
  const f = P.fonts, name = P.series.name || 'Series Name', t1 = P.books[0]?.title || 'Book Title';
  return H('Font pair', 'One pair for the whole series.', 'Each series uses exactly one pair: a title font (series and book names) and a body font (author, back cover, interior pages). Only fonts with commercial-safe licenses (OFL / Apache 2.0) are offered, so every file you sell is legal.') +
    `<div class="fgrid">${Object.entries(FONT_PAIRS).map(([id, fp]) => `<button class="fcard ${f.pairId === id ? 'on' : ''}" data-pair="${id}" style="background:${P.palette.primary}"><b style="font-family:${fam(fp.title)}">${esc(f.caps ? name.toUpperCase() : name)}</b><small style="font-family:${fam(fp.body)}">${esc(t1)}</small><div class="nm">${fp.name}<br>${fp.feel}</div></button>`).join('')}</div>` +
    '<h3>Fine tune</h3>' +
    field(`Title size · ${f.titleScale.toFixed(2)}×`, range('fonts.titleScale', 0.7, 1.4, 0.05)) + field(`Letter spacing · ${f.letterSpacing} px`, range('fonts.letterSpacing', -2, 8, 1)) + field(`Outline · ${f.outline} px @300 DPI`, range('fonts.outline', 0, 12, 1)) +
    chk('fonts.shadow', 'Drop shadow on titles') + chk('fonts.caps', 'ALL CAPS series name');
}

function panelLogo() {
  const L = P.logo, words = (P.series.name || '').trim().split(/\s+/).filter(Boolean);
  return H('Series logo', 'Your series name in a shape that repeats on every cover.', 'The logo is drawn with code, not an uploaded picture, so it stays sharp at any size. Pick a layout, an icon and which palette colors to use.') +
    `<div class="lgrid">${LOGO_LAYOUTS.map((l) => `<button class="lbtn ${L.layout === l ? 'on' : ''}" data-layout="${l}">${l}</button>`).join('')}</div>` +
    '<h3>Icon</h3><div class="igrid">' + `<button class="ibtn none ${L.iconId === 'none' ? 'on' : ''}" data-icon="none">none</button>` + ICON_IDS.map((id) => `<button class="ibtn ${L.iconId === id ? 'on' : ''}" data-icon="${id}" title="${id}">${iconSvg(id, P.palette.accent, '#fff')}</button>`).join('') + '</div>' +
    '<h3>Colors</h3><div class="grid2">' + field('Shape / fill', roleSel('logo.colorRoles.fill')) + field('Text', roleSel('logo.colorRoles.text')) + '</div>' + field('Outline', roleSel('logo.colorRoles.outline')) +
    '<h3>Name layout</h3>' + (words.length > 1 ? field('Words on first line', sel('logo.split', [[0, 'Automatic'], ...words.slice(1).map((_, i) => [i + 1, `${i + 1} word${i ? 's' : ''}`])], { re: 1 }), 'Used by layouts that can use two lines.') : '') +
    (L.layout === 'arch' ? field(`Arc radius · ${L.arc.toFixed(1)}×`, range('logo.arc', 0.6, 2, 0.1)) : '') +
    '<h3>Export</h3><div class="btns"><button class="btn sm" data-act="logoPng">PNG ×3 sizes</button><button class="btn sm" data-act="logoSvg">SVG (outlined text)</button></div><div class="note">PNGs are transparent: 2400, 1200 and 600 px wide.</div>';
}

function panelBadge() {
  const B = P.badge;
  return H('Book badge', 'Tell shoppers which book comes first.', 'The badge uses your logo’s fonts and colors and sits in the same corner on every cover, so parents can spot the collecting order.') +
    `<div class="lgrid" style="grid-template-columns:repeat(4,1fr)">${['circle', 'star', 'tag', 'flag'].map((s) => `<button class="lbtn ${B.style === s ? 'on' : ''}" data-bstyle="${s}">${s}</button>`).join('')}</div>` +
    '<h3>Text</h3>' + field('Label (use {n} for the number)', `<select id="blabel"><option>Book {n}</option><option>Story #{n}</option><option>Adventure {n}</option></select>`) +
    field('Position', sel('badge.position', [['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']])) +
    '<h3>Colors</h3><div class="grid2">' + field('Fill', roleSel('badge.colorRoles.fill')) + field('Number', roleSel('badge.colorRoles.text')) + '</div>' + field('Outline', roleSel('badge.colorRoles.outline')) +
    `<h3>Export</h3><button class="btn sm" data-act="badges">Export all badges (.zip)</button><div class="note">One transparent PNG per book, 1–${P.books.length}.</div>`;
}

function panelCovers() {
  const cur = P.books[bi], im = images.get(cur.imageId);
  const list = P.books.map((b, i) => `<div class="book ${i === bi ? 'cur' : ''}" draggable="true" data-bidx="${i}"><div class="hd" data-pick="${i}"><span class="num">${b.number}</span><div class="thumb" style="${b.imageId && images.get(b.imageId) ? `background-image:url(${thumbUrl(b.imageId)})` : ''}"></div><input type="text" data-p="books.${i}.title" value="${esc(b.title)}" placeholder="Book title"></div>${i === bi ? `<div class="grid2">${field('Subtitle', inp(`books.${i}.subtitle`))}${field('Pages', `<input type="number" data-bpages="${i}" min="${KDP.MIN_PAGES}" step="2" value="${b.pages}">`)}</div><div class="btns" style="margin-bottom:8px"><button class="btn sm line" data-act="bookImg" data-i="${i}">${b.imageId ? 'Replace picture' : 'Add picture'}</button></div>${field(`Back cover description · ${(b.blurb.trim().split(/\s+/).filter(Boolean).length)}/150 words`, `<textarea rows="4" data-p="books.${i}.blurb" data-max="150">${esc(b.blurb)}</textarea>`)}` : ''}</div>`).join('');
  const dpi = info?.dpi;
  return H('Covers', 'One template, every book.', 'Every cover shares the same layout; only the picture, title and number change. The preview shows KDP’s guides (never exported). Drag the picture on the preview to reposition it.') +
    field('Front layout', sel('cover.layoutId', [['classic-top', 'Classic — logo top, title band'], ['classic-bottom', 'Classic — title top, logo bottom'], ['frame', 'Framed picture'], ['cloud-title', 'Cloud title']])) +
    '<h3>Books <small style="font-weight:400;letter-spacing:0;text-transform:none">(drag to reorder)</small></h3><div id="books">' + list + '</div>' +
    (im ? `<h3>Picture · Book ${cur.number}</h3>${field(`Zoom · ${cur.imageCrop.scale.toFixed(2)}×`, `<input type="range" data-p="books.${bi}.imageCrop.scale" data-t="n" min="1" max="3" step="0.05" value="${cur.imageCrop.scale}">`)}<div class="row auto"><button class="btn sm line" data-act="resetCrop">Reset</button>${dpi != null ? `<span class="tag ${dpi >= 300 ? 'ok' : dpi >= 200 ? 'warn' : 'bad'}">${Math.round(dpi)} DPI · ${dpi >= 300 ? 'Print ready' : dpi >= 200 ? 'May look soft' : 'Will print blurry'}</span>` : ''}</div>${dpi != null && dpi < 200 ? '<div class="note">Tip: enlarge the picture with an upscale tool before printing (outside this kit).</div>' : ''}` : '') +
    '<h3>Back &amp; spine</h3>' + field('Spine color', sel('cover.spineColor', [['primary', 'Primary'], ['background', 'Background']])) + chk('cover.backBlur', 'Blurred front picture as back background') + chk('cover.barcodeWhite', 'Fill the barcode box white') +
    '<h3>Preview guides</h3>' + ['cut', 'bleed', 'safe', 'spine', 'barcode'].map((g) => `<label class="chk"><input type="checkbox" data-guide="${g}" ${ui.guides[g] ? 'checked' : ''}>${{ cut: 'Cut line', bleed: 'Bleed area', safe: 'Safe area (0.25 in)', spine: 'Spine lines', barcode: 'Barcode box' }[g]}</label>`).join('') +
    '<h3>Check &amp; export</h3>' + warnHtml(cur) + '<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="coverPdf">Export print cover (PDF)</button><button class="btn sm" data-act="frontJpg">Export front (JPG)</button><button class="btn sm line" data-act="allCovers">Export all covers (.zip)</button></div>';
}
function warnHtml() {
  const w = collectWarnings(bi);
  return w.length ? `<ul class="warnlist">${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<ul class="warnlist"><li class="ok">No issues found for this cover.</li></ul>';
}
function collectWarnings(i) { const c = document.createElement('canvas'); const inf = renderCover(c, P, i, { ppi: 20, thumbOf: null }); return inf.warnings.map((x) => (P.books.length > 1 ? `Book ${P.books[i].number}: ` : '') + x); }
const thumbCache = new Map();
function thumbUrl(id) { const k = id; if (!thumbCache.has(k)) { const im = images.get(id), c = document.createElement('canvas'); c.width = c.height = 76; const x = c.getContext('2d'), s = Math.max(76 / im.w, 76 / im.h); x.drawImage(im.bmp, (76 - im.w * s) / 2, (76 - im.h * s) / 2, im.w * s, im.h * s); thumbCache.set(k, c.toDataURL('image/jpeg', 0.7)); } return thumbCache.get(k); }

function panelPages() {
  return H('Series pages', 'Three pages for inside the book.', 'These pages carry your series identity and cross-sell your other books. Export them as images and add them to your interior (for example with a KDP PDF creator). Content stays 0.375 in from the gutter and 0.25 in from other edges.') +
    field('Book', sel('__pbook', P.books.map((b, i) => [i, `Book ${b.number}${b.title ? ' — ' + b.title : ''}`]))) +
    '<div class="lgrid">' + [['title', 'Title page'], ['belongs', 'Belongs to'], ['collect', 'Collect all']].map(([k, l]) => `<button class="lbtn ${ui.pageKind === k ? 'on' : ''}" data-pkind="${k}">${l}</button>`).join('') + '</div>' +
    '<h3>Export</h3>' + chk('__bleed', 'Include bleed (0.125 in)') + '<div class="btns"><button class="btn sm" data-act="pagesBook">This book (3 PNGs)</button><button class="btn sm line" data-act="pagesAll">All books (.zip)</button></div>' +
    '<div class="note">“Collect them all!” shows “Coming soon” for books without a picture.</div>';
}

function panelPrompt() {
  const s = P.stylePrompt, heroes = s.heroes;
  const blocks = [['Series style block', styleBlock(P)], ...characterBlocks(P).map((t, i) => [`Character lock — ${heroes.filter((h) => h.name)[i].name}`, t]), ['New cover prompt', coverPrompt(P)], ['Interior page prefix', interiorPrefix(P)]];
  return H('AI style prompt', 'Keep every book in the same style.', 'Paste these blocks at the top of your ChatGPT prompts so later books match Book 1. Nothing is sent anywhere — the kit only fills in templates. Color names update when you change the palette.') +
    '<div class="chips">' + ['primary', 'secondary', 'accent', 'background', 'textDark'].map((r) => `<span class="chip"><i style="background:${P.palette[r]}"></i>${colorName(P.palette[r])} ${P.palette[r]}</span>`).join('') + '</div>' +
    field('Art style', `<select id="artSel">${ART_STYLES.map((a) => `<option ${a === (s.artStyle || ART_STYLES[0]) ? 'selected' : ''}>${esc(a)}</option>`).join('')}<option value="__c" ${s.artStyle && !ART_STYLES.includes(s.artStyle) ? 'selected' : ''}>Custom…</option></select>`) +
    (s.artStyle && !ART_STYLES.includes(s.artStyle) ? inp('stylePrompt.artStyle') : '') +
    '<h3>Heroes (max 4)</h3>' + heroes.map((h, i) => `<div class="book"><div class="grid2">${field('Name', inp(`stylePrompt.heroes.${i}.name`))}${field('Species', inp(`stylePrompt.heroes.${i}.species`))}</div>${field('Natural colors', inp(`stylePrompt.heroes.${i}.colors`))}${field('Signature detail that never changes', inp(`stylePrompt.heroes.${i}.detail`))}${field('Personality (one sentence)', inp(`stylePrompt.heroes.${i}.personality`))}<button class="btn sm line" data-act="delHero" data-i="${i}">Remove</button></div>`).join('') +
    (heroes.length < 4 ? '<button class="btn sm line" data-act="addHero">+ Add hero</button>' : '') +
    '<h3>Extra rules</h3>' + RULE_SUGGESTIONS.map((r) => `<label class="chk"><input type="checkbox" data-rule="${esc(r)}" ${s.extraRules.includes(r) ? 'checked' : ''}>${r}</label>`).join('') + `<textarea rows="2" data-p="stylePrompt.extraRules" placeholder="Anything else the model should always do…">${esc(s.extraRules)}</textarea>` +
    '<h3>Prompt blocks</h3>' + blocks.map(([t, txt], i) => `<div class="lbl">${esc(t)}</div><div class="codeblk">${esc(txt)}</div><button class="btn sm" data-copy="${i}">Copy</button><div style="height:12px"></div>`).join('');
}
const promptTexts = () => [styleBlock(P), ...characterBlocks(P), coverPrompt(P), interiorPrefix(P)];

function panelGuide() {
  return H('Style guide', 'A two-page PDF you can keep or share.', 'Page 1 shows your logo, colors, fonts and badge. Page 2 shows how to use them and your print specs.') +
    '<div class="lgrid" style="grid-template-columns:1fr 1fr">' + ['Identity', 'Usage rules'].map((l, i) => `<button class="lbtn ${ui.guidePage === i ? 'on' : ''}" data-gpage="${i}">${l}</button>`).join('') + '</div><h3>Export</h3><button class="btn sm" data-act="guidePdf">Style guide (PDF, Letter)</button>';
}
function panelShowcase() {
  return H('Bookshelf showcase', 'Show the whole set together.', 'Promo images for social media and your listing. Drawn with canvas — no background photo needed.') +
    '<div class="lgrid">' + ['row', 'fan', 'hero'].map((s) => `<button class="lbtn ${ui.shelfStyle === s ? 'on' : ''}" data-shelf="${s}">${s}</button>`).join('') + '</div>' +
    (ui.shelfStyle === 'hero' ? field('Hero book', `<select id="focusSel">${P.books.map((b, i) => `<option value="${i}" ${ui.focus === i ? 'selected' : ''}>Book ${b.number}</option>`).join('')}</select>`) : '') +
    '<h3>Export</h3><div class="btns"><button class="btn sm" data-act="shelfSq">PNG 2000 × 2000</button><button class="btn sm" data-act="shelfWide">PNG 2400 × 1350</button></div>';
}
const PANELS = [panelSetup, panelColors, panelFonts, panelLogo, panelBadge, panelCovers, panelPages, panelPrompt, panelGuide, panelShowcase];

/* ---------- stage ---------- */
const PPI = 100;
function renderStage() {
  const stage = $('#stage'), bar = $('#stageBar');
  const fitBtn = '<button class="btn sm line" data-act="fit">Fit</button>';
  const zoomUi = `<label>Zoom <input type="range" id="zoom" min="0.25" max="2" step="0.05" value="${zoom}" style="width:110px"><b id="zv">${Math.round(zoom * 100)}%</b></label>${fitBtn}`;
  const tabs = `<div class="tabs">${P.books.map((b, i) => `<button class="tab ${i === bi ? 'on' : ''}" data-book="${i}">Book ${b.number}</button>`).join('')}</div>`;
  let cvs = [];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const wrap = document.createElement('div'); wrap.className = 'wrap';
  info = null;
  if (step === 3) {
    const c = mk(1000, 600); let x = c.getContext('2d'); x.fillStyle = role(P, 'background'); x.fillRect(0, 0, 1000, 600); drawLogo(x, P, 0, 0, 1000);
    const c2 = mk(1000, 600); x = c2.getContext('2d'); x.fillStyle = role(P, 'primary'); x.fillRect(0, 0, 1000, 600); drawLogo(x, P, 0, 0, 1000);
    cvs = [[c, 0.6, 'on background'], [c2, 0.6, 'on primary']];
    bar.innerHTML = `<div class="sp"></div>${zoomUi}`;
  } else if (step === 4) {
    cvs = P.books.map((b, i) => { const c = mk(300, 300); drawBadge(c.getContext('2d'), P, b.number, 0, 0, 300); return [c, 1, `Book ${b.number}`]; });
    bar.innerHTML = `<div class="sp"></div>${zoomUi}`;
  } else if (step === 6) {
    const c = mk(1, 1); renderPage(c, P, bi, ui.pageKind, { ppi: 100, bleed: ui.bleedPages, guides: true }); cvs = [[c, 0.72, `${P.books[bi].title || 'Book ' + P.books[bi].number} · ${({ title: 'Series title page', belongs: 'This book belongs to', collect: 'Collect them all!' })[ui.pageKind]}`]];
    bar.innerHTML = `${tabs}<div class="sp"></div>${zoomUi}`;
  } else if (step === 8) {
    const c = mk(1, 1); renderGuide(c, P, ui.guidePage, 100); cvs = [[c, 0.72, `Page ${ui.guidePage + 1} of 2`]];
    bar.innerHTML = `<div class="sp"></div>${zoomUi}`;
  } else if (step === 9) {
    const wide = ui.shelfRatio === 'wide', c = mk(1, 1); renderShelf(c, P, ui.shelfStyle, wide ? 1200 : 1000, wide ? 675 : 1000, ui.focus); cvs = [[c, 1, '']];
    bar.innerHTML = `<div class="seg"><button data-ratio="square" class="${!wide ? 'on' : ''}">1:1</button><button data-ratio="wide" class="${wide ? 'on' : ''}">16:9</button></div><div class="sp"></div>${zoomUi}`;
  } else if (step === 5 && ui.all) {
    cvs = P.books.map((b, i) => { const c = mk(1, 1); const inf = renderCover(c, P, i, { ppi: PPI, front: true }); if (i === bi) info = inf; return [c, 0.72, `Book ${b.number}`, i]; });
    bar.innerHTML = `${tabs}<div class="seg"><button data-all="0">Full wrap</button><button data-all="1" class="on">All books</button></div><div class="sp"></div>${zoomUi}`;
  } else {
    const c = mk(1, 1); info = renderCover(c, P, bi, { ppi: PPI, guides: ui.guides && step === 5 ? ui.guides : null, thumbOf: (i, h) => frontThumb(P, i, h) });
    cvs = [[c, 0.72, `${P.books[bi].title || 'Book ' + P.books[bi].number} — ${info.spec.coverW.toFixed(4)} × ${info.spec.coverH.toFixed(4)} in`]];
    bar.innerHTML = `${tabs}${step === 5 ? '<div class="seg"><button data-all="0" class="on">Full wrap</button><button data-all="1">All books</button></div>' : ''}<div class="sp"></div>${zoomUi}`;
  }
  cvs.forEach(([c, k, label]) => { const cell = document.createElement('div'); cell.className = 'cell'; c.dataset.k = k; cell.appendChild(c); if (label) { const cap = document.createElement('div'); cap.className = 'cap'; cap.textContent = label; cell.appendChild(cap); } wrap.appendChild(cell); });
  stage.innerHTML = ''; stage.appendChild(wrap); stageCanvas = cvs.length ? cvs[0][0] : null;
  applyZoom();
  enableCrop(stageCanvas);
}
function applyZoom() { // k = css px per canvas px at 100% (0.72 for 100-ppi inch canvases = 72 px/in)
  document.querySelectorAll('#stage canvas').forEach((c) => { c.style.width = c.width * (+c.dataset.k || 1) * zoom + 'px'; });
  const zv = $('#zv'); if (zv) zv.textContent = Math.round(zoom * 100) + '%';
}
function fit() {
  const st = $('#stage'); const cs = [...document.querySelectorAll('#stage canvas')]; if (!cs.length) return;
  zoom = 1; applyZoom();
  const total = cs.reduce((a, c) => a + c.getBoundingClientRect().width, 0) + (cs.length - 1) * 24, th = Math.max(...cs.map((c) => c.getBoundingClientRect().height)) + 40;
  zoom = Math.min(2, Math.max(0.25, Math.min((st.clientWidth - 56) / total, (st.clientHeight - 56) / th)));
  zoom = Math.floor(zoom * 20) / 20; render(false, true);
}
function enableCrop(c) {
  if (!c || !info?.artRect || step !== 5 || ui.all) return;
  const book = () => P.books[bi], im = () => images.get(book().imageId); if (!im()) return;
  c.classList.add('grab'); let st = null;
  c.onpointerdown = (e) => { const r = c.getBoundingClientRect(), k = c.width / r.width, px = (e.clientX - r.left) * k / (PPI / 100), f = info.frontFull; if (px < f.x || px > f.x + f.w) return; c.setPointerCapture(e.pointerId); st = { x: e.clientX, y: e.clientY, cx: book().imageCrop.x, cy: book().imageCrop.y }; c.classList.add('grabbing'); };
  c.onpointermove = (e) => {
    if (!st) return; const r = c.getBoundingClientRect(), cu = (c.width / r.width) / (PPI / 100), [ax, ay, aw, ah] = info.artRect, i = im(), cr = book().imageCrop, s = Math.max(aw / i.w, ah / i.h) * Math.max(1, cr.scale), ex = (aw - i.w * s) / 2, ey = (ah - i.h * s) / 2;
    const dx = (e.clientX - st.x) * cu, dy = (e.clientY - st.y) * cu;
    cr.x = Math.max(-1, Math.min(1, st.cx + (ex ? dx / ex : 0))); cr.y = Math.max(-1, Math.min(1, st.cy + (ey ? dy / ey : 0))); queueRender();
  };
  c.onpointerup = () => { if (st) { st = null; c.classList.remove('grabbing'); commit(); render(true); } };
}
let rq; const queueRender = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => render(false, true)); };

/* ---------- master render ---------- */
function render(withPanel = true, stageOnly = false) {
  if (!stageOnly) renderRail();
  if (withPanel && !stageOnly) { const pn = $('#panel'), sy = pn.scrollTop; pn.innerHTML = PANELS[step](); pn.scrollTop = sy; }
  renderStage();
  if (withPanel && step === 5 && !stageOnly) { /* dpi chip depends on stage info */ const pn = $('#panel'), sy = pn.scrollTop; pn.innerHTML = PANELS[step](); pn.scrollTop = sy; bindBlabel(); }
  bindBlabel(); ensureNames();
}
function bindBlabel() { const s = $('#blabel'); if (s) { s.value = P.badge.label; if (s.value !== P.badge.label) { s.add(new Option(P.badge.label, P.badge.label)); s.value = P.badge.label; } s.onchange = () => { P.badge.label = s.value; commit(); render(false, true); }; } }

/* ---------- panel events ---------- */
const panel = $('#panel');
panel.addEventListener('input', (e) => {
  const t = e.target, path = t.dataset.p;
  if (path) {
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.t === 'n') v = +v; if (t.dataset.t === 'c') v = t.checked;
    if (t.dataset.max) { const words = v.trim().split(/\s+/).filter(Boolean); if (words.length > +t.dataset.max) { v = words.slice(0, +t.dataset.max).join(' '); t.value = v; } }
    if (path === '__pbook') { bi = +v; render(true); return; } if (path === '__bleed') { ui.bleedPages = v; render(false, true); return; }
    if (t.type === 'number' || t.type === 'range' || t.type === 'text' || t.tagName === 'TEXTAREA' || t.type === 'checkbox' || t.tagName === 'SELECT') setP(path, t.type === 'number' ? +t.value : v);
    if (path === 'series.name') { t.classList.toggle('err', v && (v.length < 2)); ensureNames(); }
    queueRender();
    const lab = t.closest('.f')?.querySelector('label'); if (t.type === 'range' && lab) lab.textContent = lab.textContent.replace(/·.*$/, '· ' + (path.endsWith('scale') || path.includes('titleScale') ? (+v).toFixed(2) + '×' : path === 'logo.arc' ? (+v).toFixed(1) + '×' : v + (path.includes('letter') || path.includes('outline') ? ' px' : '')));
  }
  if (t.dataset.color) { P.palette[t.dataset.color] = t.value.toUpperCase(); delete P.palette.preset; queueRender(); const hx = t.closest('.swatch').querySelector('[data-hex]'); hx.value = t.value.toUpperCase(); t.parentElement.style.background = t.value; }
});
panel.addEventListener('change', async (e) => {
  const t = e.target, path = t.dataset.p;
  if (path === '__pbook' || path === '__bleed') return;
  if (path === 'logo.layout') return;
  if (t.dataset.color) { commit(); render(true); return; }
  if (t.dataset.hex) { let v = t.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { P.palette[t.dataset.hex] = v.toUpperCase(); delete P.palette.preset; commit(); render(true); } else t.value = P.palette[t.dataset.hex]; return; }
  if (t.dataset.guide) { ui.guides[t.dataset.guide] = t.checked; render(false, true); return; }
  if (t.dataset.rule) { const rules = P.stylePrompt.extraRules.split('\n').filter(Boolean).filter((r) => r !== t.dataset.rule); if (t.checked) rules.push(t.dataset.rule); P.stylePrompt.extraRules = rules.join('\n'); commit(); render(true); return; }
  if (t.id === 'artSel') { P.stylePrompt.artStyle = t.value === '__c' ? 'your custom style here' : t.value; commit(); render(true); return; }
  if (t.id === 'focusSel') { ui.focus = +t.value; render(false, true); return; }
  if (t.id === 'plan') return planBooks(+t.value);
  if (t.id === 'pages') { let n = Math.round(+t.value); if (!(n >= KDP.MIN_PAGES)) n = KDP.MIN_PAGES; if (n % 2) n++; const old = P.print.pages; P.print.pages = n; P.books.forEach((b) => { if (b.pages === old) b.pages = n; }); commit(); render(true); return; }
  if (t.dataset.bpages) { let n = Math.round(+t.value); if (!(n >= KDP.MIN_PAGES)) n = KDP.MIN_PAGES; if (n % 2) n++; P.books[+t.dataset.bpages].pages = n; commit(); render(true); return; }
  if (path === 'print.trim') { const had = P.books.some((b) => b.imageId); setP(path, t.value); commit(); render(true); if (had) toast('Check your cover crops — the frame shape changed.'); return; }
  if (path) { if (t.type !== 'number') setP(path, t.type === 'checkbox' ? t.checked : t.dataset.t === 'n' ? +t.value : t.value); commit(); if (t.dataset.re !== undefined || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || path.startsWith('series.name')) render(true); else render(false, true); }
});
async function planBooks(n) {
  n = Math.max(1, Math.min(12, n || 1));
  if (n < P.books.length && P.books.slice(n).some((b) => b.imageId) && !(await ask('Remove books?', 'The books you are removing already have pictures. Remove them anyway?', 'Remove', 'Keep'))) return render(true);
  ensureBooks(P, n); bi = Math.min(bi, n - 1); commit(); render(true);
}

panel.addEventListener('click', async (e) => {
  const t = e.target.closest('button, .drop'); if (!t) return;
  const d = t.dataset;
  if (d.pair) { P.fonts.pairId = d.pair; commit(); return render(true); }
  if (d.layout) { P.logo.layout = d.layout; P.logo.colorRoles = { ...LOGO_DEFAULT_ROLES[d.layout] }; commit(); return render(true); }
  if (d.icon) { P.logo.iconId = d.icon; commit(); return render(true); }
  if (d.bstyle) { P.badge.style = d.bstyle; commit(); return render(true); }
  if (d.pkind) { ui.pageKind = d.pkind; return render(true); }
  if (d.gpage) { ui.guidePage = +d.gpage; return render(true); }
  if (d.shelf) { ui.shelfStyle = d.shelf; return render(true); }
  if (d.lock) { const l = P.palette.locked, i = l.indexOf(d.lock); i < 0 ? l.push(d.lock) : l.splice(i, 1); commit(); return render(true); }
  if (d.copy !== undefined) { try { await navigator.clipboard.writeText(promptTexts()[+d.copy]); toast('Copied to clipboard'); } catch { toast('Could not copy — select the text manually.', true); } return; }
  if (d.pick !== undefined && !e.target.closest('input')) { bi = +d.pick; return render(true); }
  switch (d.act) {
    case 'demo': { if (P.series.name && !(await ask('Load demo project?', 'This replaces your current project.', 'Load demo'))) return; P = await demoProject(); normalizeAfterLoad(); thumbCache.clear(); toast('Demo project loaded'); return; }
    case 'pickSrc': { const f = await chooseFile(), id = await pickImage(f); if (id) { P.palette.sourceImageId = id; doExtract(true); } return; }
    case 'useBook1': { const b = P.books.find((x) => x.imageId); if (b) { P.palette.sourceImageId = b.imageId; doExtract(true); } return; }
    case 'reextract': return doExtract(false);
    case 'preset': { const pr = PRESETS[d.k]; for (const k in pr) if (!P.palette.locked.includes(k)) P.palette[k] = pr[k]; P.palette.preset = d.k; commit(); return render(true); }
    case 'fixc': { const pl = P.palette, L = P.logo.colorRoles; if (d.k === 'logo') { const r = L.text; pl[r] = fixContrast(pl[r], pl[L.fill], 3); } else if (d.k === 'textDark') pl.textDark = fixContrast(pl.textDark, pl.background, 4.5); else pl.textLight = fixContrast(pl.textLight, pl.primary, 3); commit(); return render(true); }
    case 'bookImg': { const f = await chooseFile(), id = await pickImage(f); if (id) { const b = P.books[+d.i]; b.imageId = id; b.imageCrop = { x: 0, y: 0, scale: 1 }; if (!P.palette.sourceImageId && +d.i === 0) { P.palette.sourceImageId = id; doExtract(true); } commit(); render(true); } return; }
    case 'resetCrop': P.books[bi].imageCrop = { x: 0, y: 0, scale: 1 }; commit(); return render(true);
    case 'addHero': P.stylePrompt.heroes.push({ name: '', species: '', colors: '', detail: '', personality: '' }); commit(); return render(true);
    case 'delHero': P.stylePrompt.heroes.splice(+d.i, 1); commit(); return render(true);
    case 'fit': return fit();
    default: if (d.act) return runExport(d.act);
  }
});
$('#stageBar').addEventListener('click', (e) => { const t = e.target.closest('button'); if (!t) return; const d = t.dataset; if (d.book !== undefined) { bi = +d.book; render(true); } else if (d.all !== undefined) { ui.all = d.all === '1'; render(false, true); } else if (d.ratio) { ui.shelfRatio = d.ratio; render(false, true); } else if (d.act === 'fit') fit(); });
$('#stageBar').addEventListener('input', (e) => { if (e.target.id === 'zoom') { zoom = +e.target.value; applyZoom(); } });

function doExtract(first) {
  const im = images.get(P.palette.sourceImageId); if (!im) return;
  const prev = P.palette, out = extractPalette(im.bmp, prev);
  for (const k of RNAMES) if (!prev.locked.includes(k) && out[k]) prev[k] = out[k];
  delete prev.preset; commit(); render(true); if (first) toast('Palette extracted');
}
// drag to reorder books / swap swatches
let dragIdx = null, dragRole = null;
panel.addEventListener('dragstart', (e) => { const b = e.target.closest('[data-bidx]'), s = e.target.closest('[data-role]'); if (b) { dragIdx = +b.dataset.bidx; b.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'b'); } else if (s) { dragRole = s.dataset.role; e.dataTransfer.setData('text/plain', 'r'); } });
panel.addEventListener('dragover', (e) => { if (e.target.closest('[data-bidx]') || e.target.closest('[data-role]')) { e.preventDefault(); e.target.closest('[data-role]')?.classList.add('over'); } });
panel.addEventListener('dragleave', (e) => e.target.closest('[data-role]')?.classList.remove('over'));
panel.addEventListener('dragend', () => document.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging')));
panel.addEventListener('drop', (e) => {
  const b = e.target.closest('[data-bidx]'), s = e.target.closest('[data-role]');
  if (b && dragIdx !== null) { const to = +b.dataset.bidx, cur = P.books[bi]; const [m] = P.books.splice(dragIdx, 1); P.books.splice(to, 0, m); P.books.forEach((x, i) => (x.number = i + 1)); bi = P.books.indexOf(cur); dragIdx = null; commit(); render(true); }
  else if (s && dragRole && dragRole !== s.dataset.role) { const a = dragRole, c = s.dataset.role, t = P.palette[a]; P.palette[a] = P.palette[c]; P.palette[c] = t; dragRole = null; delete P.palette.preset; commit(); render(true); }
});
panel.addEventListener('dragenter', (e) => e.preventDefault());
// dropping a file on the source drop zone
panel.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.target.closest('.drop')?.classList.add('over'); } });
panel.addEventListener('drop', async (e) => { if (e.dataTransfer?.files?.length && e.target.closest('.drop')) { e.preventDefault(); const id = await pickImage(e.dataTransfer.files[0]); if (id) { P.palette.sourceImageId = id; doExtract(true); } } });

/* ---------- exports ---------- */
async function preflight(indices) {
  const all = indices.flatMap((i) => collectWarnings(i)); if (!all.length) return true;
  return ask('Before you export', `<ul style="padding-left:18px;margin:0">${all.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`, 'Export anyway', 'Cancel');
}
async function runJobs(jobs, zipName) {
  progress.start(); const out = [];
  for (let i = 0; i < jobs.length; i++) { await tick(); out.push(await jobs[i]((n) => progress.set(i, jobs.length, n))); }
  progress.end();
  if (!zipName) { out.forEach((f) => download(f.blob, f.name)); return out; }
  const zip = new JSZip(); out.forEach((f) => zip.file(f.folder ? f.folder + '/' + f.name : f.name, f.blob)); download(await zip.generateAsync({ type: 'blob' }), zipName); return out;
}
async function runExport(act) {
  if (!setupOk() && ['logoPng', 'logoSvg'].indexOf(act) < 0) { /* soft warning only */ }
  try {
    const s = slugP(), idx = P.books.map((_, i) => i);
    switch (act) {
      case 'logoPng': return runJobs([900, 1200, 600].length && [2400, 1200, 600].map((w) => (r) => makers.logoPng(P, w, r)));
      case 'logoSvg': return runJobs([(r) => makers.logoSvg(P, r)]);
      case 'badges': return runJobs(P.books.map((b) => (r) => makers.badge(P, b.number, r)), `${s}-badges.zip`);
      case 'coverPdf': if (await preflight([bi])) return runJobs([(r) => makers.coverPdf(P, bi, r)]); return;
      case 'frontJpg': if (await preflight([bi])) return runJobs([(r) => makers.frontJpg(P, bi, r)]); return;
      case 'allCovers': if (await preflight(idx)) return runJobs(idx.flatMap((i) => [(r) => makers.coverPdf(P, i, r), (r) => makers.frontJpg(P, i, r)]), `${s}-covers.zip`); return;
      case 'pagesBook': return runJobs(['title', 'belongs', 'collect'].map((k) => (r) => makers.page(P, bi, k, ui.bleedPages, r)), `${s}-book${P.books[bi].number}-pages.zip`);
      case 'pagesAll': return runJobs(idx.flatMap((i) => ['title', 'belongs', 'collect'].map((k) => (r) => makers.page(P, i, k, ui.bleedPages, r))), `${s}-series-pages.zip`);
      case 'guidePdf': return runJobs([(r) => makers.guide(P, r)]);
      case 'shelfSq': return runJobs([(r) => makers.shelf(P, ui.shelfStyle, 'square', ui.focus, r)]);
      case 'shelfWide': return runJobs([(r) => makers.shelf(P, ui.shelfStyle, 'wide', ui.focus, r)]);
      case 'everything': {
        if (!(await preflight(idx))) return;
        const tag = (folder, fn) => async (r) => ({ ...(await fn(r)), folder });
        const jobs = [...[2400, 1200, 600].map((w) => tag('logo', (r) => makers.logoPng(P, w, r))), tag('logo', (r) => makers.logoSvg(P, r)),
          ...P.books.map((b) => tag('badges', (r) => makers.badge(P, b.number, r))),
          ...idx.flatMap((i) => [tag('covers', (r) => makers.coverPdf(P, i, r)), tag('covers', (r) => makers.frontJpg(P, i, r))]),
          ...idx.flatMap((i) => ['title', 'belongs', 'collect'].map((k) => tag('series-pages', (r) => makers.page(P, i, k, ui.bleedPages, r)))),
          tag('', (r) => makers.guide(P, r)), ...['row', 'fan', 'hero'].flatMap((st) => ['square', 'wide'].map((ra) => tag('showcase', (r) => makers.shelf(P, st, ra, ui.focus, r)))), tag('', (r) => makers.prompts(P, r))];
        return runJobs(jobs, `${s}-brand-kit.zip`);
      }
    }
  } catch (err) { console.error(err); progress.end(); toast('Export failed: ' + (err.message || err), true); }
}

/* ---------- project actions ---------- */
function normalizeAfterLoad() { P = normalize(P); ensureBooks(P, P.books.length || 3); bi = 0; lastSnap = snap(); undoStack = []; redoStack = []; dirty = false; visited.clear(); visited.add(step); thumbCache.clear(); render(true); queueAutosave(); }
$('#bNew').onclick = async () => { if (dirty && !(await ask('Start a new project?', 'Unsaved changes will be lost. Save a .sbk file first if you want to keep them.', 'New project'))) return; P = newProject(); ensureBooks(P, 3); images.clear(); await clearAutosave(); step = 0; normalizeAfterLoad(); };
$('#bOpen').onclick = () => { const f = $('#fileSbk'); f.value = ''; f.onchange = async () => { if (!f.files[0]) return; try { const np = await openSbk(f.files[0]); P = np; normalizeAfterLoad(); toast('Project opened'); } catch { toast("This project file can't be opened.", true); } }; f.click(); };
$('#bSave').onclick = async () => { const blob = await saveSbk(P); download(blob, `${slugP()}.sbk`); dirty = false; toast('Project saved'); };
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bAll').onclick = () => runExport('everything');
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (e.key === 'y') { e.preventDefault(); redo(); } } });
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- boot ---------- */
(async function boot() {
  await loadAllFonts();
  let restored = null;
  try { const probe = await loadAutosave(); if (probe && (probe.series.name || probe.books.some((b) => b.imageId))) restored = probe; } catch { autosaveOn = false; toast('Autosave is off in this browser. Save your project file to keep your work.', true); }
  if (restored && (await ask('Continue your last project?', `“${esc(restored.series.name || 'Untitled series')}” was saved automatically in this browser.`, 'Continue', 'Start fresh'))) { P = restored; }
  else { images.clear(); if (restored) await clearAutosave(); }
  ensureBooks(P, P.books.length || 3); lastSnap = snap(); render(true); setTimeout(fit, 50);
})();
