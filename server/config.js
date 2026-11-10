/**
 * Konfigurasi runtime dari environment.
 *
 * Semua nilai divalidasi di satu tempat agar kesalahan konfigurasi produksi
 * terlihat saat startup, bukan saat pengguna pertama membuka aplikasi.
 */

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(String(value).toLowerCase())) return false;
  return fallback;
};

/** Dukungan `TRUST_PROXY=1`, `true`, `false`, atau subnet Express. */
function parseTrustProxy(value) {
  if (value === undefined || value === '') return false;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  if (text === 'true') return 1;
  if (text === 'false') return false;
  return text;
}

export function loadConfig(env = process.env) {
  const nodeEnv = String(env.NODE_ENV ?? 'development').trim().toLowerCase();
  const production = nodeEnv === 'production';

  const portText = String(env.PORT ?? '3000').trim();
  if (!/^\d+$/.test(portText)) {
    throw new Error('PORT harus bilangan bulat 1–65535.');
  }
  const port = Number(portText);
  if (port < 1 || port > 65535) {
    throw new Error('PORT harus bilangan bulat 1–65535.');
  }

  const hstsText = String(env.HSTS_MAX_AGE ?? '').trim();
  let hstsMaxAge = 31_536_000;
  if (hstsText !== '') {
    if (!/^\d+$/.test(hstsText)) throw new Error('HSTS_MAX_AGE harus bilangan bulat ≥ 0.');
    hstsMaxAge = Number(hstsText);
    if (!Number.isSafeInteger(hstsMaxAge)) {
      throw new Error('HSTS_MAX_AGE terlalu besar.');
    }
  }

  const logRequests = String(env.LOG_REQUESTS ?? (production ? 'auto' : 'errors')).toLowerCase();
  if (!['auto', 'all', 'errors', 'off'].includes(logRequests)) {
    throw new Error('LOG_REQUESTS harus auto, all, errors, atau off.');
  }

  const publicOrigin = String(env.PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '') || null;
  if (publicOrigin) {
    let parsed;
    try {
      parsed = new URL(publicOrigin);
    } catch {
      throw new Error('PUBLIC_ORIGIN harus URL lengkap, misalnya https://photobox.example.com.');
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('PUBLIC_ORIGIN harus memakai https.');
    }
  }

  return {
    nodeEnv,
    production,
    port,
    host: String(env.HOST ?? '0.0.0.0').trim() || '0.0.0.0',
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    forceHttps: bool(env.FORCE_HTTPS, false),
    hsts: bool(env.HSTS, production),
    hstsMaxAge,
    logRequests,
    publicOrigin,
  };
}
