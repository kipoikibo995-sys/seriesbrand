// All rendering: logo, badge, cover, interior pages, style guide, shelf. Canvas 2D from the project object.
import { KDP, coverSpec, pageSpec } from './kdp-specs.js';
import { fontsOf, fitText, wrapText } from './fonts.js';
import { drawIcon, ICON_IDS } from './icons.js';
import { alpha, shade, hexToRgb } from './color.js';

export const images = new Map(); // imageId -> {bmp, w, h, blob, name}
const U = 100; // cover units = 1/100 inch
const PT = 100 / 72; // 1pt in units
export const role = (p, r) => p.palette[r] || '#888888';

/* ---------- helpers ---------- */
export function nameLines(p, forceSplit) {
  let name = p.series.name || 'Series Name';
  if (p.fonts.caps) name = name.toUpperCase();
  const words = name.split(/\s+/);
  let n = p.logo.split || 0;
  if (!n && forceSplit && words.length > 1) n = Math.max(1, Math.floor(words.length / 2));
  if (n > 0 && n < words.length) return [words.slice(0, n).join(' '), words.slice(n).join(' ')];
  return [name];
}
function strokeFill(ctx, text, x, y, fill, outline, ow) {
  if (outline && ow > 0) { ctx.lineJoin = 'round'; ctx.lineWidth = ow * 2; ctx.strokeStyle = outline; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
function setLS(ctx, v) { if ('letterSpacing' in ctx) ctx.letterSpacing = v + 'px'; }
function drawLines(ctx, lines, size, cx, cy, fill, outline, ow, align = 'center') {
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const lh = size * 1.08, y0 = cy - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => strokeFill(ctx, l, cx, y0 + i * lh, fill, outline, ow));
}
function arcText(ctx, text, cx, cy, r, size, colorFn, outline, ow, startAng) {
  // draw char by char around circle centre; text centred at the top (startAng = -PI/2 gives centre)
  const widths = [...text].map((c) => ctx.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) / r;
  let a = startAng - total / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i] / r; a += w / 2;
    ctx.save(); ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a)); ctx.rotate(a + Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    strokeFill(ctx, ch, 0, 0, colorFn(i), outline, ow);
    ctx.restore(); a += w / 2;
  });
  return total;
}
// Cloud = union of ellipses designed on a 1000x600 grid and stretched to fill the box.
export function cloudGeom(x, y, w, h) {
  const kx = w / 1000, ky = h / 600;
  const ells = [[190, 370, 120], [330, 250, 140], [530, 215, 150], [730, 265, 135], [800, 390, 115], [500, 400, 160]].map(([a, b, r]) => [x + a * kx, y + b * ky, r * kx, r * ky]);
  return { ells, base: [x + 190 * kx, y + 390 * ky, 610 * kx, 130 * ky] };
}
export function drawCloudShape(ctx, x, y, w, h, fill, stroke, sw) {
  const { ells, base } = cloudGeom(x, y, w, h);
  ctx.fillStyle = stroke;
  for (const [cx, cy, rx, ry] of ells) { ctx.beginPath(); ctx.ellipse(cx, cy, rx + sw, ry + sw, 0, 0, 7); ctx.fill(); }
  ctx.fillRect(base[0] - sw, base[1], base[2] + 2 * sw, base[3] + sw);
  ctx.fillStyle = fill;
  for (const [cx, cy, rx, ry] of ells) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill(); }
  ctx.fillRect(...base);
}

export const LOGO_DEFAULT_ROLES = {
  ribbon: { fill: 'primary', text: 'textLight', outline: 'textDark' }, badge: { fill: 'primary', text: 'textLight', outline: 'textDark' },
  cloud: { fill: 'primary', text: 'primary', outline: 'textDark' }, arch: { fill: 'primary', text: 'accent', outline: 'textLight' },
  stacked: { fill: 'primary', text: 'textDark', outline: 'textLight' },
};
export const LOGO_LAYOUTS = Object.keys(LOGO_DEFAULT_ROLES);

