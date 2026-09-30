# Series Brand Kit

Static, 100% client-side web app (no build step, no server) that turns a first picture book into a brand for the whole series: palette, fonts, logo, book badge, KDP covers, interior pages, ChatGPT style prompts, style-guide PDF and bookshelf mockups.

Styled in the Koji Launch / Ocean Novel look (navy / burnt orange / mustard / cream, Outfit + Inter + Caveat, pill buttons).

- Static site: deploy this folder as-is (Vercel, Netlify, GitHub Pages…). Locally: `python3 -m http.server`.
- Libraries are vendored in `lib/` (jsPDF, JSZip, opentype.js) and fonts in `fonts/` (OFL / Apache-2.0, licenses in `fonts/licenses/`), so it works offline after the first load. Only the UI fonts (Outfit/Inter/Caveat) come from Google Fonts and fall back to system fonts offline.
- KDP constants live in `js/kdp-specs.js`. Run `node tests.mjs` for the cover-size unit tests.
- Projects are saved as `.sbk` (zip with `project.json` + `images/`) and autosaved to IndexedDB every 5 s.
