/** Stiker halus berupa path SVG — tajam di resolusi cetak, bukan emoji. */
export const STICKERS = Object.freeze([
  {
    id: 'sprig', nama: 'Ranting kecil',
    path: 'M32 78C30 54 31 36 38 20M34 52C24 50 18 42 16 34M34 44C44 42 50 34 52 26M35 64C45 62 51 56 54 48M32 32C27 27 25 21 26 15',
    fill: false,
  },
  {
    id: 'bloom', nama: 'Bunga kecil',
    path: 'M32 32C24 20 26 10 32 6c6 4 8 14 0 26ZM32 32C44 24 54 26 58 32c-4 6-14 8-26 0ZM32 32C40 44 38 54 32 58c-6-4-8-14 0-26ZM32 32C20 40 10 38 6 32c4-6 14-8 26 0Z',
    fill: true,
  },
  {
    id: 'star', nama: 'Bintang sederhana',
    path: 'M32 5 38 25 58 31 38 37 32 57 26 37 6 31 26 25Z',
    fill: true,
  },
  {
    id: 'heart', nama: 'Hati',
    path: 'M32 56C22 46 10 38 10 26a12 12 0 0 1 22-6 12 12 0 0 1 22 6c0 12-12 20-22 30Z',
    fill: true,
  },
  {
    id: 'seal', nama: 'Segel lilin',
    path: 'M18 14h28v28H18zM23 19h18v18H23z',
    fill: true,
  },
  {
    id: 'spark', nama: 'Kilau halus',
    path: 'M32 6c1.6 15 5 18 20 20-15 2-18 5-20 20-2-15-5-18-20-20 15-2 18-5 20-20Z',
    fill: true,
  },
]);

export function stickerById(id) {
  return STICKERS.find((sticker) => sticker.id === id) ?? STICKERS[0];
}

/** Path2D dari data SVG. viewBox semua stiker adalah 64 × 64. */
export function stickerPath(sticker) {
  return new Path2D(sticker.path);
}

/** Ikon SVG untuk tombol pemilih stiker. */
export function stickerIcon(sticker) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', sticker.path);
  svg.append(path);
  return svg;
}