/* ---------- logo (1000 x 600 box) ---------- */
export function drawLogo(ctx, p, X = 0, Y = 0, W = 1000, opts = {}) {
  const k = W / 1000, f = fontsOf(p), L = p.logo, R = (r) => role(p, L.colorRoles[r]);
  const fill = R('fill'), text = R('text'), outline = R('outline'), sec = role(p, 'secondary'), bg = role(p, 'background'), acc = role(p, 'accent');
  const fs = p.fonts.titleScale, ls = p.fonts.letterSpacing;
  ctx.save(); ctx.translate(X, Y); ctx.scale(k, k);
  ctx.beginPath(); ctx.rect(-40, -40, 1080, 680); ctx.clip();
  const ow = Math.max(0.5, p.fonts.outline * 1.2); // outline in logo units
  const lines = nameLines(p, L.layout === 'stacked');
  const hasIcon = L.iconId && L.iconId !== 'none';
  const res = { ok: true };
  if (L.layout === 'ribbon') {
    ctx.fillStyle = sec;
    ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(130, 200); ctx.lineTo(130, 440); ctx.lineTo(0, 440); ctx.lineTo(56, 320); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1000, 200); ctx.lineTo(870, 200); ctx.lineTo(870, 440); ctx.lineTo(1000, 440); ctx.lineTo(944, 320); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fill; ctx.fillRect(70, 160, 860, 240);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.moveTo(70, 400); ctx.lineTo(130, 400); ctx.lineTo(130, 440); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(930, 400); ctx.lineTo(870, 400); ctx.lineTo(870, 440); ctx.closePath(); ctx.fill();
    setLS(ctx, ls);
    const t = fitText(ctx, lines.join(' '), f.title, 720, 190, 150 * fs, 20, ls);
    ctx.font = f.title(t.size); drawLines(ctx, t.lines, t.size, 500, 280, text, outline, ow);
    if (hasIcon) { drawIcon(ctx, L.iconId, 450, 10, 100, acc, fill, outline, 3); }
    res.ok = t.ok;
  } else if (L.layout === 'badge') {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(500, 300, 295, 0, 7); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(500, 300, 290, 0, 7); ctx.stroke();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(500, 300, 200, 0, 7); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(500, 300, 200, 0, 7); ctx.stroke();
    let size = 80 * fs; const name = lines.join(' ');
    setLS(ctx, ls); ctx.font = f.title(size);
    const r = 248, maxAng = 4.4; // radians available on the ring
    while (size > 14 && ctx.measureText(name).width / r > maxAng) { size *= 0.97; ctx.font = f.title(size); }
    res.ok = ctx.measureText(name).width / r <= maxAng;
    arcText(ctx, name, 500, 300, r - size * 0.3, size, () => text, outline, Math.max(.5, ow / 2), -Math.PI / 2);
    if (hasIcon) drawIcon(ctx, L.iconId, 400, 200, 200, acc, bg, outline, 4);
  } else if (L.layout === 'cloud') {
    drawCloudShape(ctx, 0, 0, 1000, 600, bg, fill, 8);
    setLS(ctx, ls);
    const t = fitText(ctx, lines.join(' '), f.title, 560, 250, 130 * fs, 20, ls);
    ctx.font = f.title(t.size); drawLines(ctx, t.lines, t.size, 500, hasIcon ? 400 : 360, text, null, 0);
    if (hasIcon) drawIcon(ctx, L.iconId, 450, 125, 100, acc, bg, outline, 0);
    res.ok = t.ok;
  } else if (L.layout === 'arch') {
    const r = 500 * (L.arc || 1), name = lines.join(' ');
    let size = 230 * fs; setLS(ctx, ls); ctx.font = f.title(size);
    const maxAng = Math.min(2.3, 2 * Math.asin(Math.min(1, 380 / r)));
    while (size > 14 && ctx.measureText(name).width / r > maxAng) { size *= 0.97; ctx.font = f.title(size); }
    const ang = ctx.measureText(name).width / r, drop = r * (1 - Math.cos(Math.min(ang, Math.PI) / 2));
    const base = 300 - drop / 2 + size * 0.35 + (hasIcon ? 80 : 0);
    let ci = -1;
    arcText(ctx, name, 500, base + r, r, size, (i) => (name[i] === ' ' ? fill : (++ci % 2 ? text : fill)), outline, Math.max(1, ow), -Math.PI / 2);
    if (hasIcon) drawIcon(ctx, L.iconId, 440, 10, 120, acc, bg, outline, 4);
    res.ok = ang <= maxAng + 0.01;
  } else { // stacked
    const l1 = lines.length > 1 ? lines[0] : '', l2 = lines.length > 1 ? lines[1] : lines[0];
    if (hasIcon) drawIcon(ctx, L.iconId, 410, 0, 180, acc, bg, outline, 4);
    const top = hasIcon ? 210 : 40; setLS(ctx, ls);
    let y = top;
    if (l1) { const t1 = fitText(ctx, l1, f.title, 700, 90, 90 * fs, 16, ls); ctx.font = f.title(t1.size); drawLines(ctx, t1.lines, t1.size, 500, y + 50, text, outline, ow / 2); y += 100; res.ok = t1.ok; }
    const t2 = fitText(ctx, l2, f.title, 940, 600 - y - 10, 210 * fs, 20, ls);
    ctx.font = f.title(t2.size); drawLines(ctx, t2.lines, t2.size, 500, y + (600 - y) / 2 - 10, fill, outline, ow);
    res.ok = res.ok && t2.ok;
  }
  setLS(ctx, 0);
  ctx.restore();
  return res;
}

