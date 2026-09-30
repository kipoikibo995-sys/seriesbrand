// 12 hand-drawn icons on a 100x100 grid. part: {d, stroke?, hole?, mx?}
const C = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
export const ICONS = {
  leaf: [{ d: 'M50 6C88 24 92 66 50 94C8 66 12 24 50 6Z' }, { d: 'M50 30V86', stroke: 1, hole: 1 }],
  acorn: [{ d: 'M18 44Q50 8 82 44Z' }, { d: 'M26 50Q50 98 74 50Z' }, { d: 'M47 16H53V4H47Z' }],
  snowflake: [{ d: 'M50 8V92M13.6 29L86.4 71M13.6 71L86.4 29M41 17L50 26L59 17M41 83L50 74L59 83', stroke: 1 }],
  sun: [{ d: C(50, 50, 20) }, { d: 'M50 10V22M50 78V90M10 50H22M78 50H90M21.7 21.7L30 30M70 70L78.3 78.3M21.7 78.3L30 70M70 30L78.3 21.7', stroke: 1 }],
  moon: [{ d: 'M60 8A42 42 0 1 0 92 62A34 34 0 1 1 60 8Z' }],
  star: [{ d: 'M50 5L62 37L96 38L69 59L79 92L50 72L21 92L31 59L4 38L38 37Z' }],
  flower: [{ d: C(50, 22, 17) }, { d: C(77, 42, 17) }, { d: C(67, 75, 17) }, { d: C(33, 75, 17) }, { d: C(23, 42, 17) }, { d: C(50, 52, 12), hole: 1 }],
  raindrop: [{ d: 'M50 6C72 36 84 52 84 66A34 34 0 0 1 16 66C16 52 28 36 50 6Z' }],
  cloud: [{ d: C(30, 62, 20) }, { d: C(52, 44, 26) }, { d: C(74, 60, 20) }, { d: 'M30 82H74V60H30Z' }],
  butterfly: [{ d: 'M50 48C34 8 4 16 10 46C14 62 40 62 50 48Z' }, { d: 'M50 48C66 8 96 16 90 46C86 62 60 62 50 48Z' }, { d: 'M50 52C30 60 18 82 32 90C44 94 50 70 50 52Z' }, { d: 'M50 52C70 60 82 82 68 90C56 94 50 70 50 52Z' }, { d: 'M50 30V78', stroke: 1, hole: 1 }],
  magnifier: [{ d: C(40, 40, 27), stroke: 1 }, { d: 'M60 60L88 88', stroke: 1, w: 12 }],
  paw: [{ d: 'M50 50C32 50 22 68 28 80C34 92 44 84 50 84C56 84 66 92 72 80C78 68 68 50 50 50Z' }, { d: C(20, 44, 11) }, { d: C(38, 22, 11) }, { d: C(62, 22, 11) }, { d: C(80, 44, 11) }],
};
export const ICON_IDS = Object.keys(ICONS);
const cache = {};
// Draw icon into the box (x,y,size) filled with `color`; `holeColor` used for cut-outs.
export function drawIcon(ctx, id, x, y, size, color, holeColor, outline, outlineW = 0) {
  const parts = ICONS[id]; if (!parts) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const paint = (p, col, w) => {
    const path = (cache[p.d] ||= new Path2D(p.d));
    if (p.stroke) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(path); } else { ctx.fillStyle = col; ctx.fill(path); }
  };
  if (outline && outlineW) {
    for (const p of parts) { if (p.hole) continue; const path = (cache[p.d] ||= new Path2D(p.d)); ctx.strokeStyle = outline; ctx.lineWidth = (p.stroke ? (p.w || 7) : 0) + outlineW * 2 * (100 / size); ctx.stroke(path); }
  }
  for (const p of parts) paint(p, p.hole ? holeColor || color : color, p.w || 7);
  ctx.restore();
}
export const iconSvg = (id, color, hole) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="${color}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">${(ICONS[id] || []).map((p) => `<path d="${p.d}" ${p.stroke ? `fill="none" stroke-width="${p.w || 7}"` : 'stroke="none"'} ${p.hole ? `${p.stroke ? 'stroke' : 'fill'}="${hole}"` : ''}/>`).join('')}</svg>`;
