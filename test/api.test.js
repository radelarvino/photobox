import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const root = await mkdtemp(join(tmpdir(), 'photobox-test-'));
process.env.PHOTOBOX_DB = join(root, 'photobox.db');
process.env.PHOTOBOX_UPLOAD_DIR = join(root, 'uploads');

const { createApp } = await import('../server/app.js');
const { loadConfig } = await import('../server/config.js');
const { default: db } = await import('../server/db.js');

const sessionA = randomUUID();
const sessionB = randomUUID();
let server;
let base;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

/* ---------------------------- bantuan ---------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG grayscale minimal, cukup untuk menguji validasi dimensi server. */
function makePng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width + 1) * height, 0xff);
  for (let y = 0; y < height; y += 1) raw[y * (width + 1)] = 0;

  const chunk = (type, data) => {
    const name = Buffer.from(type, 'ascii');
    const body = Buffer.concat([name, data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function formFile(png, fields = {}, { filename = 'photo.png', type = 'image/png' } = {}) {
  const form = new FormData();
  form.append('file', new Blob([png], { type }), filename);
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  return form;
}

async function call(path, { session = sessionA, ...init } = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { 'X-Session-Id': session, ...(init.headers ?? {}) },
  });
}

const payload = async (response) => {
  const body = await response.json();
  return { status: response.status, body };
};

const validFields = {
  borderId: 'polaroid',
  filterId: 'sepia',
  paperSizeId: '4r',
  jumlahPose: 4,
  lebarPx: 1200,
  tinggiPx: 1800,
  dpi: 300,
  intensitas: 0.7,
};

/* ---------------------------- tes ---------------------------- */

test('health dan katalog tersedia', async () => {
  const health = await payload(await call('/api/health'));
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.body.retentionDays, 30);

  const catalog = await payload(await call('/api/catalog'));
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.borders.length, 12);
  assert.equal(catalog.body.filters.length, 10);
  assert.equal(catalog.body.paperSizes.length, 5);
  assert.equal(catalog.body.paperSizes.find((paper) => paper.id === '4r').lebarPx, 1200);
});

test('sesi anonim wajib berupa UUID', async () => {
  const response = await payload(await call('/api/photos', { session: 'bukan-uuid' }));
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'INVALID_SESSION');
});

test('validasi unggahan menolak berkas dan metadata yang salah', async () => {
  const png = makePng(1200, 1800);

  const noFile = await payload(await call('/api/photos', { method: 'POST', body: new FormData() }));
  assert.equal(noFile.status, 400);
  assert.equal(noFile.body.code, 'FILE_REQUIRED');

  const badBorder = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, borderId: 'tidak-ada' }),
  }));
  assert.equal(badBorder.status, 422);
  assert.equal(badBorder.body.code, 'INVALID_BORDER');

  const badFilter = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, filterId: 'tidak-ada' }),
  }));
  assert.equal(badFilter.status, 422);
  assert.equal(badFilter.body.code, 'INVALID_FILTER');

  const badPaper = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, paperSizeId: 'tidak-ada' }),
  }));
  assert.equal(badPaper.status, 422);
  assert.equal(badPaper.body.code, 'INVALID_PAPER');

  const badDpi = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, dpi: 72 }),
  }));
  assert.equal(badDpi.status, 422);
  assert.equal(badDpi.body.code, 'INVALID_DPI');

  const badDimensions = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(makePng(800, 600), { ...validFields, lebarPx: 800, tinggiPx: 600 }),
  }));
  assert.equal(badDimensions.status, 422);
  assert.equal(badDimensions.body.code, 'INVALID_DIMENSIONS');

  const badPoses = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, jumlahPose: 9 }),
  }));
  assert.equal(badPoses.status, 422);
  assert.equal(badPoses.body.code, 'INVALID_POSE_COUNT');

  const badIntensity = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, intensitas: 1.5 }),
  }));
  assert.equal(badIntensity.status, 422);
  assert.equal(badIntensity.body.code, 'INVALID_INTENSITY');

  const badType = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(Buffer.from('bukan gambar'), validFields, { type: 'text/plain', filename: 'catatan.txt' }),
  }));
  assert.equal(badType.status, 415);
  assert.equal(badType.body.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('unggahan melebihi 20 MB ditolak dengan 413', async () => {
  const oversized = Buffer.alloc(20 * 1024 * 1024 + 1);
  const response = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(oversized, validFields),
  }));
  assert.equal(response.status, 413);
  assert.equal(response.body.code, 'FILE_TOO_LARGE');
});

