import { randomUUID } from 'node:crypto';

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Meneruskan request ID dari klien/proxy bila aman, atau membuat UUID baru.
 * ID ini ikut di setiap respons dan log agar insiden mudah ditelusuri.
 */
export function requestId(req) {
  const incoming = req.get('x-request-id');
  return incoming && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
}

/**
 * Log terstruktur satu baris JSON.
 *
 * Mode:
 * - `off`    : tidak ada log permintaan;
 * - `errors` : hanya respons 5xx (default pengembangan);
 * - `auto`   : semua API, semua respons gagal, dan permintaan lambat (default produksi);
 * - `all`    : semua permintaan termasuk aset statis.
 */
export function requestLogger({ mode = 'auto' } = {}) {
  return (req, res, next) => {
    const id = requestId(req);
    req.id = id;
    res.setHeader('X-Request-Id', id);

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const status = res.statusCode;
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const failed = status >= 400;
      const isApi = req.originalUrl.startsWith('/api/');

      if (mode === 'off') return;
      if (mode === 'errors' && status < 500) return;
      if (mode === 'auto' && !failed && !isApi && durationMs < 1000) return;

      const line = JSON.stringify({
        time: new Date().toISOString(),
        level: status >= 500 ? 'error' : failed ? 'warn' : 'info',
        requestId: id,
        method: req.method,
        path: req.originalUrl,
        status,
        durationMs: Math.round(durationMs),
      });

      if (status >= 500) console.error(line);
      else if (failed) console.warn(line);
      else console.log(line);
    });

    next();
  };
}
