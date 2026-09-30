// Interior series pages, style guide pages, bookshelf mockups, SVG logo export.
import { KDP, pageSpec, coverSpec } from './kdp-specs.js';
import { fontsOf, fitText, wrapText, buffers } from './fonts.js';
import { drawIcon } from './icons.js';
import { images, role, drawLogo, drawBadge, renderCover, nameLines, LOGO_LAYOUTS, cloudGeom } from './draw.js';
import { alpha, hexToRgb, colorName, contrast, rate, shade } from './color.js';
import { styleBlock } from './prompt.js';

const U = 100;
export function frontThumb(p, bi, h) { // offscreen front cover for a slot h units tall (1/100 in)
  const c = document.createElement('canvas'), sp = coverSpec(p.print.trim, p.books[bi].pages || p.print.pages, p.print.paper);
  renderCover(c, p, bi, { ppi: Math.min(300, Math.max(30, (h * 3) / sp.trimH)), front: true });
  return c;
}

/* ---------- interior pages (units 1/100 in) ---------- */
export const PAGE_KINDS = { title: 'p-title', belongs: 'p-belongs', collect: 'p-collect' };
export function renderPage(canvas, p, bi, kind, opts = {}) {
  const ppi = opts.ppi || 72, bleed = opts.bleed !== false, ps = pageSpec(p.print.trim, bleed);
  const tw = ps.trimW * U, th = ps.trimH * U, b = bleed ? KDP.BLEED * U : 0;
  const gutterLeft = kind === 'title'; // title = right-hand page, others = left-hand
  const W = ps.w * U, H = ps.h * U, tx0 = bleed ? (gutterLeft ? 0 : b) : 0, ty0 = b;
  canvas.width = Math.ceil(ps.w * ppi); canvas.height = Math.ceil(ps.h * ppi);
  const ctx = canvas.getContext('2d'); ctx.save(); ctx.scale(canvas.width / W, canvas.height / H);
  const f = fontsOf(p), book = p.books[bi], bg = role(p, 'background'), td = role(p, 'textDark'), pri = role(p, 'primary'), sec = role(p, 'secondary'), acc = role(p, 'accent');
  const inner = 37.5, outer = 25;
  const sx0 = tx0 + (gutterLeft ? inner : outer), sx1 = tx0 + tw - (gutterLeft ? outer : inner), sy0 = ty0 + outer, sy1 = ty0 + th - outer, sw = sx1 - sx0, sh = sy1 - sy0;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const center = (t, y, size, col, font = f.title) => { ctx.font = font(size); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, sx0 + sw / 2, y); };
  if (kind === 'title') {
    const lw = Math.min(sw, 560); drawLogo(ctx, p, sx0 + (sw - lw) / 2, sy0 + 40, lw);
    const t = fitText(ctx, book.title || 'Book Title', f.title, sw, 150, 130 * p.fonts.titleScale, 24);
    ctx.font = f.title(t.size); ctx.fillStyle = pri; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    t.lines.forEach((l, i) => ctx.fillText(l, sx0 + sw / 2, sy0 + 40 + lw * 0.6 + 120 + i * t.size * 1.08));
    const bd = 150; drawBadge(ctx, p, book.number, sx0 + (sw - bd) / 2, sy0 + 40 + lw * 0.6 + 120 + t.lines.length * t.size * 1.08 + 30, bd);
    if (book.subtitle) center(book.subtitle, sy1 - 90, 26, td, f.body);
    center(p.series.author || '', sy1 - 40, 30, td, f.body);
  } else if (kind === 'belongs') {
    const lw = 260; drawLogo(ctx, p, sx0 + (sw - lw) / 2, sy0 + 10, lw);
    // decorative frame of series icons
    const id = p.logo.iconId && p.logo.iconId !== 'none' ? p.logo.iconId : 'star', step = 70, sz = 40;
    const fx0 = sx0 + 10, fy0 = sy0 + 130, fw = sw - 20, fh = sy1 - fy0 - 10;
    const nx = Math.floor(fw / step), ny = Math.floor(fh / step);
    for (let i = 0; i <= nx; i++) for (const y of [fy0, fy0 + fh]) drawIcon(ctx, id, fx0 + (i * (fw - sz)) / nx, y - sz / 2, sz, i % 2 ? acc : pri, bg);
    for (let j = 1; j < ny; j++) for (const x of [fx0, fx0 + fw]) drawIcon(ctx, id, x - sz / 2 + (x === fx0 ? 0 : -sz / 2 + sz / 2) * 0, fy0 + (j * fh) / ny - sz / 2, sz, j % 2 ? acc : pri, bg);
    center('This book belongs to', fy0 + fh * 0.4, 52, pri);
    ctx.strokeStyle = td; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx0 + sw * 0.15, fy0 + fh * 0.6); ctx.lineTo(sx0 + sw * 0.85, fy0 + fh * 0.6); ctx.stroke();
  } else { // collect
    const lw = 220; drawLogo(ctx, p, sx0 + (sw - lw) / 2, sy0, lw);
    center('Collect them all!', sy0 + 130 + 30, 70, pri);
    const n = Math.min(12, p.books.length), cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols);
    const gy0 = sy0 + 230, gh = sy1 - gy0, cellW = sw / cols, cellH = gh / rows;
    const ar = th / tw; // cover aspect h/w
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols), off = ((cols - inRow) * cellW) / 2;
      const cx = sx0 + off + c * cellW, cy = gy0 + r * cellH, lab = 44;
      let ih = cellH - lab - 26, iw = ih / ar; if (iw > cellW - 24) { iw = cellW - 24; ih = iw * ar; }
      const ix = cx + (cellW - iw) / 2, iy = cy + 6;
      const bk = p.books[i];
      if (images.get(bk.imageId)) { const t = frontThumb(p, i, Math.max(60, ih)); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.drawImage(t, ix, iy, iw, ih); ctx.restore(); }
      else { ctx.fillStyle = sec; ctx.fillRect(ix, iy, iw, ih); ctx.fillStyle = role(p, 'textLight'); ctx.font = f.title(Math.min(28, iw / 6)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Coming soon', ix + iw / 2, iy + ih / 2); }
      const t = fitText(ctx, bk.title || `Book ${bk.number}`, f.body, cellW - 60, 34, 26, 10);
      ctx.font = f.body(t.size); ctx.fillStyle = td; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const tw2 = ctx.measureText(t.lines.join(' ')).width, bx = ix + (iw - (tw2 + 34)) / 2;
      ctx.strokeStyle = pri; ctx.lineWidth = 3; ctx.strokeRect(bx, iy + ih + 18, 22, 22);
      ctx.fillText(t.lines.join(' '), bx + 34, iy + ih + 30);
    }
  }
  if (opts.guides) { ctx.strokeStyle = '#2563eb'; ctx.setLineDash([4, 4]); ctx.strokeRect(sx0, sy0, sw, sh); ctx.strokeStyle = '#16a34a'; ctx.strokeRect(tx0, ty0, tw, th); }
  ctx.restore();
}

