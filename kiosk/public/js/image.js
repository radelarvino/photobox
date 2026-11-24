/** Util gambar bersama: crop "cover", noise film, dan konversi kanvas. */

/** Gambar sumber ke persegi panjang dengan object-fit: cover. */
export function drawCover(ctx, source, x, y, w, h, mirror = false) {
  const sw = source.videoWidth ?? source.naturalWidth ?? source.width;
  const sh = source.videoHeight ?? source.naturalHeight ?? source.height;
  if (!sw || !sh) return;

  const scale = Math.max(w / sw, h / sh);
  const sx = (sw - w / scale) / 2;
  const sy = (sh - h / scale) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (mirror) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  ctx.drawImage(source, sx, sy, w / scale, h / scale, x, y, w, h);
  ctx.restore();
}

/** Grain halus untuk filter film — deterministik agar tidak berkedip. */
export function filmGrain(ctx, x, y, w, h, amount = 0.08) {
  const size = 128;
  const off = document.createElement('canvas');
  off.width = size; off.height = size;
  const octx = off.getContext('2d');
  const data = octx.createImageData(size, size);
  let seed = 1337;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v;
    data.data[i + 3] = Math.round(amount * 255);
  }
  octx.putImageData(data, 0, 0);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const pattern = ctx.createPattern(off, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal membuat berkas.'))), type, quality);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
