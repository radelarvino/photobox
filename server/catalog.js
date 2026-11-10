/**
 * Katalog bawaan Photobox.
 *
 * Border disimpan sebagai dekorasi vektor (bukan berkas PNG) supaya selalu
 * tajam di resolusi 300 DPI berapa pun ukuran kertasnya. Kolom `file_gambar`
 * tetap disediakan sesuai PRD untuk border berbasis gambar di masa depan.
 */

export const borders = [
  {
    id: 'plain',
    nama: 'Polos',
    kategori: 'Dasar',
    style: 'plain',
    params: {
      bg: '#FFF8F1',
      accent: '#FF7A9C',
      ink: '#3B2A36',
      radius: 2.4,
      inset: { t: 6, r: 6, b: 6, l: 6 },
    },
  },
  {
    id: 'polaroid',
    nama: 'Polaroid',
    kategori: 'Klasik',
    style: 'polaroid',
    params: {
      bg: '#FFFFFF',
      accent: '#FFB3C7',
      ink: '#4A3B45',
      radius: 1.2,
      inset: { t: 6, r: 6, b: 26, l: 6 },
      title: 'photobox',
    },
  },
  {
    id: 'hearts',
    nama: 'Hati',
    kategori: 'Manis',
    style: 'hearts',
    params: {
      bg: '#FFE3EC',
      accent: '#FF5C8A',
      ink: '#7A2F49',
      radius: 2.4,
      inset: { t: 8, r: 8, b: 12, l: 8 },
      title: 'with love',
    },
  },
  {
    id: 'stars',
    nama: 'Bintang',
    kategori: 'Malam',
    style: 'stars',
    params: {
      bg: '#20244F',
      accent: '#FFD166',
      ink: '#FFF6E5',
      radius: 2.4,
      inset: { t: 8, r: 8, b: 12, l: 8 },
      title: 'sweet dreams',
    },
  },
  {
    id: 'clouds',
    nama: 'Awan',
    kategori: 'Ceria',
    style: 'clouds',
    params: {
      bg: '#DCF1FF',
      accent: '#8ED3FF',
      ink: '#2E5A88',
      radius: 2.4,
      inset: { t: 10, r: 8, b: 12, l: 8 },
      title: 'daydream',
    },
  },
  {
    id: 'film',
    nama: 'Retro Film',
    kategori: 'Retro',
    style: 'film',
    params: {
      bg: '#17161A',
      accent: '#FFB020',
      ink: '#F5F2EA',
      radius: 0.8,
      inset: { t: 9, r: 15, b: 9, l: 15 },
      title: 'PHOTOBOX 400',
    },
  },
  {
    id: 'birthday',
    nama: 'Ulang Tahun',
    kategori: 'Acara',
    style: 'birthday',
    params: {
      bg: '#FFF3C4',
      accent: '#FF6B6B',
      ink: '#6A3B12',
      radius: 2.4,
      inset: { t: 12, r: 8, b: 16, l: 8 },
      title: 'Happy Birthday!',
    },
  },
  {
    id: 'wedding',
    nama: 'Pernikahan',
    kategori: 'Acara',
    style: 'wedding',
    params: {
      bg: '#FFF9F2',
      accent: '#C9A227',
      ink: '#6B5B45',
      radius: 0.6,
      inset: { t: 10, r: 10, b: 16, l: 10 },
      title: 'Together Forever',
    },
  },
  {
    id: 'campus',
    nama: 'Kampus',
    kategori: 'Acara',
    style: 'campus',
    params: {
      bg: '#1B2A4A',
      accent: '#F2C14E',
      ink: '#FFFFFF',
      radius: 1.6,
      inset: { t: 11, r: 8, b: 15, l: 8 },
      title: 'Class of 2026',
    },
  },
  {
    id: 'confetti',
    nama: 'Konfeti',
    kategori: 'Ceria',
    style: 'confetti',
    params: {
      bg: '#E4FBF1',
      accent: '#2EC4B6',
      ink: '#14524A',
      radius: 2.4,
      inset: { t: 9, r: 8, b: 14, l: 8 },
      title: 'Say cheese!',
    },
  },
  {
    id: 'retro',
    nama: 'Retro 70an',
    kategori: 'Retro',
    style: 'retro',
    params: {
      bg: '#FFE8D6',
      accent: '#E76F51',
      ink: '#5F2A1E',
      radius: 2.4,
      inset: { t: 13, r: 8, b: 18, l: 8 },
      title: 'Good times',
    },
  },
  {
    id: 'postcard',
    nama: 'Poskad',
    kategori: 'Klasik',
    style: 'postcard',
    params: {
      bg: '#FFFDF5',
      accent: '#4A7C59',
      ink: '#3F4A3C',
      radius: 1.2,
      inset: { t: 9, r: 9, b: 18, l: 11 },
      title: 'wish you were here',
    },
  },
];

