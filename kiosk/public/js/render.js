/** Komposisi lembar cetak. Semua koordinat desain dalam piksel 300 DPI. */
import { tilesFor } from './layouts.js';
import { filterById } from './filters.js';
import { frameById } from './frames.js';
import { stickerById, stickerPath } from './stickers.js';
import { drawCover, filmGrain } from './image.js';

export const TEXT_COLORS = Object.freeze([
  { id: 'ink', nama: 'Tinta', value: '#1c1a18' },
  { id: 'paper', nama: 'Kertas', value: '#fffdf8' },
  { id: 'accent', nama: 'Aksen', value: '#c1442b' },
  { id: 'sage', nama: 'Sage', value: '#6d7d6a' },
]);

function colorValue(id, settings) {
  const found = TEXT_COLORS.find((color) => color.id === id);
  if (!found) return settings.accent;
  return found.id === 'accent' ? settings.accent : found.value;
}

/** Gambar satu hiasan pada koordinat relatif kanvas. */
export function drawOverlay(ctx, overlay, geo, settings) {
  const unit = Math.min(geo.width, geo.height);
  const cx = overlay.x * geo.width;
  const cy = overlay.y * geo.height;
  const size = overlay.size * unit;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((overlay.rotation ?? 0) * Math.PI) / 180);

  if (overlay.type === 'sticker') {
    const sticker = stickerById(overlay.stickerId);
    ctx.fillStyle = colorValue(overlay.color ?? 'accent', settings);
    ctx.strokeStyle = '#1c1a18';
    ctx.lineWidth = 1.2;
    ctx.translate(-size / 2, -size / 2);
    ctx.scale(size / 64, size / 64);
    const path = stickerPath(sticker);
    if (sticker.fill) ctx.fill(path);
    ctx.stroke(path);
  } else {
    ctx.fillStyle = colorValue(overlay.color ?? 'ink', settings);
    ctx.strokeStyle = 'rgba(28,26,24,.55)';
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.font = `700 ${size}px 'Bodoni Moda', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = String(overlay.text ?? '').slice(0, 32);
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

/** Pegangan untuk hiasan yang sedang dipilih (hanya pratinjau). */
function selection(ctx, overlay, geo, settings) {
  const unit = Math.min(geo.width, geo.height);
  const size = overlay.size * unit;
  const cx = overlay.x * geo.width;
  const cy = overlay.y * geo.height;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((overlay.rotation ?? 0) * Math.PI) / 180);
  ctx.strokeStyle = settings.accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  const half = size / 2 + 10;
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  ctx.setLineDash([]);
  ctx.fillStyle = settings.accent;
  ctx.beginPath(); ctx.arc(half, half, 9, 0, Math.PI * 2); ctx.fill(); // ubah ukuran
  ctx.beginPath(); ctx.arc(0, -half - 18, 9, 0, Math.PI * 2); ctx.fill(); // putar
  ctx.strokeStyle = '#1c1a18'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(half, half, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -half - 18, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/**
 * Render satu lembar lengkap.
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas kanvas tujuan
 * @param {number} o.scale 1 untuk ekspor, <1 untuk pratinjau
 * @param {Array<HTMLCanvasElement|null>} o.shots photo per petak
 * @param {HTMLImageElement|null} o.logo logo dari admin
 */
export function renderSheet({
  canvas,
  layout,
  frameId,
  filterId = 'normal',
  shots = [],
  overlays = [],
  settings,
  text = {},
  scale = 1,
  selectedOverlayId = null,
  logo = null,
}) {
  const frame = frameById(frameId);
  const filter = filterById(filterId);
  const geo = tilesFor(layout);

  canvas.width = Math.round(geo.width * scale);
  canvas.height = Math.round(geo.height * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = frame.palet.kertas;
  ctx.fillRect(0, 0, geo.width, geo.height);

  geo.tiles.forEach((tile, i) => {
    const shot = shots[i];
    ctx.save();
    ctx.fillStyle = 'rgba(28,26,24,.08)';
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    if (shot) {
      ctx.filter = filter.css === 'none' ? 'none' : filter.css;
      drawCover(ctx, shot, tile.x, tile.y, tile.w, tile.h);
      ctx.filter = 'none';
      if (filter.grain) filmGrain(ctx, tile.x, tile.y, tile.w, tile.h);
    }
    ctx.restore();
  });

  if (logo?.complete && logo.naturalWidth) {
    const h = Math.min(geo.header * 0.52, 66);
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    ctx.drawImage(logo, geo.margin, (geo.header - h) / 2, Math.min(w, geo.width * 0.22), h);
  }

  frame.draw(ctx, {
    geo,
    width: geo.width,
    height: geo.height,
    settings,
    text: {
      nama: text.nama ?? settings.eventName ?? '',
      tanggal: text.tanggal ?? settings.eventDate ?? '',
      kutipan: text.kutipan ?? settings.quote ?? '',
    },
  });

  for (const overlay of overlays) {
    drawOverlay(ctx, overlay, geo, settings);
    if (overlay.id === selectedOverlayId) selection(ctx, overlay, geo, settings);
  }

  return { geo, canvas };
}

/** Miniatur bingkai untuk kartu pilihan: photo placeholder + bingkai asli. */
export function renderFrameThumb(canvas, frameId, settings) {
  const layout = { size: { width: 300, height: 400 }, poses: 1, id: 'thumb' };
  const fake = document.createElement('canvas');
  fake.width = 240; fake.height = 260;
  const fctx = fake.getContext('2d');
  fctx.fillStyle = '#8b8178'; fctx.fillRect(0, 0, 240, 260);
  fctx.fillStyle = '#c6b7a6';
  fctx.beginPath(); fctx.arc(120, 110, 52, 0, Math.PI * 2); fctx.fill();
  fctx.fillRect(60, 170, 120, 90);

  renderSheet({
    canvas, layout, frameId, filterId: 'normal', shots: [fake], overlays: [],
    settings, text: { nama: 'Nama Acara', tanggal: '14 · 11 · 26', kutipan: 'terima kasih' },
    scale: 1,
  });
}
