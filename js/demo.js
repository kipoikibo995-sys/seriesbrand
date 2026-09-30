// Demo project with original procedural illustrations (no third-party art).
import { newProject, newBook, addImage, uid } from './store.js';
import { LOGO_DEFAULT_ROLES, images } from './draw.js';

function scene(kind, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 1536; const x = c.getContext('2d');
  const rnd = (() => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const sky = { dawn: ['#FFD9A0', '#F7A072'], forest: ['#BFE3C0', '#7FB98A'], night: ['#2B2F6B', '#6B5FA8'] }[kind];
  const g = x.createLinearGradient(0, 0, 0, 1536); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); x.fillStyle = g; x.fillRect(0, 0, 1536, 1536);
  if (kind === 'night') { x.fillStyle = '#FFF3C4'; for (let i = 0; i < 70; i++) { x.beginPath(); x.arc(rnd() * 1536, rnd() * 800, 2 + rnd() * 5, 0, 7); x.fill(); } x.beginPath(); x.arc(1150, 380, 130, 0, 7); x.fill(); x.fillStyle = '#6B5FA8'; x.beginPath(); x.arc(1205, 350, 120, 0, 7); x.fill(); }
  else { x.fillStyle = kind === 'dawn' ? '#FFF1B8' : '#FFE27A'; x.beginPath(); x.arc(400, 500, 150, 0, 7); x.fill(); x.strokeStyle = x.fillStyle; x.lineWidth = 14; x.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.moveTo(400 + Math.cos(a) * 190, 500 + Math.sin(a) * 190); x.lineTo(400 + Math.cos(a) * 250, 500 + Math.sin(a) * 250); x.stroke(); } }
  const hills = kind === 'night' ? ['#3A3F8A', '#2A2E66', '#1A1C3D'] : kind === 'dawn' ? ['#E07A2E', '#B85C24', '#8C3B1F'] : ['#6DBE6A', '#3F7D58', '#2E5A41'];
  hills.forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 1536); const y0 = 900 + i * 180; x.lineTo(0, y0); for (let t = 0; t <= 1536; t += 64) x.lineTo(t, y0 + Math.sin(t / 240 + i * 2 + seed) * 70); x.lineTo(1536, 1536); x.fill(); });
  for (let i = 0; i < 9; i++) { const tx = 80 + i * 170 + rnd() * 60, ty = 1150 + rnd() * 250, s = 60 + rnd() * 50; x.fillStyle = kind === 'night' ? '#1A1C3D' : '#2E5A41'; x.beginPath(); x.moveTo(tx, ty - s * 2.4); x.lineTo(tx + s, ty); x.lineTo(tx - s, ty); x.fill(); x.fillStyle = '#5C4033'; x.fillRect(tx - 8, ty, 16, 40); }
  // a simple friendly fox
  const fx = 780, fy = 1180; x.fillStyle = '#E07A2E'; x.beginPath(); x.ellipse(fx, fy, 130, 90, 0, 0, 7); x.fill(); x.beginPath(); x.arc(fx + 120, fy - 70, 70, 0, 7); x.fill();
  x.beginPath(); x.moveTo(fx + 70, fy - 120); x.lineTo(fx + 90, fy - 200); x.lineTo(fx + 125, fy - 130); x.fill(); x.beginPath(); x.moveTo(fx + 135, fy - 130); x.lineTo(fx + 170, fy - 200); x.lineTo(fx + 185, fy - 110); x.fill();
  x.beginPath(); x.moveTo(fx - 120, fy); x.quadraticCurveTo(fx - 260, fy - 140, fx - 210, fy + 40); x.quadraticCurveTo(fx - 160, fy + 60, fx - 120, fy + 20); x.fill(); x.fillStyle = '#FFF4E3'; x.beginPath(); x.arc(fx + 150, fy - 45, 38, 0, 7); x.fill();
  x.fillStyle = '#2B2118'; x.beginPath(); x.arc(fx + 130, fy - 85, 8, 0, 7); x.fill(); x.beginPath(); x.arc(fx + 185, fy - 60, 9, 0, 7); x.fill();
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
export async function demoProject() {
  const p = newProject(); images.clear();
  p.series = { name: 'Little Nature Detectives', tagline: 'Small explorers, big discoveries', author: 'Mia Hartley', ageRange: '3-7' };
  p.palette = { primary: '#E07A2E', secondary: '#3F7D58', accent: '#F2C94C', background: '#FFF6E8', textDark: '#2B2118', textLight: '#FFFFFF', locked: [], sourceImageId: null };
  p.logo = { layout: 'ribbon', iconId: 'magnifier', colorRoles: { ...LOGO_DEFAULT_ROLES.ribbon }, split: 0, arc: 1 };
  const titles = ['Who Stole the Daylight?', 'The Secret of the Whispering Woods', 'Stars Over Fox Hollow'], kinds = ['dawn', 'forest', 'night'];
  const blurbs = ['When the sun goes missing, Fern and Finn follow tiny clues across the meadow. A warm, curious first adventure for little nature detectives.', 'Something is whispering in the woods. Can the detectives find out what it is before sundown?', 'A quiet night, a twinkling sky and one very sleepy fox. The detectives learn the secrets of the stars.'];
  for (let i = 0; i < 3; i++) { const b = newBook(i + 1, 32); b.title = titles[i]; b.blurb = blurbs[i]; b.imageId = await addImage(await scene(kinds[i], 7 + i * 13), uid(), `demo-${i + 1}.png`); p.books.push(b); }
  p.palette.sourceImageId = p.books[0].imageId;
  p.stylePrompt = { artStyle: '', heroes: [{ name: 'Fern', species: 'red fox', colors: 'a burnt-orange coat and a cream chest', detail: 'a tiny green leaf tucked behind her left ear', personality: 'Curious and brave, always the first to follow a clue.' }], extraRules: 'no text or letters in the image' };
  return p;
}
