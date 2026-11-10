/**
 * Header keamanan dan pengalihan HTTPS.
 *
 * HSTS hanya dikirim pada permintaan yang sudah HTTPS agar tidak mengunci
 * pengguna ke skema yang salah saat uji lokal.
 */

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
].join('; ');

export function securityHeaders(config) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
    res.setHeader('Content-Security-Policy', CSP);

    if (config.hsts && req.secure) {
      res.setHeader(
        'Strict-Transport-Security',
        `max-age=${config.hstsMaxAge}; includeSubDomains`,
      );
    }
    next();
  };
}

/**
 * Redirect 308 ke HTTPS saat berjalan di belakang reverse proxy.
 * `app.set('trust proxy', ...)` harus sudah aktif agar `req.secure` benar.
 */
export function httpsRedirect(config) {
  if (!config.forceHttps) return (_req, _res, next) => next();

  return (req, res, next) => {
    if (req.secure) return next();

    const host = config.publicOrigin ? new URL(config.publicOrigin).host : req.get('host');
    if (!host) {
      return res.status(400).json({
        error: 'Host permintaan tidak valid.',
        code: 'INVALID_HOST',
        requestId: req.id,
      });
    }

    const target = config.publicOrigin ?? `https://${host}`;
    return res.redirect(308, `${target}${req.originalUrl}`);
  };
}
