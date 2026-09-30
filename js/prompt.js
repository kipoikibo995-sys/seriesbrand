import { colorName } from './color.js';
export const ART_STYLES = [
  'warm, textured storybook illustration with bold shapes and rich colors',
  'soft watercolor storybook illustration with gentle edges and airy light',
  'bright flat vector illustration with clean shapes and cheerful colors',
  'cozy gouache picture-book illustration with visible brush texture',
  'chalk pastel children’s illustration with velvety grain',
];
export const RULE_SUGGESTIONS = ['no text or letters in the image', 'leave clear space at the top for the title', 'same character proportions on every page'];
const n = (p, r) => colorName(p.palette[r]);
export function styleBlock(p) {
  const s = p.stylePrompt, extra = (s.extraRules || '').trim();
  return `SERIES STYLE — "${p.series.name}"\nArt style: ${s.artStyle || ART_STYLES[0]}.\nColor palette: ${n(p, 'primary')}, ${n(p, 'secondary')}, ${n(p, 'accent')}, with soft ${n(p, 'background')} backgrounds and ${n(p, 'textDark')} outlines.\nKeep lighting, texture and line weight identical to Book 1 of this series.${extra ? '\n' + extra : ''}`;
}
export const characterBlocks = (p) => p.stylePrompt.heroes.filter((h) => h.name).map((h) => `CHARACTER LOCK — ${h.name}\n${h.name} is a ${h.species || 'character'} with ${h.colors || 'a consistent natural color scheme'}. Signature detail that never changes: ${h.detail || 'the same distinctive look'}. Personality: ${h.personality || 'friendly and curious'}.\nDraw ${h.name} with the same face, proportions, colors and outfit on every page.`);
export function coverPrompt(p) {
  const lay = { 'classic-top': 'the top-center area (logo) and the bottom 25% (title band)', 'classic-bottom': 'the top 22% (book title) and the bottom-left corner (logo)', frame: 'the top edge (logo) and the bottom 25% (title)', 'cloud-title': 'the top-center area (logo) and the bottom-center area (title cloud)' }[p.cover.layoutId];
  return `NEW COVER for this series — Book title: [BOOK TITLE]\nMain scene: [MAIN SCENE]\nSquare picture-book cover illustration in the series style above. Keep ${lay} calm and uncluttered so the logo and title can be placed there. Leave the ${p.badge.position.replace('-', ' ')} corner free for the book-number badge. No text or letters in the image.`;
}
export const interiorPrefix = (p) => `INTERIOR PAGE — use the exact series style: ${p.stylePrompt.artStyle || ART_STYLES[0]}; palette ${n(p, 'primary')}, ${n(p, 'secondary')}, ${n(p, 'accent')}, ${n(p, 'background')} background. Same characters, proportions and line weight as Book 1. Scene: `;
export const allPromptText = (p) => [styleBlock(p), ...characterBlocks(p), coverPrompt(p), interiorPrefix(p)].join('\n\n');
