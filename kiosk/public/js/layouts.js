/**
 * Lima bentuk cetakan. Semua ukuran dalam piksel pada 300 DPI.
 * Setiap layout menyisihkan pita header/footer untuk tulisan bingkai,
 * sehingga ornamen tidak pernah menimpa area wajah.
 */
export const DPI = 300;

export const LAYOUTS = Object.freeze([
  {
    id: 'strip-2x6', nama: 'Strip 2×6', detail: 'Tiga photo berdiri, klasik photobooth.',
    poses: 3, size: { width: 600, height: 1800 }, figure: 'vertical',
  },
  {
    id: 'strip-4', nama: 'Strip 4 photo', detail: 'Empat jepret dalam satu strip sempit.',
    poses: 4, size: { width: 600, height: 1800 }, figure: 'four',
  },
  {
    id: 'grid-2x2', nama: 'Grid 2×2', detail: 'Empat photo seimbang di kertas 4×6.',
    poses: 4, size: { width: 1200, height: 1800 }, figure: 'square',
  },
  {
    id: 'collage-1-3', nama: 'Kolase 1+3', detail: 'Satu photo besar, tiga photo kecil di bawah.',
    poses: 4, size: { width: 1200, height: 1800 }, figure: 'collage',
  },
  {
    id: 'postcard', nama: 'Postcard', detail: 'Lanskap 6×4 dengan ruang tulisan lebar.',
    poses: 1, size: { width: 1800, height: 1200 }, figure: 'landscape',
  },
]);

export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

/** Hitung area foto dan koordinat tiap petak untuk layout tertentu. */
export function tilesFor(layout) {
  const { width, height } = layout.size;
  const margin = layout.id === 'postcard' ? 34 : 22;
  const header = layout.id === 'postcard' ? 76 : 96;
  const footer = layout.id === 'postcard' ? 118 : 124;
  const area = {
    x: margin,
    y: header,
    w: width - margin * 2,
    h: height - header - footer,
  };

  let tiles = [];
  if (layout.id === 'strip-2x6' || layout.id === 'strip-4') {
    const count = layout.poses;
    const gap = 10;
    const h = Math.floor((area.h - gap * (count - 1)) / count);
    tiles = Array.from({ length: count }, (_, i) => ({
      index: i, x: area.x, y: area.y + i * (h + gap), w: area.w, h,
    }));
  } else if (layout.id === 'grid-2x2') {
    const gap = 12;
    const w = Math.round((area.w - gap) / 2);
    const h = Math.round((area.h - gap) / 2);
    tiles = Array.from({ length: 4 }, (_, i) => ({
      index: i,
      x: area.x + (i % 2) * (w + gap),
      y: area.y + Math.floor(i / 2) * (h + gap),
      w, h,
    }));
  } else if (layout.id === 'collage-1-3') {
    const gap = 12;
    const bigH = Math.round(area.h * 0.56);
    const smallW = Math.round((area.w - gap * 2) / 3);
    const smallH = area.h - bigH - gap;
    tiles = [
      { index: 0, x: area.x, y: area.y, w: area.w, h: bigH },
      ...Array.from({ length: 3 }, (_, i) => ({
        index: i + 1, x: area.x + i * (smallW + gap), y: area.y + bigH + gap, w: smallW, h: smallH,
      })),
    ];
  } else {
    tiles = [{ index: 0, x: area.x, y: area.y, w: area.w, h: area.h }];
  }

  return { width, height, margin, header, footer, area, tiles };
}

export const PRINT_SIZES = Object.freeze([
  { id: '4x6', nama: '4 × 6 inci', detail: 'Foto biasa · 1200 × 1800 px', mm: '101.6mm 152.4mm' },
  { id: '2x6', nama: '2 × 6 inci', detail: 'Strip photobooth · 600 × 1800 px', mm: '50.8mm 152.4mm' },
  { id: '6x4', nama: '6 × 4 inci', detail: 'Postcard lanskap · 1800 × 1200 px', mm: '152.4mm 101.6mm' },
]);

export function printSizeForLayout(layout) {
  if (layout.id === 'postcard') return PRINT_SIZES[2];
  if (layout.id === 'strip-2x6' || layout.id === 'strip-4') return PRINT_SIZES[1];
  return PRINT_SIZES[0];
}
