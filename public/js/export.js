/* Ekspor gambar siap cetak: metadata DPI, PDF ukuran halaman asli, dan unduhan. */

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Menambahkan chunk pHYs agar PNG dibaca sebagai 300 DPI. */
function pngWithDpi(buffer, dpi) {
  const bytes = new Uint8Array(buffer);
  const ppu = Math.round(dpi * 39.3700787);

  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, ppu);
  view.setUint32(4, ppu);
  data[8] = 1; // satuan: meter

  const type = encoder.encode('pHYs');
  const body = new Uint8Array(type.length + data.length);
  body.set(type, 0);
  body.set(data, type.length);

  const chunk = new Uint8Array(12 + data.length);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, data.length);
  chunk.set(body, 4);
  chunkView.setUint32(8 + data.length, crc32(body));

  const insertAt = 8 + 8 + 13 + 4; // setelah IHDR
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(bytes.subarray(insertAt), insertAt + chunk.length);
  return out;
}

/** Menyetel densitas JFIF pada JPEG agar 300 DPI. */
function jpegWithDpi(buffer, dpi) {
  const bytes = new Uint8Array(buffer);
  const isJfif = bytes.length > 20 &&
    bytes[2] === 0xff && bytes[3] === 0xe0 &&
    String.fromCharCode(bytes[6], bytes[7], bytes[8], bytes[9]) === 'JFIF';

  if (isJfif) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    bytes[13] = 1; // satuan DPI
    view.setUint16(14, dpi);
    view.setUint16(16, dpi);
    return bytes;
  }

  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, // JFIF
    0x01, 0x01, // versi 1.1
    0x01, // satuan DPI
    0x01, 0x2c, 0x01, 0x2c, // 300 dpi
    0x00, 0x00, // tanpa thumbnail
  ]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

export function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gambar gagal dibuat.'));
    }, type, quality);
  });
}

export async function imageBlobWithDpi(canvas, type, dpi = 300) {
  const isPng = type === 'image/png';
  const blob = await canvasToBlob(canvas, type, isPng ? undefined : 0.95);
  const buffer = await blob.arrayBuffer();
  const out = isPng ? pngWithDpi(buffer, dpi) : jpegWithDpi(buffer, dpi);
  return new Blob([out], { type });
}

/** PDF satu halaman dengan ukuran persis sama dengan kertas. */
export function buildPdf(jpegBytes, { widthPx, heightPx, widthMm, heightMm }) {
  const pt = (mm) => (mm * 72) / 25.4;
  const w = pt(widthMm);
  const h = pt(heightMm);
  const fixed = (value) => value.toFixed(4);

  const parts = [];
  let length = 0;
  const offsets = [];

  const add = (input) => {
    const bytes = typeof input === 'string' ? encoder.encode(input) : input;
    parts.push(bytes);
    length += bytes.length;
  };

  const startObject = (id) => {
    offsets[id] = length;
    add(`${id} 0 obj\n`);
  };

  add('%PDF-1.4\n');

  startObject(1);
  add('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObject(2);
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  startObject(3);
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(w)} ${fixed(h)}] ` +
    `/Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 4 0 R >>\nendobj\n`,
  );

  const content = encoder.encode(`q\n${fixed(w)} 0 0 ${fixed(h)} 0 0 cm\n/Im0 Do\nQ\n`);
  startObject(4);
  add(`<< /Length ${content.length} >>\nstream\n`);
  add(content);
  add('\nendstream\nendobj\n');

  startObject(5);
  add(
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  add(jpegBytes);
  add('\nendstream\nendobj\n');

  const xrefOffset = length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let id = 1; id <= 5; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  add(xref);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(parts, { type: 'application/pdf' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function fileName(paper, extension) {
  const date = new Date().toISOString().slice(0, 10);
  const size = paper.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `photobox-${size}-${date}.${extension}`;
}

export async function makeThumbnail(canvas, max = 560) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(canvas.width * scale));
  thumb.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = thumb.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return canvasToBlob(thumb, 'image/jpeg', 0.82);
}

/** Membuat berkas unduhan sesuai format yang diminta. */
export async function buildExport(canvas, paper, format) {
  if (format === 'png') {
    return {
      blob: await imageBlobWithDpi(canvas, 'image/png', paper.dpi),
      filename: fileName(paper, 'png'),
    };
  }

  if (format === 'jpg') {
    return {
      blob: await imageBlobWithDpi(canvas, 'image/jpeg', paper.dpi),
      filename: fileName(paper, 'jpg'),
    };
  }

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.95);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  return {
    blob: buildPdf(bytes, {
      widthPx: canvas.width,
      heightPx: canvas.height,
      widthMm: paper.lebarMm,
      heightMm: paper.tinggiMm,
    }),
    filename: fileName(paper, 'pdf'),
  };
}