/* ---------- style guide (Letter @300dpi: 2550x3300, unit = 1/100in ⇒ scale 3) ---------- */
export function renderGuide(canvas, p, page, ppi = 300) {
  canvas.width = Math.round(8.5 * ppi); canvas.height = Math.round(11 * ppi);
  const ctx = canvas.getContext('2d'), s = ppi / U; ctx.save(); ctx.scale(s, s);
  const f = fontsOf(p), bg = role(p, 'background'), td = role(p, 'textDark'), pri = role(p, 'primary');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 850, 1100);
  const txt = (t, x, y, size, col = td, font = f.body, align = 'left') => { ctx.font = font(size); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); };
  const h = (t, y) => { txt(t, 50, y, 22, pri, f.title); ctx.fillStyle = pri; ctx.fillRect(50, y + 8, 40, 3); };
  txt((p.series.name || 'Series') + ' — Brand Style Guide', 50, 70, 34, td, f.title);
  txt(`${page === 0 ? 'Identity' : 'Usage rules'}  ·  by ${p.series.author || '—'}${p.series.tagline ? '  ·  ' + p.series.tagline : ''}`, 50, 95, 13);
  if (page === 0) {
    h('Logo', 140);
    ctx.fillStyle = bg; ctx.fillRect(50, 160, 360, 170); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.strokeRect(50, 160, 360, 170);
    drawLogo(ctx, p, 75, 170, 310);
    ctx.fillStyle = pri; ctx.fillRect(440, 160, 360, 170);
    const alt = { ...p, logo: { ...p.logo, colorRoles: { ...p.logo.colorRoles } } };
    drawLogo(ctx, alt, 465, 170, 310);
    h('Colors', 380);
    const roles = ['primary', 'secondary', 'accent', 'background', 'textDark', 'textLight'];
    roles.forEach((r, i) => {
      const x = 50 + (i % 3) * 260, y = 400 + Math.floor(i / 3) * 130, hex = p.palette[r], [R, G, B] = hexToRgb(hex);
      ctx.fillStyle = hex; ctx.fillRect(x, y, 240, 62); ctx.strokeStyle = '#ddd'; ctx.strokeRect(x, y, 240, 62);
      txt(r, x, y + 80, 13, td, f.title); txt(`${hex}  ·  RGB ${R}, ${G}, ${B}`, x, y + 96, 11); txt(colorName(hex), x, y + 110, 11, '#666');
    });
    h('Typography', 690);
    const pair = fontsOf(p);
    txt('Aa Bb Cc 123', 50, 750, 54 * Math.min(p.fonts.titleScale, 1.2), pri, f.title);
    txt(`Title font: ${p.fonts.pairId.split('_')[0]}  ·  scale ${p.fonts.titleScale.toFixed(2)}×  ·  letter spacing ${p.fonts.letterSpacing} px  ·  outline ${p.fonts.outline}`, 50, 775, 12);
    txt('Aa Bb Cc 123 — Body text for author name, descriptions and interior pages.', 50, 810, 18, td, f.body);
    txt(`Body font: ${p.fonts.pairId.split('_')[1]}`, 50, 832, 12);
    h('Book badge', 890);
    drawBadge(ctx, p, 1, 50, 910, 150); drawBadge(ctx, p, 2, 220, 910, 150);
    txt(`Style: ${p.badge.style}  ·  label: "${p.badge.label}"  ·  position: ${p.badge.position}`, 400, 990, 13);
  } else {
    h('Cover placement', 140);
    const c = document.createElement('canvas'); const info = renderCover(c, p, 0, { ppi: 70, front: true });
    const cw = 330, ch = cw * (c.height / c.width); ctx.drawImage(c, 50, 165, cw, ch);
    const sc = cw / info.spec.trimW / 100; // preview cu per cu
    const mark = (r, label, col) => { if (!r) return; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.strokeRect(50 + (r[0] - info.units.fx) * sc, 165 + (r[1] - info.units.b) * sc, r[2] * sc, (r[3] ?? r[2] * .6) * sc); ctx.setLineDash([]); txt(label, 50 + (r[0] - info.units.fx) * sc + 3, 165 + (r[1] - info.units.b) * sc - 3, 10, col, f.title); };
    mark(info.logoRect && [...info.logoRect, info.logoRect[2] * 0.6], 'Logo', '#e11d48');
    mark(info.titleBox && [info.titleBox.x, info.titleBox.y, info.titleBox.w, info.titleBox.h], 'Title', '#2563eb');
    mark(info.badgeRect, 'Badge', '#9333ea');
    mark([info.safe.x, info.safe.y, info.safe.w, info.safe.h], 'Safe area', '#16a34a');
    h('Usage rules', 140 + 0); // drawn right column
    const rules = ['Keep clear space around the logo of at least 10% of its width.', 'Never use the logo smaller than 1 inch wide.', 'Only use colors from the series palette — never recolor the logo outside it.', 'Never stretch or skew the logo; scale it proportionally.', `Keep the book badge in the same corner (${p.badge.position}) on every cover.`, 'Keep all text inside the 0.25 in safe area.'];
    let y = 175; ctx.textAlign = 'left';
    rules.forEach((r) => { wrapText(ctx, r, f.body, 13, 380).forEach((l, i) => { txt((i ? '   ' : '•  ') + l, 420, y, 13); y += 18; }); y += 6; });
    const sp = coverSpec(p.print.trim, p.print.pages, p.print.paper);
    h('Print specs', 620);
    [`Trim size: ${p.print.trim} in`, `Paper: ${p.print.paper.replace('_', ' ')}  ·  ${p.print.pages} pages`, `Spine = pages × ${KDP.SPINE_PER_PAGE[p.print.paper]} in = ${sp.spine.toFixed(4)} in`, `Full cover = ${sp.coverW.toFixed(4)} × ${sp.coverH.toFixed(4)} in  (${sp.pxW} × ${sp.pxH} px @ 300 DPI)`, `Bleed ${KDP.BLEED} in · safe area ${KDP.SAFE} in · barcode box ${KDP.BARCODE_W} × ${KDP.BARCODE_H} in`].forEach((l, i) => txt(l, 50, 650 + i * 20, 13));
    h('Series style block (for ChatGPT)', 790);
    let yy = 820; styleBlock(p).split('\n').forEach((line) => wrapText(ctx, line, f.body, 12, 740).forEach((l) => { txt(l, 50, yy, 12); yy += 16; }));
  }
  ctx.restore();
}

