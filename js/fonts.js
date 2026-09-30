// Curated OFL / Apache-2.0 font pairs, bundled as static TTF in /fonts (licenses in /fonts/licenses).
const F = (file, family) => ({ file, family });
export const FONT_FILES = {
  fredoka: F('Fredoka-SemiBold.ttf', 'SBK Fredoka'), baloo2: F('Baloo2-ExtraBold.ttf', 'SBK Baloo 2'), chewy: F('Chewy.ttf', 'SBK Chewy'),
  luckiest: F('LuckiestGuy.ttf', 'SBK Luckiest Guy'), grandstander: F('Grandstander-Bold.ttf', 'SBK Grandstander'), sniglet: F('Sniglet.ttf', 'SBK Sniglet'),
  nunito: F('Nunito-SemiBold.ttf', 'SBK Nunito'), quicksand: F('Quicksand-SemiBold.ttf', 'SBK Quicksand'), andika: F('Andika.ttf', 'SBK Andika'), mali: F('Mali.ttf', 'SBK Mali'),
};
export const FONT_PAIRS = {
  fredoka_nunito: { title: 'fredoka', body: 'nunito', name: 'Fredoka SemiBold + Nunito', feel: 'Round, friendly (default)' },
  baloo_quicksand: { title: 'baloo2', body: 'quicksand', name: 'Baloo 2 ExtraBold + Quicksand', feel: 'Chunky, cheerful' },
  chewy_nunito: { title: 'chewy', body: 'nunito', name: 'Chewy + Nunito', feel: 'Cartoon, mischievous' },
  luckiest_andika: { title: 'luckiest', body: 'andika', name: 'Luckiest Guy + Andika', feel: 'Comic bold; Andika is made for early readers' },
  grandstander_mali: { title: 'grandstander', body: 'mali', name: 'Grandstander Bold + Mali', feel: 'Hand-drawn, warm' },
  sniglet_quicksand: { title: 'sniglet', body: 'quicksand', name: 'Sniglet ExtraBold + Quicksand', feel: 'Soft, gentle' },
};
export const buffers = {}; // key -> ArrayBuffer (kept for opentype.js SVG export)
const loaded = {};
export function loadFont(key) {
  if (loaded[key]) return loaded[key];
  const { file, family } = FONT_FILES[key];
  return (loaded[key] = fetch('fonts/' + file).then((r) => r.arrayBuffer()).then(async (buf) => {
    buffers[key] = buf;
    const ff = new FontFace(family, buf);
    await ff.load();
    document.fonts.add(ff);
  }));
}
export async function loadAllFonts() { await Promise.all(Object.keys(FONT_FILES).map(loadFont)); await document.fonts.ready; }
export const fam = (key) => `"${FONT_FILES[key].family}"`;
export function fontsOf(project) {
  const p = FONT_PAIRS[project.fonts.pairId] || FONT_PAIRS.fredoka_nunito;
  return { title: (s) => `${s}px ${fam(p.title)}`, body: (s) => `${s}px ${fam(p.body)}`, titleKey: p.title, bodyKey: p.body };
}

function splitMid(text) {
  const words = text.split(' ');
  if (words.length < 2) return [text];
  const mid = text.length / 2;
  let best = 1, bd = Infinity, pos = 0;
  for (let i = 1; i < words.length; i++) { pos += words[i - 1].length + 1; const dd = Math.abs(pos - mid); if (dd < bd) { bd = dd; best = i; } }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}
// Shrink 2% per step until it fits; at minSize wrap to max 2 lines near the middle.
export function fitText(ctx, text, font, maxW, maxH, startSize, minSize, ls = 0) {
  const saveLS = ctx.letterSpacing;
  const setLS = (s) => { if ('letterSpacing' in ctx) ctx.letterSpacing = ls ? ls + 'px' : '0px'; };
  setLS();
  let lines = [text], s = startSize;
  const fits = () => lines.every((l) => { ctx.font = font(s); return ctx.measureText(l).width <= maxW; }) && lines.length * s * 1.08 <= maxH;
  while (!fits() && s > minSize) s *= 0.98;
  if (!fits() && text.includes(' ')) {
    lines = splitMid(text); s = startSize;
    while (!fits() && s > minSize * 0.4) s *= 0.98;
  }
  const ok = fits();
  if ('letterSpacing' in ctx) ctx.letterSpacing = saveLS || '0px';
  return { lines, size: s, ok };
}
export function wrapText(ctx, text, font, size, maxW) {
  ctx.font = font(size);
  const out = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
