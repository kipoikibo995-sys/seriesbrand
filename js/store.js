import { images } from './draw.js';
import { LOGO_DEFAULT_ROLES } from './draw.js';

export const uid = () => 'img_' + Math.random().toString(36).slice(2, 9);
export function newProject() {
  return {
    version: 1,
    series: { name: '', tagline: '', author: '', ageRange: '3-7' },
    print: { trim: '8.5x8.5', pages: 32, paper: 'premium_color' },
    palette: { primary: '#E07A2E', secondary: '#3F7D58', accent: '#F2C94C', background: '#FFF6E8', textDark: '#2B2118', textLight: '#FFFFFF', locked: [], sourceImageId: null },
    fonts: { pairId: 'fredoka_nunito', titleScale: 1.0, letterSpacing: 0, outline: 6, shadow: true, caps: false },
    logo: { layout: 'ribbon', iconId: 'leaf', colorRoles: { ...LOGO_DEFAULT_ROLES.ribbon }, split: 0, arc: 1 },
    badge: { style: 'circle', label: 'Book {n}', position: 'top-right', colorRoles: { fill: 'accent', text: 'textDark', outline: 'textLight' } },
    cover: { layoutId: 'classic-top', showGuides: true, backBlurbDefault: '', spineColor: 'primary', backBlur: false, barcodeWhite: false },
    books: [],
    stylePrompt: { artStyle: '', heroes: [], extraRules: '' },
  };
}
export const newBook = (n, pages = 32) => ({ id: 'b' + Math.random().toString(36).slice(2, 8), number: n, title: '', subtitle: '', imageId: null, imageCrop: { x: 0, y: 0, scale: 1 }, blurb: '', pages });
export function ensureBooks(p, count) {
  while (p.books.length < count) p.books.push(newBook(p.books.length + 1, p.print.pages));
  p.books.length = count; p.books.forEach((b, i) => (b.number = i + 1));
}
export function normalize(p) { // fill defaults for older/partial files
  const d = newProject();
  const merge = (a, b) => { for (const k in b) { if (a[k] === undefined) a[k] = b[k]; else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) merge(a[k], b[k]); } return a; };
  return merge(p, d);
}

/* ---------- image registry ---------- */
export async function addImage(blob, id = uid(), name = '') {
  const bmp = await createImageBitmap(blob);
  images.set(id, { bmp, w: bmp.width, h: bmp.height, blob, name });
  return id;
}

/* ---------- IndexedDB autosave ---------- */
let dbp;
function db() {
  return (dbp ||= new Promise((res, rej) => {
    try {
      const r = indexedDB.open('series-brand-kit', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('images'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }));
}
const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
export async function autosave(p) {
  await tx('kv', 'readwrite', (s) => s.put(JSON.stringify(p), 'project'));
  const have = await tx('images', 'readonly', (s) => s.getAllKeys());
  await tx('images', 'readwrite', (s) => {
    for (const [id, im] of images) if (!have.includes(id)) s.put({ blob: im.blob, name: im.name }, id);
    for (const id of have) if (!images.has(id)) s.delete(id);
  });
}
export async function loadAutosave() {
  const raw = await tx('kv', 'readonly', (s) => s.get('project')); if (!raw) return null;
  const p = normalize(JSON.parse(raw)), keys = await tx('images', 'readonly', (s) => s.getAllKeys());
  images.clear();
  for (const id of keys) { const v = await tx('images', 'readonly', (s) => s.get(id)); await addImage(v.blob, id, v.name); }
  return p;
}
export async function clearAutosave() { try { await tx('kv', 'readwrite', (s) => s.clear()); await tx('images', 'readwrite', (s) => s.clear()); } catch {} }

/* ---------- .sbk = zip(project.json + images/) ---------- */
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export async function saveSbk(p) {
  const zip = new JSZip(); zip.file('project.json', JSON.stringify(p, null, 1));
  for (const [id, im] of images) zip.file(`images/${id}.${EXT[im.blob.type] || 'png'}`, im.blob);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export async function openSbk(file) {
  const zip = await JSZip.loadAsync(file);
  const pj = zip.file('project.json'); if (!pj) throw new Error('bad');
  const p = JSON.parse(await pj.async('string'));
  if (p.version !== 1 || !p.series || !p.palette || !Array.isArray(p.books)) throw new Error('bad');
  const loaded = new Map();
  for (const name of Object.keys(zip.files)) {
    const m = /^images\/(.+)\.(png|jpg|webp)$/.exec(name); if (!m) continue;
    const type = m[2] === 'jpg' ? 'image/jpeg' : 'image/' + m[2], blob = new Blob([await zip.files[name].async('arraybuffer')], { type });
    loaded.set(m[1], blob);
  }
  images.clear();
  for (const [id, blob] of loaded) await addImage(blob, id);
  return normalize(p);
}
