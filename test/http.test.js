import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'photobox-http-'));
process.env.PHOTOBOX_DB = join(root, 'photobox.db');
process.env.PHOTOBOX_UPLOAD_DIR = join(root, 'uploads');

const { createApp } = await import('../server/app.js');
const { loadConfig } = await import('../server/config.js');
const { default: db } = await import('../server/db.js');

/** Jalankan aplikasi dengan konfigurasi khusus di port acak. */
async function start(overrides = {}) {
  const config = { ...loadConfig(), logRequests: 'off', ...overrides };
  const server = createApp(config).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

let dev;
let secure;

before(async () => {
  dev = await start();
  // Simulasi reverse proxy: permintaan dari proxy dianggap HTTPS.
  secure = await start({
    forceHttps: true,
    hsts: true,
    trustProxy: 1,
    publicOrigin: 'https://photobox.example.com',
  });
});

after(async () => {
  await dev.close();
  await secure.close();
  db.close();
  await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test('header keamanan selalu dikirim', async () => {
  const response = await fetch(`${dev.base}/api/health`);
  assert.equal(response.status, 200);

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(response.headers.get('x-powered-by'), null);

  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);

  const permissions = response.headers.get('permissions-policy');
  assert.match(permissions, /camera=\(self\)/);
  assert.match(permissions, /payment=\(\)/);
});

test('request ID valid diteruskan dan yang tidak valid diganti', async () => {
  const echoed = await fetch(`${dev.base}/api/health`, {
    headers: { 'X-Request-Id': 'uji-request-0001' },
  });
  assert.equal(echoed.headers.get('x-request-id'), 'uji-request-0001');

  const replaced = await fetch(`${dev.base}/api/health`, {
    headers: { 'X-Request-Id': 'ada spasi!' },
  });
  const id = replaced.headers.get('x-request-id');
  assert.ok(id);
  assert.notEqual(id, 'ada spasi!');
  assert.match(id, /^[A-Za-z0-9._-]{8,64}$/);
});

test('respons API tidak boleh di-cache bersama', async () => {
  const response = await fetch(`${dev.base}/api/catalog`, {
    headers: { 'X-Session-Id': 'sesi-uji-cache' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('vary'), /X-Session-Id/);
});

test('endpoint API tak dikenal menghasilkan JSON 404 ber-requestId', async () => {
  const response = await fetch(`${dev.base}/api/tidak-ada`, {
    headers: { 'X-Request-Id': 'hilang-endpoint-01', 'X-Session-Id': crypto.randomUUID() },
  });
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.code, 'NOT_FOUND');
  assert.equal(body.requestId, 'hilang-endpoint-01');
});

test('halaman non-API tak dikenal tetap teks biasa', async () => {
  const response = await fetch(`${dev.base}/halaman-hilang`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /text\/plain/);
  assert.equal(await response.text(), 'Halaman tidak ditemukan.');
});

test('aset pengembangan disajikan tanpa cache agar mudah diuji', async () => {
  const css = await fetch(`${dev.base}/css/app.css`);
  assert.equal(css.status, 200);
  assert.equal(css.headers.get('cache-control'), 'no-cache');
  await css.arrayBuffer();

  const index = await fetch(`${dev.base}/`);
  assert.equal(index.status, 200);
  assert.equal(index.headers.get('cache-control'), 'no-cache');
  await index.arrayBuffer();
});

test('FORCE_HTTPS mengalihkan 308 ke origin publik', async () => {
  const response = await fetch(`${secure.base}/api/health?x=1`, {
    redirect: 'manual',
    headers: { 'X-Forwarded-Proto': 'http', Host: 'internal:3000' },
  });
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://photobox.example.com/api/health?x=1',
  );
});

test('permintaan HTTPS dari proxy mendapat HSTS dan tidak dialihkan', async () => {
  const response = await fetch(`${secure.base}/api/health`, {
    redirect: 'manual',
    headers: { 'X-Forwarded-Proto': 'https', Host: 'internal:3000' },
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('strict-transport-security'),
    'max-age=31536000; includeSubDomains',
  );
});
