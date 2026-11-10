import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../server/config.js';

test('konfigurasi pengembangan punya nilai aman', () => {
  const config = loadConfig({});
  assert.equal(config.nodeEnv, 'development');
  assert.equal(config.production, false);
  assert.equal(config.port, 3000);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.trustProxy, false);
  assert.equal(config.forceHttps, false);
  assert.equal(config.hsts, false);
  assert.equal(config.logRequests, 'errors');
  assert.equal(config.publicOrigin, null);
});

test('produksi menyalakan HSTS dan log otomatis', () => {
  const config = loadConfig({ NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '8080' });
  assert.equal(config.production, true);
  assert.equal(config.hsts, true);
  assert.equal(config.logRequests, 'auto');
  assert.equal(config.port, 8080);
  assert.equal(config.host, '127.0.0.1');
});

test('nilai boolean fleksibel dibaca dengan benar', () => {
  assert.equal(loadConfig({ FORCE_HTTPS: 'true' }).forceHttps, true);
  assert.equal(loadConfig({ FORCE_HTTPS: '1' }).forceHttps, true);
  assert.equal(loadConfig({ FORCE_HTTPS: 'off' }).forceHttps, false);
  assert.equal(loadConfig({ NODE_ENV: 'production', HSTS: '0' }).hsts, false);
});

test('TRUST_PROXY menerima angka, boolean, dan subnet', () => {
  assert.equal(loadConfig({ TRUST_PROXY: '1' }).trustProxy, 1);
  assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, 1);
  assert.equal(loadConfig({ TRUST_PROXY: 'false' }).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
});

test('PORT tidak valid ditolak saat startup', () => {
  assert.throws(() => loadConfig({ PORT: '0' }), /PORT/);
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT/);
  assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
  assert.equal(loadConfig({ PORT: '65535' }).port, 65535);
});

test('HSTS_MAX_AGE dan LOG_REQUESTS divalidasi', () => {
  assert.throws(() => loadConfig({ HSTS_MAX_AGE: '-1' }), /HSTS_MAX_AGE/);
  assert.throws(() => loadConfig({ HSTS_MAX_AGE: 'abc' }), /HSTS_MAX_AGE/);
  assert.throws(() => loadConfig({ LOG_REQUESTS: 'kadang' }), /LOG_REQUESTS/);
  assert.equal(loadConfig({ LOG_REQUESTS: 'all' }).logRequests, 'all');
  assert.equal(loadConfig({ HSTS_MAX_AGE: '600' }).hstsMaxAge, 600);
});

test('PUBLIC_ORIGIN wajib HTTPS dan tanpa garis miring akhir', () => {
  assert.throws(() => loadConfig({ PUBLIC_ORIGIN: 'http://contoh.test' }), /https/i);
  assert.throws(() => loadConfig({ PUBLIC_ORIGIN: 'bukan url' }), /URL lengkap/);
  assert.equal(
    loadConfig({ PUBLIC_ORIGIN: 'https://contoh.test/' }).publicOrigin,
    'https://contoh.test',
  );
});

test('HOST kosong kembali ke 0.0.0.0', () => {
  assert.equal(loadConfig({ HOST: '   ' }).host, '0.0.0.0');
  assert.equal(loadConfig({ HOST: '::' }).host, '::');
});