/* ---------- bookshelf mockups (px) ---------- */
export function renderShelf(canvas, p, style, W, H, focus = 0) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), f = fontsOf(p), bg = role(p, 'background'), pri = role(p, 'primary');
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg); g.addColorStop(1, mix(bg, pri, 0.15)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const n = p.books.length, per = 6, rows = n > per ? 2 : 1, tr = p.print.trim.split('x').map(Number), ar = tr[1] / tr[0];
  const logoW = Math.min(W * 0.4, 900); drawLogo(ctx, p, (W - logoW) / 2, H * 0.04, logoW);
  const area = { y0: H * 0.04 + logoW * 0.6 + H * 0.03, y1: H * 0.9 }, areaH = area.y1 - area.y0;
  const rowsArr = []; for (let r = 0; r < rows; r++) rowsArr.push(p.books.map((b, i) => i).slice(r * Math.ceil(n / rows), (r + 1) * Math.ceil(n / rows)));
  const rowH = areaH / rows;
  rowsArr.forEach((idx, r) => {
    const cnt = idx.length; let ch = Math.min(rowH * 0.86, (W * 0.88) / (cnt * (1 / ar) + (cnt - 1) * 0.04 / ar));
    const cw = ch / ar, gap = cw * 0.04, total = cnt * cw + (cnt - 1) * gap, baseY = area.y0 + r * rowH + rowH / 2 + ch / 2, x0 = (W - total) / 2;
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(W * 0.06, baseY, W * 0.88, 3);
    const draw = (i, cx, cy, w, hh, rot = 0) => {
      const t = frontThumbPx(p, i, hh), spc = p.cover.spineColor === 'background' ? bg : pri, e = Math.max(6, Math.min(10, w * 0.03));
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = hh * 0.05; ctx.shadowOffsetY = hh * 0.02;
      ctx.fillStyle = spc; ctx.fillRect(-w / 2 - e, -hh, e, hh); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.roundRect(-w / 2, -hh, w, hh, hh * 0.01); ctx.save(); ctx.clip(); ctx.drawImage(t, -w / 2, -hh, w, hh); ctx.restore(); ctx.restore();
    };
    if (style === 'row') idx.forEach((i, k) => draw(i, x0 + k * (cw + gap) + cw / 2, baseY, cw, ch));
    else if (style === 'fan') {
      const mid = (cnt - 1) / 2, step = cnt > 1 ? (16 * Math.PI / 180) / (cnt - 1) : 0, sp = cw * 0.62;
      const order = idx.map((i, k) => k).sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid));
      const fw = ch * 0.9; order.forEach((k) => { const c = idx[k]; draw(c, W / 2 + (k - mid) * sp, baseY, cw * 0.9, fw * 1, -8 * Math.PI / 180 + k * step); });
    } else { // hero
      const f0 = Math.min(focus, n - 1), others = idx.filter((i) => i !== f0), hh = ch * 1.0, sh = hh * 0.72, sw2 = sh / ar;
      const left = others.slice(0, Math.ceil(others.length / 2)), right = others.slice(Math.ceil(others.length / 2));
      const hw = hh / ar; left.forEach((i, k) => draw(i, W / 2 - hw / 2 - 30 - (left.length - 1 - k) * (sw2 + 20) - sw2 / 2, baseY, sw2, sh));
      right.forEach((i, k) => draw(i, W / 2 + hw / 2 + 30 + k * (sw2 + 20) + sw2 / 2, baseY, sw2, sh)); draw(f0, W / 2, baseY, hw, hh);
    }
  });
  if (p.series.tagline) { ctx.font = f.body(H * 0.032); ctx.fillStyle = role(p, 'textDark'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.series.tagline, W / 2, H * 0.955); }
}
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
function frontThumbPx(p, bi, hPx) { const c = document.createElement('canvas'); const sp = coverSpec(p.print.trim, p.books[bi].pages || p.print.pages, p.print.paper); renderCover(c, p, bi, { ppi: Math.min(300, Math.max(60, hPx / sp.trimH)), front: true }); return c; }