/* ---------- badge (1000 x 1000 box) ---------- */
export function drawBadge(ctx, p, n, X = 0, Y = 0, S = 1000) {
  const k = S / 1000, B = p.badge, f = fontsOf(p);
  const R = (r) => role(p, B.colorRoles[r]), fill = R('fill'), text = R('text'), outline = R('outline');
  ctx.save(); ctx.translate(X, Y); ctx.scale(k, k);
  ctx.lineJoin = 'round';
  let cx = 500, tx = 500;
  if (B.style === 'circle') {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(500, 500, 480, 0, 7); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(500, 500, 467, 0, 7); ctx.stroke();
    ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(500, 500, 400, 0, 7); ctx.stroke();
  } else if (B.style === 'star') {
    const pts = []; for (let i = 0; i < 16; i++) { const a = (Math.PI * i) / 8 - Math.PI / 2, r = i % 2 ? 400 : 485; pts.push([500 + r * Math.cos(a), 500 + r * Math.sin(a)]); }
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 40; ctx.stroke();
  } else if (B.style === 'tag') {
    ctx.beginPath(); ctx.moveTo(250, 230); ctx.lineTo(390, 50); ctx.lineTo(610, 50); ctx.lineTo(750, 230); ctx.lineTo(750, 940); ctx.lineTo(250, 940); ctx.closePath();
    ctx.moveTo(542, 160); ctx.arc(500, 160, 42, 0, Math.PI * 2, true);
    ctx.fillStyle = fill; ctx.fill('evenodd'); ctx.strokeStyle = outline; ctx.lineWidth = 26; ctx.stroke();
  } else { // flag
    ctx.fillStyle = outline; ctx.fillRect(110, 90, 36, 860);
    ctx.beginPath(); ctx.moveTo(146, 170); ctx.lineTo(900, 170); ctx.lineTo(780, 470); ctx.lineTo(900, 770); ctx.lineTo(146, 770); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 22; ctx.stroke();
    tx = 470;
  }
  const small = (B.label || 'Book {n}').replace('{n}', '').trim();
  const cy = B.style === 'tag' ? 560 : 500, hgt = B.style === 'flag' ? 420 : B.style === 'tag' ? 560 : 760;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const num = String(n), wMax = B.style === 'flag' ? 520 : B.style === 'tag' ? 380 : 560;
  let ns = hgt * 0.55; ctx.font = f.title(ns);
  while (ns > 30 && ctx.measureText(num).width > wMax * 0.8) { ns *= 0.95; ctx.font = f.title(ns); }
  if (small) {
    const t = fitText(ctx, small, f.title, wMax, hgt * 0.2, hgt * 0.15, 16);
    ctx.font = f.title(t.size); ctx.fillStyle = text; ctx.fillText(t.lines.join(' '), tx, cy - ns * 0.62);
  }
  ctx.font = f.title(ns); ctx.fillStyle = text; ctx.fillText(num, tx, cy + (small ? ns * 0.1 : 0));
  ctx.restore();
}

