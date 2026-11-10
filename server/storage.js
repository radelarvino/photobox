import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const UPLOAD_DIR = process.env.PHOTOBOX_UPLOAD_DIR ?? resolve('uploads');
export const RETENTION_DAYS = Number(process.env.PHOTOBOX_RETENTION_DAYS ?? 30);
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
]);

function filenameFor(file) {
  const ext = ALLOWED.get(file.mimetype);
  return `${randomUUID()}${ext}`;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = join(UPLOAD_DIR, req.sessionId);
    try {
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename(_req, file, cb) {
    cb(null, filenameFor(file));
  },
});

export const uploadPhoto = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 2, fields: 20 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      const error = new Error('Format berkas harus PNG atau JPG.');
      error.status = 415;
      error.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumb', maxCount: 1 },
]);

export const absolutePath = (relative) => join(UPLOAD_DIR, relative);

/** Path relatif yang aman untuk disimpan di database (tanpa traversal). */
export const relativePath = (file) =>
  file.path.slice(UPLOAD_DIR.length + 1).split('\\').join('/');
