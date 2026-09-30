// Color math, k-means palette extraction, role assignment, contrast, color names.
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const hexToRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export const hexToHsl = (h) => rgbToHsl(...hexToRgb(h));
export const hslToHex = (h, s, l) => rgbToHex(...hslToRgb(h, s, l));
export function rgbToLab(r, g, b) {
  const lin = (v) => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const R = lin(r), G = lin(g), B = lin(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function labToRgb(L, a, b) {
  const y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
  const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = f(x) * 0.95047, Y = f(y), Z = f(z) * 1.08883;
  const g = (v) => (v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v) * 255;
  return [g(X * 3.2406 + Y * -1.5372 + Z * -0.4986), g(X * -0.9689 + Y * 1.8758 + Z * 0.0415), g(X * 0.0557 + Y * -0.204 + Z * 1.057)];
}
export const hexToLab = (h) => rgbToLab(...hexToRgb(h));
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const rate = (ratio, need) => (ratio >= need ? 'Good' : ratio >= need * 0.75 ? 'Fair' : 'Poor');
// Move fg lightness away from bg until the ratio reaches `need`
export function fixContrast(fg, bg, need) {
  let [h, s, l] = hexToHsl(fg);
  const dir = luminance(bg) > 0.4 ? -1 : 1;
  for (let i = 0; i < 100 && contrast(hslToHex(h, s, l), bg) < need; i++) l = clamp(l + dir * 0.01, 0, 1);
  return hslToHex(h, s, l);
}
export const printWarn = (hex) => { const [, s, l] = hexToHsl(hex); return s > 0.9 && l >= 0.4 && l <= 0.6; };
export const shade = (hex, amt) => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, clamp(l + amt, 0, 1)); };
export const alpha = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// deterministic PRNG
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Extract up to 6 colors from an image source (ImageBitmap/HTMLImageElement). Returns roles.
export function extractPalette(img, prev) {
  const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
  const k = 160 / Math.max(W, H), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, pts = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) pts.push(rgbToLab(d[i], d[i + 1], d[i + 2]));
  return paletteFromLabPoints(pts, prev);
}

export function paletteFromLabPoints(pts, prev = {}) {
  const K = 8, rnd = mulberry(1234567);
  if (!pts.length) return { ...prev };
  // k-means++ init
  const cent = [pts[Math.floor(rnd() * pts.length)].slice()];
  while (cent.length < K) {
    const dist = pts.map((p) => Math.min(...cent.map((c) => deltaE(p, c) ** 2)));
    const sum = dist.reduce((a, b) => a + b, 0);
    if (!sum) break;
    let r = rnd() * sum, i = 0;
    while (i < dist.length - 1 && (r -= dist[i]) > 0) i++;
    cent.push(pts[i].slice());
  }
  let assign = new Array(pts.length).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < cent.length; j++) { const dd = deltaE(pts[i], cent[j]); if (dd < bd) { bd = dd; best = j; } }
      assign[i] = best;
    }
    const sums = cent.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sums.forEach((s, j) => { if (s[3]) cent[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const counts = cent.map(() => 0);
  assign.forEach((a) => counts[a]++);
  let cl = cent.map((lab, j) => ({ lab, n: counts[j] })).filter((c) => c.n / pts.length >= 0.02);
  // merge close clusters (dE < 12)
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
      if (deltaE(cl[i].lab, cl[j].lab) < 12) {
        const a = cl[i], b = cl[j], n = a.n + b.n;
        cl[i] = { lab: a.lab.map((v, x) => (v * a.n + b.lab[x] * b.n) / n), n };
        cl.splice(j, 1); merged = true; break outer;
      }
    }
  }
  cl = cl.map((c) => {
    const rgb = labToRgb(...c.lab), hex = rgbToHex(...rgb), [hh, s, l] = rgbToHsl(...rgb.map((v) => clamp(v, 0, 255)));
    return { ...c, hex, h: hh, s, l, frac: c.n / pts.length, score: (c.n / pts.length) * (0.5 + s) };
  });
  const out = {};
  const bgC = cl.filter((c) => c.lab[0] > 85 && c.s < 0.4).sort((a, b) => b.lab[0] - a.lab[0])[0];
  const tdC = cl.filter((c) => c.lab[0] < 25).sort((a, b) => a.lab[0] - b.lab[0])[0];
  out.background = bgC ? bgC.hex : '#FFF8EE';
  out.textDark = tdC ? tdC.hex : '#2B2118';
  out.textLight = '#FFFFFF';
  let rest = cl.filter((c) => c !== bgC && c !== tdC).sort((a, b) => b.score - a.score);
  // prefer colors apart by dE > 20
  const spread = [];
  for (const c of rest) if (spread.every((s) => deltaE(s.lab, c.lab) > 20)) spread.push(c);
  rest = spread.length ? spread : rest;
  const pri = rest[0];
  out.primary = pri ? pri.hex : '#E07A2E';
  const hd = (a, b) => { const x = Math.abs(a - b) % 360; return x > 180 ? 360 - x : x; };
  const sec = pri && rest.slice(1).find((c) => hd(c.h, pri.h) > 40);
  out.secondary = sec ? sec.hex : shade(out.primary, -0.25);
  const acc = rest.filter((c) => c !== pri && c !== sec).sort((a, b) => b.s - a.s)[0];
  if (acc) out.accent = acc.hex;
  else { const [hh, s, l] = hexToHsl(out.primary); out.accent = hslToHex(hh + 180, Math.max(s, 0.6), clamp(l, 0.5, 0.65)); }
  return out;
}

