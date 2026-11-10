import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { borders, filters, paperSizes } from './catalog.js';

const DB_PATH = process.env.PHOTOBOX_DB ?? resolve('data', 'photobox.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_seen  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS borders (
    id          TEXT PRIMARY KEY,
    nama        TEXT NOT NULL,
    kategori    TEXT NOT NULL,
    file_gambar TEXT,
    aktif       INTEGER NOT NULL DEFAULT 1,
    style       TEXT NOT NULL,
    params      TEXT NOT NULL,
    urutan      INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS filters (
    id         TEXT PRIMARY KEY,
    nama       TEXT NOT NULL,
    params     TEXT NOT NULL,
    aktif      INTEGER NOT NULL DEFAULT 1,
    urutan     INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS paper_sizes (
    id         TEXT PRIMARY KEY,
    nama       TEXT NOT NULL,
    lebar_mm   REAL NOT NULL,
    tinggi_mm  REAL NOT NULL,
    dpi        INTEGER NOT NULL DEFAULT 300,
    layout     TEXT NOT NULL DEFAULT 'grid',
    poses_min  INTEGER NOT NULL DEFAULT 1,
    poses_max  INTEGER NOT NULL DEFAULT 4,
    urutan     INTEGER NOT NULL DEFAULT 0,
    deskripsi  TEXT,
    aktif      INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS photos (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    border_id       TEXT NOT NULL REFERENCES borders(id),
    filter_id       TEXT NOT NULL REFERENCES filters(id),
    paper_size_id   TEXT NOT NULL REFERENCES paper_sizes(id),
    file_path       TEXT NOT NULL,
    thumb_path      TEXT,
    lebar_px        INTEGER NOT NULL,
    tinggi_px       INTEGER NOT NULL,
    dpi             INTEGER NOT NULL DEFAULT 300,
    jumlah_pose     INTEGER NOT NULL DEFAULT 1,
    intensitas      REAL NOT NULL DEFAULT 1,
    mode            TEXT,
    lapisan         TEXT,
    created_at      TEXT NOT NULL,
    expires_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_photos_session ON photos(session_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_photos_expires ON photos(expires_at);
`);

// Pembenah untuk database lama yang belum punya kolom mode/lapisan.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}
ensureColumn('photos', 'mode', 'mode TEXT');
ensureColumn('photos', 'lapisan', 'lapisan TEXT');

const now = () => new Date().toISOString();

const upsertBorder = db.prepare(`
  INSERT INTO borders (id, nama, kategori, file_gambar, aktif, style, params, urutan, updated_at)
  VALUES (?, ?, ?, NULL, 1, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    nama = excluded.nama,
    kategori = excluded.kategori,
    style = excluded.style,
    params = excluded.params,
    urutan = excluded.urutan,
    aktif = 1,
    updated_at = excluded.updated_at
`);

const upsertFilter = db.prepare(`
  INSERT INTO filters (id, nama, params, aktif, urutan, updated_at)
  VALUES (?, ?, ?, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    nama = excluded.nama,
    params = excluded.params,
    urutan = excluded.urutan,
    aktif = 1,
    updated_at = excluded.updated_at
`);

const upsertPaper = db.prepare(`
  INSERT INTO paper_sizes
    (id, nama, lebar_mm, tinggi_mm, dpi, layout, poses_min, poses_max, urutan, deskripsi, aktif)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    nama = excluded.nama,
    lebar_mm = excluded.lebar_mm,
    tinggi_mm = excluded.tinggi_mm,
    dpi = excluded.dpi,
    layout = excluded.layout,
    poses_min = excluded.poses_min,
    poses_max = excluded.poses_max,
    urutan = excluded.urutan,
    deskripsi = excluded.deskripsi,
    aktif = 1
`);

/** Menyelaraskan katalog di database dengan definisi di `catalog.js`. */
export function seedCatalog() {
  const stamp = now();
  db.exec('BEGIN');
  try {
    borders.forEach((b, i) => {
      upsertBorder.run(b.id, b.nama, b.kategori, b.style, JSON.stringify(b.params), i + 1, stamp);
    });
    filters.forEach((f, i) => {
      upsertFilter.run(f.id, f.nama, JSON.stringify(f.params), i + 1, stamp);
    });
    paperSizes.forEach((p) => {
      upsertPaper.run(
        p.id, p.nama, p.lebar_mm, p.tinggi_mm, p.dpi, p.layout,
        p.poses_min, p.poses_max, p.urutan, p.deskripsi ?? null,
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const toBorder = (row) => ({
  id: row.id,
  nama: row.nama,
  kategori: row.kategori,
  style: row.style,
  params: JSON.parse(row.params),
  urutan: row.urutan,
});

const toFilter = (row) => ({
  id: row.id,
  nama: row.nama,
  params: JSON.parse(row.params),
  urutan: row.urutan,
});

export const queries = {
  borders: () =>
    db.prepare('SELECT * FROM borders WHERE aktif = 1 ORDER BY urutan, nama').all().map(toBorder),

  borderById: (id) => {
    const row = db.prepare('SELECT * FROM borders WHERE id = ? AND aktif = 1').get(id);
    return row ? toBorder(row) : null;
  },

  filters: () =>
    db.prepare('SELECT * FROM filters WHERE aktif = 1 ORDER BY urutan, nama').all().map(toFilter),

  filterById: (id) => {
    const row = db.prepare('SELECT * FROM filters WHERE id = ? AND aktif = 1').get(id);
    return row ? toFilter(row) : null;
  },

  paperSizes: () => db.prepare('SELECT * FROM paper_sizes WHERE aktif = 1 ORDER BY urutan, nama').all(),

  paperSizeById: (id) => db.prepare('SELECT * FROM paper_sizes WHERE id = ? AND aktif = 1').get(id) ?? null,

  touchSession: (id) => {
    const stamp = now();
    db.prepare(`
      INSERT INTO sessions (id, created_at, last_seen) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen
    `).run(id, stamp, stamp);
  },

  insertPhoto: (photo) => {
    db.prepare(`
      INSERT INTO photos (
        id, session_id, border_id, filter_id, paper_size_id, file_path, thumb_path,
        lebar_px, tinggi_px, dpi, jumlah_pose, intensitas, mode, lapisan,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      photo.id, photo.sessionId, photo.borderId, photo.filterId, photo.paperSizeId,
      photo.filePath, photo.thumbPath, photo.lebarPx, photo.tinggiPx, photo.dpi,
      photo.jumlahPose, photo.intensitas, photo.mode ?? null, photo.lapisan ?? null,
      photo.createdAt, photo.expiresAt,
    );
  },

  photosBySession: (sessionId) =>
    db.prepare(`
      SELECT * FROM photos WHERE session_id = ? ORDER BY created_at DESC
    `).all(sessionId),

  photoById: (id) => db.prepare('SELECT * FROM photos WHERE id = ?').get(id) ?? null,

  deletePhoto: (id) => db.prepare('DELETE FROM photos WHERE id = ?').run(id),

  expiredPhotos: (stamp) =>
    db.prepare('SELECT id, file_path, thumb_path FROM photos WHERE expires_at < ?').all(stamp),

  countPhotos: () => db.prepare('SELECT COUNT(*) AS n FROM photos').get().n,
};

seedCatalog();

export default db;
