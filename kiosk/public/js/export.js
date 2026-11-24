/** Ekspor tanpa server: unduh, cetak, GIF, dan QR berisi versi kecil. */
import { canvasToBlob, downloadBlob } from './image.js';
import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.esm.js';

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadSheet(canvas, layoutId, format = 'png') {
  const jpg = format === 'jpg';
  const blob = await canvasToBlob(canvas, jpg ? 'image/jpeg' : 'image/png', jpg ? 0.94 : undefined);
  downloadBlob(blob, `photobox-${layoutId}-${stamp()}.${jpg ? 'jpg' : 'png'}`);
}

/** Cetak melalui iframe tersembunyi supaya tidak membuka popup. */
export function printSheet(canvas, paper) {
  const frame = document.getElementById('print-frame');
  const doc = frame.contentDocument;
  const data = canvas.toDataURL('image/png');
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8">
    <style>
      @page { size: ${paper.mm}; margin: 0; }
      html,body { margin:0; padding:0; background:#fff; }
      body { display:grid; place-items:center; min-height:100vh; }
      img { display:block; width:100%; height:auto; max-height:100vh; object-fit:contain; }
    </style></head><body><img src="${data}" alt="Cetakan photobox"></body></html>`);
  doc.close();
  const run = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
  if (doc.readyState === 'complete') setTimeout(run, 120);
  else frame.addEventListener('load', run, { once: true });
}

/** GIF pendek dari rangkaian photo (diperkecil agar ringan). */
export function makeGif(shots, filterCss = 'none') {
  const gif = GIFEncoder();
  const W = 280;
  const H = 280;
  shots.filter(Boolean).forEach((shot, index) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#f3ede1';
    ctx.fillRect(0, 0, W, H);
    ctx.filter = filterCss === 'none' ? 'none' : filterCss;
    const scale = Math.max(W / shot.width, H / shot.height);
    const dw = shot.width * scale;
    const dh = shot.height * scale;
    ctx.drawImage(shot, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.filter = 'none';
    ctx.strokeStyle = '#1c1a18';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    const { data } = ctx.getImageData(0, 0, W, H);
    const palette = quantize(data, 128);
    const indexed = applyPalette(data, palette);
    gif.writeFrame(indexed, W, H, { palette, delay: 650, repeat: index === 0 ? 0 : undefined });
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

function smallJpegDataUrl(canvas, width = 64) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.max(1, Math.round((canvas.height / canvas.width) * width));
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.4);
}

/** QR berisi data URL versi kecil; tetap lokal, tidak butuh server. */
export function drawQr(canvas, sheet) {
  let data = smallJpegDataUrl(sheet, 64);
  if (data.length > 2400) data = smallJpegDataUrl(sheet, 48);
  const qr = window.qrcode(0, 'L');
  qr.addData(data);
  qr.make();
  const count = qr.getModuleCount();
  const ctx = canvas.getContext('2d');
  const quiet = 4;
  const cell = Math.floor(canvas.width / (count + quiet * 2));
  const size = cell * (count + quiet * 2);
  const offset = Math.floor((canvas.width - size) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1c1a18';
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(offset + (c + quiet) * cell, offset + (r + quiet) * cell, cell, cell);
      }
    }
  }
  return data;
}

export function downloadSmall(sheet) {
  const url = smallJpegDataUrl(sheet, 320);
  const a = document.createElement('a');
  a.href = url;
  a.download = `photobox-pratinjau-${stamp()}.jpg`;
  document.body.append(a);
  a.click();
  a.remove();
}
