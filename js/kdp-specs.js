// KDP paperback constants — source: KDP "Create a Paperback Cover" + "Barcodes". Edit here only.
export const KDP = {
  BLEED: 0.125,
  TEXT_INSET_MIN: 0.125,
  SAFE: 0.25,
  SPINE_PER_PAGE: { white: 0.002252, cream: 0.0025, premium_color: 0.002347, standard_color: 0.002252 },
  SPINE_TEXT_MIN_PAGES: 80,
  SPINE_TEXT_MARGIN: 0.0625,
  SPINE_VARIANCE: 0.0625,
  BARCODE_W: 2.0,
  BARCODE_H: 1.2,
  BARCODE_INSET: 0.25,
  MIN_FONT_PT: 7,
  DPI: 300,
  MIN_PAGES: 24,
};

export const TRIMS = { '8.5x8.5': [8.5, 8.5], '8.25x8.25': [8.25, 8.25], '8x10': [8, 10], '8.5x11': [8.5, 11] };
export const PAPERS = {
  premium_color: 'Premium color',
  standard_color: 'Standard color',
  white: 'White (B&W)',
  cream: 'Cream (B&W)',
};

const px = (inches) => Math.ceil(Math.round(inches * KDP.DPI * 1e6) / 1e6);

export function coverSpec(trim, pages, paper) {
  const [trimW, trimH] = TRIMS[trim] || TRIMS['8.5x8.5'];
  const spine = pages * (KDP.SPINE_PER_PAGE[paper] ?? KDP.SPINE_PER_PAGE.premium_color);
  const coverW = KDP.BLEED + trimW + spine + trimW + KDP.BLEED;
  const coverH = KDP.BLEED + trimH + KDP.BLEED;
  return {
    trimW, trimH, spine, coverW, coverH,
    pxW: px(coverW), pxH: px(coverH),
    frontPxW: px(trimW), frontPxH: px(trimH),
    spineText: pages >= KDP.SPINE_TEXT_MIN_PAGES,
  };
}

// Interior page with bleed: (trimW + 0.125) x (trimH + 0.25)
export function pageSpec(trim, bleed = true) {
  const [w, h] = TRIMS[trim] || TRIMS['8.5x8.5'];
  return bleed
    ? { w: w + KDP.BLEED, h: h + 2 * KDP.BLEED, trimW: w, trimH: h, bleed: true }
    : { w, h, trimW: w, trimH: h, bleed: false };
}

export const inToPx = px;