test('simpan, daftar, unduh, isolasi sesi, lalu hapus', async () => {
  const png = makePng(1200, 1800);
  const saved = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, validFields),
  }));

  assert.equal(saved.status, 201);
  const photo = saved.body.data;
  assert.equal(photo.borderId, 'polaroid');
  assert.equal(photo.paperSizeId, '4r');
  assert.equal(photo.jumlahPose, 4);
  assert.equal(photo.dpi, 300);
  assert.equal(photo.lebarPx, 1200);
  assert.equal(photo.tinggiPx, 1800);
  assert.ok(Date.parse(photo.expiresAt) - Date.parse(photo.createdAt) >= 29 * 86_400_000);

  const ownList = await payload(await call('/api/photos'));
  assert.equal(ownList.status, 200);
  assert.equal(ownList.body.data.length, 1);
  assert.equal(ownList.body.data[0].id, photo.id);

  const otherList = await payload(await call('/api/photos', { session: sessionB }));
  assert.equal(otherList.status, 200);
  assert.equal(otherList.body.data.length, 0);

  const ownDownload = await call(`/api/photos/${photo.id}/download`);
  assert.equal(ownDownload.status, 200);
  assert.equal(ownDownload.headers.get('content-type'), 'image/png');
  const downloaded = Buffer.from(await ownDownload.arrayBuffer());
  assert.deepEqual([...downloaded.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const foreignDownload = await call(`/api/photos/${photo.id}/download`, { session: sessionB });
  assert.equal(foreignDownload.status, 404);

  const removed = await call(`/api/photos/${photo.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
  assert.equal((await call('/api/photos')).status, 200);
  assert.equal((await payload(await call('/api/photos'))).body.data.length, 0);

  const missing = await payload(await call(`/api/photos/${photo.id}/download`));
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'NOT_FOUND');
});


test('mode dan lapisan hiasan tersimpan untuk edit-ulang', async () => {
  const png = makePng(1200, 1800);
  const lapisan = [
    { id: 'hiasan-1', type: 'text', text: 'Hai!', color: 'pink', x: 0.5, y: 0.4, size: 0.07, rotation: 10 },
    { id: 'hiasan-2', type: 'sticker', stickerId: 'heart', x: 0.3, y: 0.6, size: 0.14, rotation: 0 },
  ];
  const saved = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, mode: 'single', lapisan: JSON.stringify(lapisan) }),
  }));
  assert.equal(saved.status, 201);
  assert.equal(saved.body.data.mode, 'single');
  assert.deepEqual(saved.body.data.lapisan, lapisan);

  await call(`/api/photos/${saved.body.data.id}`, { method: 'DELETE' });
});

test('mode atau lapisan yang salah ditolak dengan 422', async () => {
  const png = makePng(1200, 1800);

  const badMode = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, mode: '5-kali' }),
  }));
  assert.equal(badMode.status, 422);
  assert.equal(badMode.body.code, 'INVALID_MODE');

  const badJson = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, { ...validFields, lapisan: 'ini bukan json' }),
  }));
  assert.equal(badJson.status, 422);
  assert.equal(badJson.body.code, 'INVALID_LAYER');

  const tooMany = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, {
      ...validFields,
      lapisan: JSON.stringify(
        Array.from({ length: 13 }, (_, i) => ({
          id: `hiasan-${i + 1}`, type: 'sticker', stickerId: 'star', x: 0.3, y: 0.3, size: 0.14, rotation: 0,
        })),
      ),
    }),
  }));
  assert.equal(tooMany.status, 422);
  assert.equal(tooMany.body.code, 'INVALID_LAYER');

  const unknownSticker = await payload(await call('/api/photos', {
    method: 'POST',
    body: formFile(png, {
      ...validFields,
      lapisan: JSON.stringify([
        { id: 'hiasan-1', type: 'sticker', stickerId: 'naga', x: 0.3, y: 0.3, size: 0.14, rotation: 0 },
      ]),
    }),
  }));
  assert.equal(unknownSticker.status, 422);
  assert.equal(unknownSticker.body.code, 'INVALID_LAYER');
});
