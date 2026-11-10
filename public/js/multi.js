/**
 * Mode multi-cetak.
 *
 * Satu lembar kertas fisik bisa diisi beberapa salinan desain yang lebih kecil.
 * Contoh: kertas 4R (4 × 6 inci) diisi dua strip 2 × 6 inci, atau A4 diisi
 * empat foto 3R dalam grid 2 × 2. Semua ukuran mengikuti 300 DPI.
 */

import { paperPixels } from './layout.js';

const single = (paperId) => ({
  id: 'single',
  nama: '1 foto',
  detail: 'Satu hasil penuh di kertas ini',
  copies: 1,
  designId: paperId,
  cols: 1,
  rows: 1,
});

export const MULTI_MODES = {
  '4r': [
    single('4r'),
    {
      id: '2-strip',
      nama: '2 strip 2×6',
      detail: 'Dua strip identik, butuh 3–4 pose',
      copies: 2,
      designId: 'strip',
      cols: 2,
      rows: 1,
    },
  ],
  a4: [
    single('a4'),
    {
      id: '2-4r',
      nama: '2 foto 4R',
      detail: 'Dua foto 4R berdampingan',
      copies: 2,
      designId: '4r',
      cols: 2,
      rows: 1,
    },
    {
      id: '4-3r',
      nama: '4 foto 3R',
      detail: 'Grid 2 × 2, hemat kertas A4',
      copies: 4,
      designId: '3r',
      cols: 2,
      rows: 2,
    },
  ],
};

/** Daftar mode untuk kertas tertentu; kertas lain hanya satu salinan. */
export function modesFor(paperId) {
  return MULTI_MODES[paperId] ?? [single(paperId)];
}

/** Ambil mode berdasarkan id, dengan fallback ke mode pertama. */
export function modeFor(paperId, modeId) {
  const list = modesFor(paperId);
  return list.find((mode) => mode.id === modeId) ?? list[0];
}

/**
 * Hitung ukuran lembar keluaran dan posisi setiap salinan.
 *
 * `scale` 1 = 300 DPI penuh. Mengembalikan `null` bila susunan tidak muat,
 * supaya kombinasi mode yang salah tidak menghasilkan potongan terluar.
 */
export function computeTiles({
  outputPaper,
  designPaper,
  cols = 1,
  rows = 1,
  scale = 1,
}) {
  const output = paperPixels(outputPaper);
  const design = paperPixels(designPaper);

  const width = Math.round(output.width * scale);
  const height = Math.round(output.height * scale);
  const tileW = Math.round(design.width * scale);
  const tileH = Math.round(design.height * scale);
  const totalW = tileW * cols;
  const totalH = tileH * rows;

  if (totalW > width || totalH > height) return null;

  const offsetX = Math.round((width - totalW) / 2);
  const offsetY = Math.round((height - totalH) / 2);
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        index: tiles.length,
        x: offsetX + col * tileW,
        y: offsetY + row * tileH,
        w: tileW,
        h: tileH,
        col,
        row,
      });
    }
  }

  return {
    width,
    height,
    tileW,
    tileH,
    offsetX,
    offsetY,
    tiles,
  };
}