/**
 * Filter memakai sintaks CSS `filter` yang sama untuk pratinjau dan kanvas
 * hasil akhir, sehingga apa yang terlihat sama dengan yang diunduh.
 * `vignette` dan `tint` opsional, digambar terpisah di kanvas.
 */
export const filters = [
  {
    id: 'normal',
    nama: 'Normal',
    params: { css: 'none' },
  },
  {
    id: 'bw',
    nama: 'Hitam Putih',
    params: { css: 'grayscale(1) contrast(1.08)' },
  },
  {
    id: 'sepia',
    nama: 'Sepia',
    params: { css: 'sepia(0.85) saturate(1.1) contrast(1.02)' },
  },
  {
    id: 'vintage',
    nama: 'Vintage',
    params: {
      css: 'sepia(0.32) saturate(0.82) contrast(1.12) brightness(0.96)',
      vignette: 0.28,
    },
  },
  {
    id: 'cerah',
    nama: 'Cerah',
    params: {
      css: 'brightness(1.12) saturate(1.15) contrast(1.02)',
    },
  },
  {
    id: 'pastel',
    nama: 'Pastel',
    params: {
      css: 'saturate(0.75) brightness(1.1) contrast(0.92)',
      tint: 'rgba(255, 214, 234, 0.16)',
    },
  },
  {
    id: 'hangat',
    nama: 'Hangat',
    params: {
      css: 'sepia(0.18) saturate(1.2) brightness(1.04)',
      tint: 'rgba(255, 168, 92, 0.10)',
    },
  },
  {
    id: 'dingin',
    nama: 'Dingin',
    params: {
      css: 'saturate(0.95) contrast(1.05) brightness(1.02)',
      tint: 'rgba(110, 178, 255, 0.14)',
    },
  },
  {
    id: 'film',
    nama: 'Film',
    params: {
      css: 'saturate(0.88) contrast(1.18) brightness(0.98)',
      vignette: 0.4,
      tint: 'rgba(255, 190, 120, 0.06)',
    },
  },
  {
    id: 'fade',
    nama: 'Fade',
    params: {
      css: 'saturate(0.7) contrast(0.88) brightness(1.08)',
      tint: 'rgba(255, 255, 255, 0.12)',
    },
  },
];

export const paperSizes = [
  {
    id: '3r',
    nama: '3R',
    lebar_mm: 88.9,
    tinggi_mm: 127,
    dpi: 300,
    layout: 'grid',
    poses_min: 1,
    poses_max: 4,
    urutan: 1,
    deskripsi: '3,5 × 5 inci · mungil untuk dompet',
  },
  {
    id: '4r',
    nama: '4R',
    lebar_mm: 101.6,
    tinggi_mm: 152.4,
    dpi: 300,
    layout: 'grid',
    poses_min: 1,
    poses_max: 4,
    urutan: 2,
    deskripsi: '4 × 6 inci · ukuran cetak paling umum',
  },
  {
    id: '5r',
    nama: '5R',
    lebar_mm: 127,
    tinggi_mm: 177.8,
    dpi: 300,
    layout: 'grid',
    poses_min: 1,
    poses_max: 4,
    urutan: 3,
    deskripsi: '5 × 7 inci · lebih lega untuk dipajang',
  },
  {
    id: 'a4',
    nama: 'A4',
    lebar_mm: 210,
    tinggi_mm: 297,
    dpi: 300,
    layout: 'grid',
    poses_min: 1,
    poses_max: 4,
    urutan: 4,
    deskripsi: '210 × 297 mm · untuk dicetak di rumah',
  },
  {
    id: 'strip',
    nama: 'Strip 2×6',
    lebar_mm: 50.8,
    tinggi_mm: 152.4,
    dpi: 300,
    layout: 'strip',
    poses_min: 3,
    poses_max: 4,
    urutan: 5,
    deskripsi: '2 × 6 inci · strip photobooth klasik',
  },
];
