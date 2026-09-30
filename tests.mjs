// node public/series-brand-kit/tests.mjs
import { coverSpec } from './js/kdp-specs.js';
import assert from 'node:assert/strict';
const cases = [
  ['8.5x8.5', 32, 'premium_color', 0.0751, 17.3251, 8.75, 5198, 2625, false],
  ['8x10', 40, 'standard_color', 0.0901, 16.3401, 10.25, 4903, 3075, false],
  ['8.5x11', 100, 'white', 0.2252, 17.4752, 11.25, 5243, 3375, true],
];
for (const [t, p, paper, sp, cw, ch, pw, ph, st] of cases) {
  const s = coverSpec(t, p, paper);
  assert.equal(+s.spine.toFixed(4), sp);
  assert.equal(+s.coverW.toFixed(4), cw);
  assert.equal(s.coverH, ch);
  assert.equal(s.pxW, pw);
  assert.equal(s.pxH, ph);
  assert.equal(s.spineText, st);
}
console.log('kdp-specs: all', cases.length, 'cases pass');
