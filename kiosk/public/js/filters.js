/** Filter real-time. `css` dipakai preview video dan canvas saat menggambar photo. */
export const FILTERS = Object.freeze([
  { id: 'normal', nama: 'Normal', css: 'none', grain: false },
  { id: 'bw', nama: 'Hitam putih', css: 'grayscale(1) contrast(1.08)', grain: false },
  { id: 'sepia', nama: 'Sepia', css: 'sepia(0.78) saturate(1.12) contrast(1.04)', grain: false },
  { id: 'film', nama: 'Film grain', css: 'contrast(1.08) saturate(0.86) sepia(0.16)', grain: true },
  { id: 'warm', nama: 'Warm', css: 'sepia(0.3) saturate(1.18) brightness(1.05)', grain: false },
  { id: 'cool', nama: 'Cool', css: 'saturate(0.82) hue-rotate(-8deg) brightness(1.02)', grain: false },
  { id: 'contrast', nama: 'Kontras', css: 'contrast(1.38) saturate(1.08)', grain: false },
]);

export function filterById(id) {
  return FILTERS.find((filter) => filter.id === id) ?? FILTERS[0];
}
