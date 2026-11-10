import express from 'express';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unlink } from 'node:fs/promises';
import catalogRoutes from './routes/catalog.js';
import photoRoutes from './routes/photos.js';
import { rateLimit } from './rate-limit.js';
import { queries } from './db.js';
import { absolutePath, RETENTION_DAYS } from './storage.js';
import { loadConfig } from './config.js';
import { requestLogger } from './logger.js';
import { securityHeaders, httpsRedirect } from './security.js';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const distDir = join(here, '..', 'dist');

/** Nama berkas ber-hash dari `npm run build`, mis. app.1a2b3c4d.css. */
const HASHED_ASSET_RE = /\.[0-9a-f]{8}\.(?:css|js|woff2|svg|png|jpe?g|webp|ico)$/i;

/**
 * Produksi wajib memakai hasil build agar berkas ber-hash dan header
 * immutable konsisten. Mode pengembangan tetap menyajikan folder public.
 */
function resolveStatic(config) {
  if (!config.production) return { root: publicDir, built: false };

  if (!existsSync(join(distDir, 'index.html'))) {
    throw new Error(
      'Build produksi belum ada. Jalankan "npm run build" sebelum NODE_ENV=production.',
    );
  }
  return { root: distDir, built: true };
}

export function createApp(config = loadConfig()) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  app.use(requestLogger({ mode: config.logRequests }));
  app.use(securityHeaders(config));
  app.use(httpsRedirect(config));
  // Kompres HTML/CSS/JS agar muatan awal ringan di jaringan seluler.
  app.use(compression());

  // Data foto bersifat privat per sesi; jangan pernah disimpan cache bersama.
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'X-Session-Id');
    next();
  });

  const staticRoot = resolveStatic(config);
  app.use(
    express.static(staticRoot.root, {
      etag: true,
      lastModified: true,
      setHeaders(res, path) {
        if (staticRoot.built && HASHED_ASSET_RE.test(path)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.use(express.json({ limit: '64kb' }));

  const readLimit = rateLimit({ windowMs: 60_000, max: 240 });
  const writeLimit = rateLimit({ windowMs: 60 * 60_000, max: 80 });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      photos: queries.countPhotos(),
      retentionDays: RETENTION_DAYS,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  app.use('/api', readLimit, catalogRoutes);
  app.use('/api', writeLimit, photoRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'Endpoint tidak ditemukan.',
      code: 'NOT_FOUND',
      requestId: req.id,
    });
  });

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Halaman tidak ditemukan.');
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, _next) => {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error(JSON.stringify({
        time: new Date().toISOString(),
        level: 'error',
        requestId: req.id,
        message: error.message,
        stack: error.stack,
      }));
    }
    if (res.headersSent) return;
    res.status(status).json({
      error: status >= 500 ? 'Terjadi kesalahan di server.' : error.message,
      code: error.code ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST'),
      requestId: req.id,
    });
  });

  return app;
}

/** Hapus foto yang melewati masa retensi (default 30 hari). */
export function purgeExpiredPhotos() {
  const rows = queries.expiredPhotos(new Date().toISOString());
  if (rows.length === 0) return 0;

  for (const row of rows) {
    queries.deletePhoto(row.id);
    for (const file of [row.file_path, row.thumb_path]) {
      if (file) unlink(absolutePath(file)).catch(() => {});
    }
  }
  console.log(`[photobox] ${rows.length} foto kedaluwarsa dihapus.`);
  return rows.length;
}
