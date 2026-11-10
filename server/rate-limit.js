/**
 * Pembatasan laju sederhana di memori (tanpa dependensi tambahan).
 * Cukup untuk MVP satu proses; ganti dengan Redis bila server diperbanyak.
 */
export function rateLimit({ windowMs = 60_000, max = 120, key = (req) => req.ip } = {}) {
  const hits = new Map();
  let lastSweep = Date.now();

  /** Bersihkan entri kedaluwarsa agar Map tidak tumbuh tanpa batas. */
  function sweep(now) {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [id, entry] of hits) {
      if (now > entry.reset) hits.delete(id);
    }
  }

  function limiter(req, res, next) {
    const id = key(req);
    const now = Date.now();
    sweep(now);
    const entry = hits.get(id);

    if (!entry || now > entry.reset) {
      hits.set(id, { count: 1, reset: now + windowMs });
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(max - 1));
      return next();
    }

    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({
        error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
        code: 'RATE_LIMITED',
      });
    }
    next();
  }

  limiter.sweep = (force = false) => {
    if (force) lastSweep = 0;
    sweep(Date.now());
  };
  limiter.size = () => hits.size;

  return limiter;
}
