import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { queries } from '../db.js';
import { uploadPhoto, absolutePath, relativePath, RETENTION_DAYS } from '../storage.js';
import { readImageSize } from '../image-size.js';

const router = Router();

const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const httpError = (status, message, code) =>
  Object.assign(new Error(message), { status, code });

function requireSession(req, res, next) {
  const id = String(req.get('x-session-id') ?? '').trim();
  if (!SESSION_RE.test(id)) {
    return res.status(400).json({
      error: 'Header X-Session-Id tidak valid.',
      code: 'INVALID_SESSION',
    });
  }
  req.sessionId = id;
  queries.touchSession(id);
  next();
}

const runUpload = (req, res) =>
  new Promise((resolve, reject) => {
    uploadPhoto(req, res, (error) => (error ? reject(error) : resolve()));
  });

const publicPhoto = (row) => ({
  id: row.id,
  borderId: row.border_id,
  filterId: row.filter_id,
  paperSizeId: row.paper_size_id,
  lebarPx: row.lebar_px,
  tinggiPx: row.tinggi_px,
  dpi: row.dpi,
  jumlahPose: row.jumlah_pose,
  intensitas: row.intensitas,
  mode: row.mode ?? 'single',
  lapisan: parseLapisan(row.lapisan),
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  url: `/api/photos/${row.id}/download`,
  thumbUrl: row.thumb_path ? `/api/photos/${row.id}/thumb` : null,
});

/**
 * Mode multi-cetak yang diakui server. Daftar ini mengikuti `public/js/multi.js`;
 * kertas lain selalu memakai `single`.
 */
const MULTI_MODE_IDS = new Set(['single', '2-strip', '2-4r', '4-3r']);
const STICKER_IDS = new Set([
  'heart', 'star', 'sparkle', 'smiley', 'flower', 'balloon',
  'crown', 'sun', 'rainbow', 'paw', 'camera', 'cherry',
]);
const LAYER_LIMIT = 12;
const LAYER_BYTES = 16 * 1024;

/**
 * Lapisan hiasan dikirim sebagai teks JSON dan disinopsis ulang agar hanya
 * properti yang dikenal yang tersimpan. Data besar atau tidak valid ditolak.
 */
function sanitizeLapisan(raw) {
  if (raw === undefined || String(raw ?? '').trim() === '') return null;

  if (typeof raw !== 'string' || raw.length > LAYER_BYTES) {
    throw httpError(422, 'Data lapisan hiasan tidak valid atau terlalu besar.', 'INVALID_LAYER');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw httpError(422, 'Data lapisan hiasan bukan JSON yang valid.', 'INVALID_LAYER');
  }

  if (!Array.isArray(parsed) || parsed.length > LAYER_LIMIT) {
    throw httpError(
      422,
      `Lapisan hiasan maksimal ${LAYER_LIMIT} item.`,
      'INVALID_LAYER',
    );
  }

  const clean = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      throw httpError(422, 'Tiap lapisan hiasan harus berupa objek.', 'INVALID_LAYER');
    }

    const x = Number(item.x);
    const y = Number(item.y);
    const size = Number(item.size);
    const rotation = Number(item.rotation ?? 0);
    const id = String(item.id ?? '').slice(0, 32);
    const base = {
      id: id || `hiasan-${clean.length + 1}`,
      type: item.type,
      x: clampNum(x),
      y: clampNum(y),
      size: clampNum(size, 0.02, 0.5),
      rotation: Number.isFinite(rotation) ? ((rotation % 360) + 360) % 360 : 0,
    };

    if (item.type === 'sticker') {
      const stickerId = String(item.stickerId ?? '');
      if (!STICKER_IDS.has(stickerId)) {
        throw httpError(422, 'ID stiker tidak dikenal.', 'INVALID_LAYER');
      }
      clean.push({ ...base, type: 'sticker', stickerId });
    } else if (item.type === 'text') {
      const text = String(item.text ?? '').trim().slice(0, 64);
      const color = String(item.color ?? '').slice(0, 24);
      if (!text) throw httpError(422, 'Teks lapisan tidak boleh kosong.', 'INVALID_LAYER');
      clean.push({ ...base, type: 'text', text, color: color || 'putih' });
    } else {
      throw httpError(422, 'Jenis lapisan hiasan tidak dikenal.', 'INVALID_LAYER');
    }
  }
  return clean.length ? JSON.stringify(clean) : null;
}

function clampNum(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) {
    throw httpError(422, 'Posisi atau ukuran lapisan harus berupa angka.', 'INVALID_LAYER');
  }
  return Math.min(max, Math.max(min, value));
}

