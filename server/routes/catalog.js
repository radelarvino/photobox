import { Router } from 'express';
import { queries } from '../db.js';

const router = Router();

const mmToPx = (mm, dpi) => Math.round((mm * dpi) / 25.4);

let cached = null;
let cachedAt = 0;
const TTL = 60_000;

function buildCatalog() {
  const paperSizes = queries.paperSizes().map((p) => ({
    id: p.id,
    nama: p.nama,
    lebarMm: p.lebar_mm,
    tinggiMm: p.tinggi_mm,
    dpi: p.dpi,
    layout: p.layout,
    posesMin: p.poses_min,
    posesMax: p.poses_max,
    deskripsi: p.deskripsi,
    lebarPx: mmToPx(p.lebar_mm, p.dpi),
    tinggiPx: mmToPx(p.tinggi_mm, p.dpi),
  }));

  return {
    borders: queries.borders(),
    filters: queries.filters(),
    paperSizes,
  };
}

/** Semua katalog sekaligus: menghemat tiga permintaan saat halaman dibuka. */
router.get('/catalog', (_req, res) => {
  if (!cached || Date.now() - cachedAt > TTL) {
    cached = buildCatalog();
    cachedAt = Date.now();
  }
  // Cache dibatasi middleware /api: data katalog tetap segar tanpa cache bersama.
  res.json(cached);
});

router.get('/borders', (_req, res) => res.json({ data: queries.borders() }));
router.get('/filters', (_req, res) => res.json({ data: queries.filters() }));

router.get('/paper-sizes', (_req, res) => {
  res.json({ data: buildCatalog().paperSizes });
});

export default router;