// ~60 named colors for the ChatGPT prompt
const NAMES = {
  '#000000': 'black', '#FFFFFF': 'white', '#808080': 'gray', '#C0C0C0': 'silver', '#36454F': 'charcoal', '#F5F5DC': 'beige', '#FFFDD0': 'cream', '#FFF8EE': 'warm ivory', '#F5DEB3': 'wheat', '#D2B48C': 'tan',
  '#8B4513': 'saddle brown', '#A0522D': 'sienna', '#5C4033': 'dark brown', '#3A2416': 'espresso brown', '#C19A6B': 'camel', '#E97451': 'terracotta', '#CC5500': 'burnt orange', '#FF7F00': 'orange', '#F29E38': 'amber orange', '#FFBF00': 'amber',
  '#F2B33D': 'golden yellow', '#FFD84D': 'sunny yellow', '#FFFF66': 'lemon yellow', '#F7D154': 'butter yellow', '#E3C565': 'mustard', '#B8860B': 'dark goldenrod', '#DC143C': 'crimson', '#FF0000': 'red', '#B22222': 'brick red', '#800020': 'burgundy',
  '#FF7F7F': 'coral', '#FA8072': 'salmon', '#FFB6C1': 'light pink', '#E97FA3': 'rose pink', '#FF69B4': 'hot pink', '#C71585': 'magenta', '#DDA0DD': 'lilac', '#9370DB': 'lavender purple', '#6A0DAD': 'royal purple', '#4B0082': 'indigo',
  '#3B3F8F': 'deep indigo blue', '#1A1C3D': 'midnight blue', '#000080': 'navy', '#1F3A5F': 'dark navy blue', '#3E7CB1': 'steel blue', '#4169E1': 'royal blue', '#0000FF': 'blue', '#87CEEB': 'sky blue', '#9FD3E6': 'pale sky blue', '#ADD8E6': 'light blue',
  '#2BA3B8': 'teal blue', '#008080': 'teal', '#40E0D0': 'turquoise', '#AFEEEE': 'pale turquoise', '#98FF98': 'mint', '#6DBE6A': 'leaf green', '#3F7D58': 'forest green', '#228B22': 'green', '#2E3B24': 'deep olive green', '#556B2F': 'olive green',
  '#9ACD32': 'lime green', '#8FBC8F': 'sage green', '#F4F8FB': 'icy white', '#EEF0FF': 'pale periwinkle', '#FBFFF3': 'pale spring white', '#FFF4E3': 'warm cream', '#8C3B1F': 'rust brown', '#D9642B': 'burnt orange', '#E07A2E': 'pumpkin orange',
};
const NAME_LAB = Object.entries(NAMES).map(([hex, n]) => ({ n, lab: hexToLab(hex) }));
export function colorName(hex) {
  const lab = hexToLab(hex);
  let best = NAME_LAB[0], bd = Infinity;
  for (const c of NAME_LAB) { const d = deltaE(lab, c.lab); if (d < bd) { bd = d; best = c; } }
  return best.n;
}

export const PRESETS = {
  Autumn: { primary: '#D9642B', secondary: '#8C3B1F', accent: '#F2B33D', background: '#FFF4E3', textDark: '#3A2416' },
  Winter: { primary: '#3E7CB1', secondary: '#1F3A5F', accent: '#9FD3E6', background: '#F4F8FB', textDark: '#1B2635' },
  Spring: { primary: '#6DBE6A', secondary: '#E97FA3', accent: '#F7D154', background: '#FBFFF3', textDark: '#2E3B24' },
  Summer: { primary: '#F29E38', secondary: '#2BA3B8', accent: '#FFD84D', background: '#FFF9EC', textDark: '#33261A' },
  'Sky & Night': { primary: '#3B3F8F', secondary: '#1A1C3D', accent: '#F5C86A', background: '#EEF0FF', textDark: '#14152B' },
};