function parseLapisan(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const cleanupFiles = async (files = []) => {
  await Promise.allSettled(files.filter(Boolean).map((f) => unlink(absolutePath(f))));
};

router.use(requireSession);

/** Simpan hasil foto (metadata + berkas 300 DPI). */
router.post('/photos', async (req, res, next) => {
  let uploaded = [];
  try {
    await runUpload(req, res);
    uploaded = Object.values(req.files ?? {}).flat().map(relativePath);

    const file = req.files?.file?.[0];
    const thumb = req.files?.thumb?.[0];

    if (!file) throw httpError(400, 'Berkas foto wajib dikirim.', 'FILE_REQUIRED');

    const border = queries.borderById(String(req.body.borderId ?? ''));
    if (!border) throw httpError(422, 'Border tidak dikenal.', 'INVALID_BORDER');

    const filter = queries.filterById(String(req.body.filterId ?? ''));
    if (!filter) throw httpError(422, 'Filter tidak dikenal.', 'INVALID_FILTER');

    const paper = queries.paperSizeById(String(req.body.paperSizeId ?? ''));
    if (!paper) throw httpError(422, 'Ukuran kertas tidak dikenal.', 'INVALID_PAPER');

    const dpi = Number(req.body.dpi ?? paper.dpi);
    if (dpi !== paper.dpi) {
      throw httpError(422, `DPI harus ${paper.dpi}.`, 'INVALID_DPI');
    }

    const expectedW = Math.round((paper.lebar_mm * dpi) / 25.4);
    const expectedH = Math.round((paper.tinggi_mm * dpi) / 25.4);
    const lebarPx = Number(req.body.lebarPx ?? expectedW);
    const tinggiPx = Number(req.body.tinggiPx ?? expectedH);

    if (Math.abs(lebarPx - expectedW) > 2 || Math.abs(tinggiPx - expectedH) > 2) {
      throw httpError(
        422,
        `Dimensi harus ${expectedW}×${expectedH} px untuk ${paper.nama} pada ${dpi} DPI.`,
        'INVALID_DIMENSIONS',
      );
    }

    const jumlahPose = Number(req.body.jumlahPose ?? 1);
    if (!Number.isInteger(jumlahPose) || jumlahPose < paper.poses_min || jumlahPose > paper.poses_max) {
      throw httpError(
        422,
        `Jumlah pose untuk ${paper.nama} adalah ${paper.poses_min}–${paper.poses_max}.`,
        'INVALID_POSE_COUNT',
      );
    }

    const intensitas = Number(req.body.intensitas ?? 1);
    if (!Number.isFinite(intensitas) || intensitas < 0 || intensitas > 1) {
      throw httpError(422, 'Intensitas filter harus antara 0 dan 1.', 'INVALID_INTENSITY');
    }

    const modeText = String(req.body.mode ?? 'single').trim() || 'single';
    if (!MULTI_MODE_IDS.has(modeText)) {
      throw httpError(422, 'Mode multi-cetak tidak dikenal.', 'INVALID_MODE');
    }

    const lapisan = sanitizeLapisan(req.body.lapisan);

    const actual = await readImageSize(file.path);
    if (!actual) throw httpError(415, 'Berkas gambar tidak dapat dibaca.', 'INVALID_IMAGE');
    if (actual.width !== lebarPx || actual.height !== tinggiPx) {
      throw httpError(
        422,
        `Ukuran berkas ${actual.width}×${actual.height} px tidak cocok dengan ${lebarPx}×${tinggiPx} px.`,
        'DIMENSION_MISMATCH',
      );
    }

    const id = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + RETENTION_DAYS * 86_400_000);

    queries.insertPhoto({
      id,
      sessionId: req.sessionId,
      borderId: border.id,
      filterId: filter.id,
      paperSizeId: paper.id,
      filePath: relativePath(file),
      thumbPath: thumb ? relativePath(thumb) : null,
      lebarPx: actual.width,
      tinggiPx: actual.height,
      dpi,
      jumlahPose,
      intensitas,
      mode: modeText,
      lapisan,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const row = queries.photoById(id);
    res.status(201).json({ data: publicPhoto(row) });
  } catch (error) {
    // Berkas yang sudah terlanjur ditulis tidak boleh tertinggal.
    uploaded = Object.values(req.files ?? {}).flat().map(relativePath);
    await cleanupFiles(uploaded);

    if (error?.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(httpError(413, 'Berkas terlalu besar (maksimal 20 MB).', 'FILE_TOO_LARGE'));
      }
      return next(httpError(400, 'Berkas unggahan tidak didukung.', error.code));
    }
    next(error);
  }
});

/** Daftar foto milik sesi anonim di perangkat ini. */
router.get('/photos', (req, res) => {
  const rows = queries.photosBySession(req.sessionId);
  res.json({ data: rows.map(publicPhoto) });
});

router.get('/photos/:id/thumb', (req, res, next) => {
  const row = queries.photoById(req.params.id);
  if (!row || row.session_id !== req.sessionId || !row.thumb_path) {
    return next(httpError(404, 'Foto tidak ditemukan.', 'NOT_FOUND'));
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(absolutePath(row.thumb_path), (error) => {
    if (error && !res.headersSent) next(error);
  });
});

/** Unduh berkas siap cetak. Hanya pemilik sesi yang boleh mengakses. */
router.get('/photos/:id/download', (req, res, next) => {
  const row = queries.photoById(req.params.id);
  if (!row || row.session_id !== req.sessionId) {
    return next(httpError(404, 'Foto tidak ditemukan.', 'NOT_FOUND'));
  }

  const ext = extname(row.file_path).toLowerCase() || '.png';
  const filename = `photobox-${row.paper_size_id}-${basename(row.file_path, ext)}${ext}`;

  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.download(absolutePath(row.file_path), filename, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

router.delete('/photos/:id', async (req, res, next) => {
  const row = queries.photoById(req.params.id);
  if (!row || row.session_id !== req.sessionId) {
    return next(httpError(404, 'Foto tidak ditemukan.', 'NOT_FOUND'));
  }
  queries.deletePhoto(row.id);
  await cleanupFiles([row.file_path, row.thumb_path]);
  res.status(204).end();
});

export default router;