/* ---------- cover ---------- */
function drawArt(ctx, p, book, rect, info, ppi) {
  const [x, y, w, h] = rect, im = images.get(book.imageId); info.artRect = rect;
  if (!im) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, role(p, 'accent')); g.addColorStop(1, role(p, 'secondary'));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); info.noArt = true; return;
  }
  const s0 = Math.max(w / im.w, h / im.h), c = book.imageCrop || { x: 0, y: 0, scale: 1 }, s = s0 * Math.max(1, c.scale);
  const dw = im.w * s, dh = im.h * s;
  const dx = x + (w - dw) * (0.5 + c.x * 0.5), dy = y + (h - dh) * (0.5 + c.y * 0.5);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im.bmp, dx, dy, dw, dh); ctx.restore();
  info.dpi = U / s; // image px per inch at print size
}
// Renders the full wrap-around cover (units = 1/100 in). opts: {ppi, guides:{cut,bleed,safe,spine,barcode}|null, front:bool, thumbs}
export function renderCover(canvas, p, bi, opts = {}) {
  const ppi = opts.ppi || 72, book = p.books[bi];
  const pages = book.pages || p.print.pages, sp = coverSpec(p.print.trim, pages, p.print.paper);
  const tw = sp.trimW * U, th = sp.trimH * U, b = KDP.BLEED * U, spine = sp.spine * U, W = sp.coverW * U, H = sp.coverH * U, safe = KDP.SAFE * U;
  const fx = b + tw + spine, bx = b; // front / back trim x origins
  const frontOnly = !!opts.front;
  const cw = frontOnly ? Math.ceil(sp.trimW * ppi) : Math.ceil(sp.coverW * ppi), ch = frontOnly ? Math.ceil(sp.trimH * ppi) : Math.ceil(sp.coverH * ppi);
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(ppi / U * (frontOnly ? cw / (sp.trimW * ppi) : 1), ppi / U * (frontOnly ? ch / (sp.trimH * ppi) : 1));
  if (frontOnly) ctx.translate(-fx, -b);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const f = fontsOf(p), info = { warnings: [], boxes: [], dpi: null, noArt: false };
  const pri = role(p, 'primary'), bg = role(p, 'background'), td = role(p, 'textDark'), tl = role(p, 'textLight');
  const fs = p.fonts;
  const warn = (m) => { if (!info.warnings.includes(m)) info.warnings.push(m); };
  const checkSize = (size, what) => { if (size / PT < KDP.MIN_FONT_PT - 0.01) warn(`${what} text is smaller than ${KDP.MIN_FONT_PT} pt`); };
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  /* BACK */
  {
    const x0 = bx + safe, x1 = bx + tw - safe, y0 = b + safe, y1 = b + th - safe;
    const im = images.get(book.imageId);
    if (p.cover.backBlur && im) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, b + tw + b, H); ctx.clip();
      ctx.filter = `blur(${(14 * ppi) / 72}px)`;
      const s = Math.max((tw + 2 * b) / im.w, H / im.h);
      ctx.drawImage(im.bmp, (tw + 2 * b - im.w * s) / 2 - 20, (H - im.h * s) / 2 - 20, im.w * s + 40, im.h * s + 40);
      ctx.filter = 'none'; ctx.fillStyle = alpha(bg, 0.82); ctx.fillRect(0, 0, b + tw + b, H); ctx.restore();
    }
    const lw = tw * 0.3, lh = lw * 0.6;
    drawLogo(ctx, p, bx + (tw - lw) / 2, y0, lw);
    // strip of other books
    const others = p.books.map((bk, i) => i).filter((i) => i !== bi).slice(0, 5);
    const barcodeTop = b + th - safe - KDP.BARCODE_H * U;
    let stripTop = barcodeTop - 20;
    if (others.length) {
      const thH = th * 0.22, thW = thH * (tw / th), gap = 12, tot = others.length * thW + (others.length - 1) * gap;
      const sy = barcodeTop - 20 - thH, sx = Math.max(x0, bx + (tw - tot) / 2);
      ctx.fillStyle = td; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lab = fitText(ctx, 'More books in this series', f.title, tw - 2 * safe, 26, 22, 8);
      ctx.font = f.title(lab.size); ctx.fillText(lab.lines.join(' '), bx + tw / 2, sy - 22);
      checkSize(lab.size, 'Back cover');
      others.forEach((oi, j) => {
        const c = opts.thumbOf ? opts.thumbOf(oi, thH) : null, xx = sx + j * (thW + gap);
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
        if (c) ctx.drawImage(c, xx, sy, thW, thH); else { ctx.fillStyle = role(p, 'secondary'); ctx.fillRect(xx, sy, thW, thH); }
        ctx.restore();
      });
      stripTop = sy - 44;
    }
    // blurb
    const by0 = y0 + lh + 24, bh = stripTop - by0, bw = x1 - x0 - 30;
    if (book.blurb && bh > 40) {
      let size = 16 * PT, lines;
      for (; size >= 12 * PT - 0.01; size -= 0.5 * PT) { lines = wrapText(ctx, book.blurb, f.body, size, bw); if (lines.length * size * 1.35 <= bh) break; }
      if (lines.length * size * 1.35 > bh) { size = 12 * PT; lines = wrapText(ctx, book.blurb, f.body, size, bw); warn('Back cover description does not fit; shorten it'); info.blurbOverflow = true; }
      ctx.fillStyle = td; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = f.body(size);
      const used = lines.length * size * 1.35;
      lines.forEach((l, i) => ctx.fillText(l, x0 + 15, by0 + (bh - used) / 2 * 0.6 + i * size * 1.35));
    }
    if (p.cover.barcodeWhite) { ctx.fillStyle = '#fff'; ctx.fillRect(bx + tw - safe - KDP.BARCODE_W * U, b + th - safe - KDP.BARCODE_H * U, KDP.BARCODE_W * U, KDP.BARCODE_H * U); }
  }

  /* FRONT */
  const fr = { x: fx, y: b, w: tw, h: th }, fsafe = { x: fx + safe, y: b + safe, w: tw - 2 * safe, h: th - 2 * safe };
  const titleText = book.title || 'Book Title', author = p.series.author || '';
  const lay = p.cover.layoutId, badgeD = tw * 0.16;
  const titleFit = (box, start, min, color, outline) => {
    const ow = fs.outline / 3; // px@300dpi -> units
    const t = fitText(ctx, titleText, f.title, box.w, box.h, start * fs.titleScale, min, fs.letterSpacing * 0.33);
    checkSize(t.size, 'Title'); if (!t.ok) { warn('Title overflows the safe area'); info.overflow = true; }
    ctx.save(); setLS(ctx, fs.letterSpacing * 0.33); ctx.font = f.title(t.size);
    if (fs.shadow) { ctx.save(); ctx.translate(4 / 3, 4 / 3); drawLines(ctx, t.lines, t.size, box.x + box.w / 2, box.y + box.h / 2, alpha(td, .35), alpha(td, .35), ow); ctx.restore(); }
    drawLines(ctx, t.lines, t.size, box.x + box.w / 2, box.y + box.h / 2, color, outline, ow);
    setLS(ctx, 0); ctx.restore();
  };
  const authorFit = (box, color) => {
    if (!author) { warn('Author name is empty'); return; }
    const t = fitText(ctx, author, f.body, box.w, box.h, box.h * 0.8, 10);
    checkSize(t.size, 'Author'); if (!t.ok) warn('Author name overflows');
    ctx.font = f.body(t.size); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.lines.join(' '), box.x + box.w / 2, box.y + box.h / 2);
  };
  let logoRect, titleBox;
  if (lay === 'frame') {
    const lw = tw * 0.42, lh = lw * 0.6, ly = fsafe.y, fTop = ly + lh * 0.5, fBot = b + th * 0.76;
    ctx.fillStyle = bg; ctx.fillRect(fx, 0, tw + b, H);
    const fxr = fx + 45, fw = tw - 90, fh = fBot - fTop;
    ctx.save(); ctx.beginPath(); ctx.roundRect(fxr, fTop, fw, fh, 22); ctx.clip();
    drawArt(ctx, p, book, [fxr, fTop, fw, fh], info); ctx.restore();
    ctx.strokeStyle = pri; ctx.lineWidth = 30; ctx.beginPath(); ctx.roundRect(fxr, fTop, fw, fh, 22); ctx.stroke();
    logoRect = [fx + (tw - lw) / 2, ly, lw];
    titleBox = { x: fsafe.x, y: fBot + 26, w: fsafe.w, h: b + th - safe - 46 - (fBot + 26) };
    drawLogo(ctx, p, ...logoRect); titleFit(titleBox, 200, 12, td, null);
    authorFit({ x: fsafe.x, y: b + th - safe - 40, w: fsafe.w, h: 40 }, td);
  } else {
    drawArt(ctx, p, book, [fx, 0, tw + b, H], info);
    if (lay === 'classic-top') {
      const bandTop = b + th * 0.76;
      ctx.fillStyle = pri; ctx.fillRect(fx, bandTop, tw + b, H - bandTop);
      const lw = tw * 0.6; logoRect = [fx + (tw - lw) / 2, fsafe.y, lw];
      drawLogo(ctx, p, ...logoRect);
      titleBox = { x: fsafe.x, y: bandTop + 14, w: fsafe.w, h: (b + th - safe - 60) - (bandTop + 14) };
      titleFit(titleBox, 200, 12, tl, td);
      authorFit({ x: fsafe.x, y: b + th - safe - 52, w: fsafe.w, h: 46 }, tl);
    } else if (lay === 'classic-bottom') {
      const lw = tw * 0.35, lh = lw * 0.6; logoRect = [fsafe.x, b + th - safe - lh, lw];
      ctx.fillStyle = 'rgba(0,0,0,0)';
      drawLogo(ctx, p, ...logoRect);
      titleBox = { x: fsafe.x, y: fsafe.y, w: fsafe.w, h: th * 0.22 };
      titleFit(titleBox, 200, 12, tl, td);
      const ax = fsafe.x + lw + 10; authorFit({ x: ax, y: b + th - safe - 50, w: fsafe.x + fsafe.w - ax, h: 46 }, tl);
      if (author) { /* readable on art */ }
    } else { // cloud-title
      const lw = tw * 0.6; logoRect = [fx + (tw - lw) / 2, fsafe.y, lw];
      drawLogo(ctx, p, ...logoRect);
      const cw2 = tw * 0.84, chh = th * 0.34, cxl = fx + (tw - cw2) / 2, cyt = b + th - safe - chh;
      drawCloudShape(ctx, cxl, cyt, cw2, chh, bg, pri, 8);
      titleBox = { x: cxl + cw2 * 0.2, y: cyt + chh * 0.28, w: cw2 * 0.6, h: chh * 0.4 };
      titleFit(titleBox, 160, 12, pri, null);
      authorFit({ x: cxl + cw2 * 0.25, y: cyt + chh * 0.72, w: cw2 * 0.5, h: chh * 0.14 }, td);
    }
  }
  // badge
  const pos = p.badge.position, bxp = pos.includes('left') ? fsafe.x : fsafe.x + fsafe.w - badgeD, byp = pos.includes('top') ? fsafe.y : fsafe.y + fsafe.h - badgeD;
  drawBadge(ctx, p, book.number, bxp, byp, badgeD);
  info.safe = fsafe; info.front = fr; info.frontFull = { x: fx, y: 0, w: tw + b, h: H };
  info.logoRect = logoRect; info.titleBox = titleBox; info.badgeRect = [bxp, byp, badgeD, badgeD];

  /* SPINE (drawn after front/back so the colour can bleed ±0.0625in over both) */
  {
    const sc = p.cover.spineColor === 'background' ? bg : pri, v = KDP.SPINE_VARIANCE * U, sx = b + tw;
    ctx.fillStyle = sc; ctx.fillRect(sx, 0, spine, H);
    let g = ctx.createLinearGradient(sx - v, 0, sx, 0); g.addColorStop(0, alpha(sc, 0)); g.addColorStop(1, alpha(sc, 1)); ctx.fillStyle = g; ctx.fillRect(sx - v, 0, v, H);
    g = ctx.createLinearGradient(sx + spine, 0, sx + spine + v, 0); g.addColorStop(0, alpha(sc, 1)); g.addColorStop(1, alpha(sc, 0)); ctx.fillStyle = g; ctx.fillRect(sx + spine, 0, v, H);
    if (sp.spineText && spine > 2 * KDP.SPINE_TEXT_MARGIN * U + 10) {
      ctx.save(); ctx.translate(sx + spine / 2, b + th / 2); ctx.rotate(Math.PI / 2);
      const txt = [p.series.name, book.title, author].filter(Boolean).join('  ·  '), bwid = spine - 2 * KDP.SPINE_TEXT_MARGIN * U;
      const t = fitText(ctx, txt, f.title, th - 2 * safe, bwid, bwid * 0.8, 6);
      ctx.font = f.title(t.size); ctx.fillStyle = sc === bg ? td : tl; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.lines.join(' '), 0, 0); ctx.restore();
    }
  }

  /* checks */
  if (info.noArt) warn('No illustration for this book');
  if (info.dpi != null) { info.dpiLabel = info.dpi >= 300 ? 'ready' : info.dpi >= 200 ? 'soft' : 'blurry'; if (info.dpi < 300) warn(`Illustration is ${Math.round(info.dpi)} DPI (${info.dpi < 200 ? 'will print blurry' : 'may look soft'})`); }
  if (!book.title) warn('Book title is empty');

  /* guides — preview only, never exported */
  const g = opts.guides;
  if (g && !frontOnly) {
    ctx.save(); ctx.lineWidth = 1.5 * (72 / ppi) * 1; ctx.font = `${9 * 72 / ppi}px sans-serif`;
    if (g.bleed) { ctx.fillStyle = 'rgba(220,38,38,.18)'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); ctx.fillRect(0, 0, b, H); ctx.fillRect(W - b, 0, b, H); }
    if (g.cut) { ctx.strokeStyle = '#16a34a'; ctx.setLineDash([8, 5]); ctx.strokeRect(b, b, W - 2 * b, H - 2 * b); ctx.setLineDash([]); }
    if (g.safe) { ctx.strokeStyle = '#2563eb'; ctx.setLineDash([4, 4]); ctx.strokeRect(bx + safe, b + safe, tw - 2 * safe, th - 2 * safe); ctx.strokeRect(fx + safe, b + safe, tw - 2 * safe, th - 2 * safe); ctx.setLineDash([]); }
    if (g.spine) { ctx.strokeStyle = '#9333ea'; ctx.beginPath(); ctx.moveTo(b + tw, 0); ctx.lineTo(b + tw, H); ctx.moveTo(b + tw + spine, 0); ctx.lineTo(b + tw + spine, H); ctx.stroke(); }
    if (g.barcode) { const bxx = bx + tw - safe - KDP.BARCODE_W * U, byy = b + th - safe - KDP.BARCODE_H * U; ctx.strokeStyle = '#dc2626'; ctx.setLineDash([3, 3]); ctx.strokeRect(bxx, byy, KDP.BARCODE_W * U, KDP.BARCODE_H * U); ctx.fillStyle = '#dc2626'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KDP barcode', bxx + KDP.BARCODE_W * U / 2, byy + KDP.BARCODE_H * U / 2); ctx.setLineDash([]); }
    if (info.overflow && info.titleBox) { ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3; const t = info.titleBox; ctx.strokeRect(t.x, t.y, t.w, t.h); }
    ctx.restore();
  }
  ctx.restore();
  info.spec = sp; info.units = { b, tw, th, spine, W, H, fx };
  return info;
}