/* ---------- SVG logo: text converted to outlines via opentype.js ---------- */
// Runs the canvas logo routine against a recording proxy would be heavy; instead we rebuild shapes as SVG here.
export function logoSvg(p, opentype) {
  const f = fontsOf(p), font = opentype.parse(buffers[f.titleKey].slice(0)), L = p.logo, R = (r) => role(p, L.colorRoles[r]);
  const fill = R('fill'), text = R('text'), outline = R('outline'), sec = role(p, 'secondary'), bg = role(p, 'background'), acc = role(p, 'accent');
  const lines = nameLines(p, L.layout === 'stacked'), ow = Math.max(0.5, p.fonts.outline * 1.2), fs = p.fonts.titleScale, ls = p.fonts.letterSpacing;
  const meas = document.createElement('canvas').getContext('2d');
  const width = (t, s) => font.getAdvanceWidth(t, s, { letterSpacing: ls / s });
  const fit = (t, maxW, maxH, start, min) => { let s = start; while (s > min && (width(t, s) > maxW || s * 1.08 > maxH)) s *= 0.98; return s; };
  const pathText = (t, cx, cy, size, col, out, w) => { const x = cx - width(t, size) / 2, y = cy + size * 0.35; const d = font.getPath(t, x, y, size, { letterSpacing: ls / size }).toPathData(2); return `<path d="${d}" fill="${col}" ${out ? `stroke="${out}" stroke-width="${w * 2}" stroke-linejoin="round" paint-order="stroke"` : ''}/>`; };
  let body = '';
  const icon = (x, y, s, outl) => { if (!L.iconId || L.iconId === 'none') return ''; return `<g transform="translate(${x} ${y}) scale(${s / 100})">${iconPaths(L.iconId, acc, bg, outline, outl)}</g>`; };
  if (L.layout === 'ribbon') {
    const t = lines.join(' '), s = fit(t, 720, 190, 150 * fs, 20);
    body = `<path d="M0 200H130V440H0L56 320Z M1000 200H870V440H1000L944 320Z" fill="${sec}"/><rect x="70" y="160" width="860" height="240" fill="${fill}"/>` + pathText(t, 500, 280, s, text, outline, ow) + icon(450, 10, 100, 3);
  } else if (L.layout === 'badge') {
    const t = lines.join(' '); let s = 80 * fs; while (s > 14 && width(t, s) / 248 > 4.4) s *= 0.97; const r = 248 - s * 0.3; let a = -Math.PI / 2 - width(t, s) / r / 2, g = '';
    for (const ch of t) { const w = width(ch, s) / r; a += w / 2; const x = 500 + r * Math.cos(a), y = 300 + r * Math.sin(a); g += `<g transform="translate(${x} ${y}) rotate(${(a + Math.PI / 2) * 180 / Math.PI})">${pathText(ch, 0, -s * 0.35, s, text, outline, Math.max(.5, ow / 2))}</g>`; a += w / 2; }
    body = `<circle cx="500" cy="300" r="295" fill="${fill}"/><circle cx="500" cy="300" r="290" fill="none" stroke="${outline}" stroke-width="6"/><circle cx="500" cy="300" r="200" fill="${bg}" stroke="${outline}" stroke-width="4"/>` + g + icon(400, 200, 200, 4);
  } else if (L.layout === 'cloud') {
    const t = lines.join(' '), s = fit(t, 560, 250, 130 * fs, 20), { ells: cs, base } = cloudGeom(0, 0, 1000, 600), hasI = L.iconId && L.iconId !== 'none';
    body = cs.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx + 8}" ry="${ry + 8}" fill="${fill}"/>`).join('') + `<rect x="${base[0] - 8}" y="${base[1]}" width="${base[2] + 16}" height="${base[3] + 8}" fill="${fill}"/>` + cs.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${bg}"/>`).join('') + `<rect x="${base[0]}" y="${base[1]}" width="${base[2]}" height="${base[3]}" fill="${bg}"/>` + pathText(t, 500, hasI ? 400 : 360, s, text, null, 0) + icon(450, 125, 100, 0);
  } else if (L.layout === 'arch') {
    const t = lines.join(' '), r = 500 * (L.arc || 1); let s = 230 * fs; const maxAng = Math.min(2.3, 2 * Math.asin(Math.min(1, 380 / r))); while (s > 14 && width(t, s) / r > maxAng) s *= 0.97;
    const ang = width(t, s) / r, drop = r * (1 - Math.cos(Math.min(ang, Math.PI) / 2)), base = 300 - drop / 2 + s * 0.35 + (L.iconId && L.iconId !== 'none' ? 80 : 0);
    let a = -Math.PI / 2 - ang / 2, ci = -1, g = '';
    for (const ch of t) { const w = width(ch, s) / r; a += w / 2; const x = 500 + r * Math.cos(a), y = base + r + r * Math.sin(a); const col = ch === ' ' ? fill : (++ci % 2 ? text : fill); g += `<g transform="translate(${x} ${y}) rotate(${(a + Math.PI / 2) * 180 / Math.PI})">${pathText(ch, 0, -s * 0.35, s, col, outline, Math.max(1, ow))}</g>`; a += w / 2; }
    body = g + icon(440, 10, 120, 4);
  } else {
    const l1 = lines.length > 1 ? lines[0] : '', l2 = lines.length > 1 ? lines[1] : lines[0], hasI = L.iconId && L.iconId !== 'none', top = hasI ? 210 : 40; let y = top;
    body = icon(410, 0, 180, 4);
    if (l1) { body += pathText(l1, 500, y + 50, fit(l1, 700, 90, 90 * fs, 16), text, outline, ow / 2); y += 100; }
    body += pathText(l2, 500, y + (600 - y) / 2 - 10, fit(l2, 940, 600 - y - 10, 210 * fs, 20), fill, outline, ow);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="1000" height="600">${body}</svg>`;
}
import { ICONS } from './icons.js';
function iconPaths(id, color, hole, outline, ow) {
  const parts = ICONS[id] || [];
  const under = ow ? parts.filter((p) => !p.hole).map((p) => `<path d="${p.d}" fill="${p.stroke ? 'none' : outline}" stroke="${outline}" stroke-width="${(p.stroke ? (p.w || 7) : 0) + ow * 2 * 2}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') : '';
  return under + parts.map((p) => { const c = p.hole ? hole : color; return p.stroke ? `<path d="${p.d}" fill="none" stroke="${c}" stroke-width="${p.w || 7}" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="${p.d}" fill="${c}"/>`; }).join('');
}
