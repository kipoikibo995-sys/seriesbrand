import { coverSpec, pageSpec, KDP } from './kdp-specs.js';
import { renderCover, renderPage, renderGuide, renderShelf, logoSvg, frontThumb } from './draw2-bridge.js';
import { drawLogo, drawBadge } from './draw.js';
import { allPromptText } from './prompt.js';

export const slug = (s) => (s || 'series').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'series';
export const toBlob = (c, type = 'image/png', q = 0.92) => new Promise((r) => c.toBlob(r, type, q));
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
export const tick = () => new Promise((r) => setTimeout(r, 0));

export function pdfFromCanvases(canvases, wIn, hIn) {
  const { jsPDF } = window.jspdf, a = Math.min(wIn, hIn), b = Math.max(wIn, hIn);
  const doc = new jsPDF({ orientation: wIn > hIn ? 'l' : 'p', unit: 'in', format: [a, b], compress: true });
  canvases.forEach((c, i) => { if (i) doc.addPage([a, b], wIn > hIn ? 'l' : 'p'); doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wIn, hIn, undefined, 'FAST'); });
  return doc.output('blob');
}

// Every produced file is {name, blob}. `report(name)` is called before each one so the UI can show progress.
export const makers = {
  async logoPng(p, width, report) { const s = p.series, name = `${slug(s.name)}-logo-${p.logo.layout}-${width}.png`; report(name); const c = document.createElement('canvas'); c.width = width; c.height = Math.round(width * 0.6); drawLogo(c.getContext('2d'), p, 0, 0, width); return { name, blob: await toBlob(c) }; },
  logoSvg(p, report) { const name = `${slug(p.series.name)}-logo-${p.logo.layout}.svg`; report(name); return { name, blob: new Blob([logoSvg(p, window.opentype)], { type: 'image/svg+xml' }) }; },
  async badge(p, n, report) { const name = `${slug(p.series.name)}-badge-${n}.png`; report(name); const c = document.createElement('canvas'); c.width = c.height = 1200; drawBadge(c.getContext('2d'), p, n, 0, 0, 1200); return { name, blob: await toBlob(c) }; },
  async coverPdf(p, bi, report) {
    const b = p.books[bi], sp = coverSpec(p.print.trim, b.pages || p.print.pages, p.print.paper), name = `${slug(p.series.name)}-book${b.number}-cover.pdf`; report(name);
    const c = document.createElement('canvas'); renderCover(c, p, bi, { ppi: KDP.DPI, thumbOf: (i, h) => frontThumb(p, i, h) });
    return { name, blob: pdfFromCanvases([c], sp.coverW, sp.coverH) };
  },
  async frontJpg(p, bi, report) {
    const b = p.books[bi], name = `${slug(p.series.name)}-book${b.number}-front.jpg`; report(name);
    const c = document.createElement('canvas'); renderCover(c, p, bi, { ppi: KDP.DPI, front: true, thumbOf: (i, h) => frontThumb(p, i, h) }); return { name, blob: await toBlob(c, 'image/jpeg', 0.92) };
  },
  async page(p, bi, kind, bleed, report) {
    const b = p.books[bi], name = `${slug(p.series.name)}-book${b.number}-${kind === 'title' ? 'p-title' : kind === 'belongs' ? 'p-belongs' : 'p-collect'}.png`; report(name);
    const c = document.createElement('canvas'); renderPage(c, p, bi, kind, { ppi: KDP.DPI, bleed }); return { name, blob: await toBlob(c) };
  },
  async guide(p, report) { const name = `${slug(p.series.name)}-style-guide.pdf`; report(name); const a = document.createElement('canvas'), b = document.createElement('canvas'); renderGuide(a, p, 0); renderGuide(b, p, 1); return { name, blob: pdfFromCanvases([a, b], 8.5, 11) }; },
  async shelf(p, style, ratio, focus, report) {
    const [W, H] = ratio === 'square' ? [2000, 2000] : [2400, 1350], name = `${slug(p.series.name)}-shelf-${style}-${ratio === 'square' ? '1x1' : '16x9'}.png`; report(name);
    const c = document.createElement('canvas'); renderShelf(c, p, style, W, H, focus); return { name, blob: await toBlob(c) };
  },
  prompts(p, report) { const name = `${slug(p.series.name)}-prompts.txt`; report(name); return { name, blob: new Blob([allPromptText(p)], { type: 'text/plain' }) }; },
};
