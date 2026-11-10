import { computeLayout, coverRect, paperPixels } from './layout.js';
import { computeTiles } from './multi.js';
import { drawBorder, borderBackground } from './borders.js';
import { detectCanvasFilter, applyFilterPixels } from './filters.js';
import { drawOverlays, drawOverlaySelection } from './overlays.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawTint(ctx, slot, filter, intensity) {
  if (!filter?.params?.tint || intensity <= 0) return;
  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = filter.params.tint;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
}

function drawVignette(ctx, slot, filter, intensity) {
  const strength = filter?.params?.vignette;
  if (!strength || intensity <= 0) return;
  const cx = slot.x + slot.w / 2;
  const cy = slot.y + slot.h / 2;
  const inner = Math.min(slot.w, slot.h) * 0.3;
  const outer = Math.hypot(slot.w, slot.h) * 0.56;
  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.6, strength * intensity)})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
}

function drawPixels(ctx, source, crop, slot, filter, intensity) {
  const width = Math.max(1, Math.round(slot.w));
  const height = Math.max(1, Math.round(slot.h));
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(
    source,
    crop.sx, crop.sy, crop.sw, crop.sh,
    0, 0, width, height,
  );
  const data = offCtx.getImageData(0, 0, width, height);
  applyFilterPixels(data, filter.params.css, intensity);
  offCtx.putImageData(data, 0, 0);
  ctx.drawImage(offscreen, slot.x, slot.y, slot.w, slot.h);
}

/**
 * Merender satu lembar foto lengkap pada resolusi kertas.
 * `scale` 1 = ukuran penuh 300 DPI; nilai kecil dipakai untuk pratinjau.
 */
export function renderSheet({
  paper,
  border,
  filter,
  intensity = 1,
  shots,
  poseCount,
  scale = 1,
  canvas = document.createElement('canvas'),
  overlays = [],
  selectedOverlayId = null,
}) {
  const layout = computeLayout(paper, poseCount, border, scale);
  const width = Math.round(layout.width);
  const height = Math.round(layout.height);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  const { color: background } = borderBackground(border);
  const useCanvasFilter = detectCanvasFilter();
  const css = filter?.params?.css ?? 'none';
  const mix = Math.min(1, Math.max(0, intensity));

  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  for (const slot of layout.slots) {
    const source = shots[slot.index];
    if (!source) continue;

    const sourceWidth = source.width ?? source.naturalWidth;
    const sourceHeight = source.height ?? source.naturalHeight;
    const crop = coverRect(sourceWidth, sourceHeight, slot.w, slot.h);

    ctx.save();
    roundRectPath(ctx, slot.x, slot.y, slot.w, slot.h, layout.radius);
    ctx.clip();

    if (css === 'none' || mix === 0) {
      ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, slot.x, slot.y, slot.w, slot.h);
    } else if (useCanvasFilter) {
      ctx.filter = css;
      ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, slot.x, slot.y, slot.w, slot.h);
      ctx.filter = 'none';
      if (mix < 1) {
        ctx.globalAlpha = 1 - mix;
        ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, slot.x, slot.y, slot.w, slot.h);
        ctx.globalAlpha = 1;
      }
    } else {
      drawPixels(ctx, source, crop, slot, filter, mix);
    }

    drawTint(ctx, slot, filter, mix);
    drawVignette(ctx, slot, filter, mix);
    ctx.restore();
  }

  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  drawBorder(ctx, layout, border, {
    poseCount,
    dateLabel,
    paperName: paper.nama,
  });

  if (overlays.length) {
    drawOverlays(ctx, layout, overlays, { selectedId: selectedOverlayId });
  }

  return { canvas, layout };
}

/**
 * Merender satu lembar keluaran yang mungkin berisi beberapa salinan desain.
 * Untuk mode satu salinan, fungsi ini meneruskan ke `renderSheet`.
 */
export function renderMultiSheet({
  paper,
  designPaper = paper,
  cols = 1,
  rows = 1,
  copies = 1,
  scale = 1,
  canvas = document.createElement('canvas'),
  overlays = [],
  selectedOverlayId = null,
  selectionTile = 0,
  ...rest
}) {
  const shared = {
    border: rest.border,
    filter: rest.filter,
    intensity: rest.intensity,
    shots: rest.shots,
    poseCount: rest.poseCount,
    scale,
    overlays,
  };

  const tiling = computeTiles({ outputPaper: paper, designPaper, cols, rows, scale });
  if (!tiling || copies <= 1) {
    const single = renderSheet({
      ...shared,
      paper,
      canvas,
      selectedOverlayId,
    });
    return {
      ...single,
      tiles: [{ index: 0, x: 0, y: 0, w: single.canvas.width, h: single.canvas.height }],
    };
  }

  // Desain dirender sekali tanpa kotak seleksi, lalu disalin ke setiap petak.
  const design = renderSheet({
    ...shared,
    paper: designPaper,
    canvas: document.createElement('canvas'),
    selectedOverlayId: null,
  });

  canvas.width = Math.round(tiling.width);
  canvas.height = Math.round(tiling.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const tile of tiling.tiles) {
    ctx.drawImage(design.canvas, tile.x, tile.y, tile.w, tile.h);
  }

  if (selectedOverlayId) {
    const selected = overlays.find((overlay) => overlay.id === selectedOverlayId);
    const tile = tiling.tiles[Math.max(0, Math.min(selectionTile, tiling.tiles.length - 1))];
    if (selected && tile) {
      drawOverlaySelection(ctx, design.layout, selected, tile.x, tile.y);
    }
  }

  return { canvas, layout: design.layout, tiles: tiling.tiles };
}

/**
 * Merender ulang lembar dari berkas tersimpan (versi bersih tanpa hiasan).
 * `baseImage` digambar penuh sebagai latar, lalu hiasan dari data lapisan
 * digambar ulang di setiap petak sesuai geometri multi-cetak, sehingga hasil
 * edit terlihat identik dengan lembar aslinya.
 */
export function renderFromSaved({
  paper,
  designPaper = paper,
  cols = 1,
  rows = 1,
  baseImage,
  border,
  poseCount,
  scale = 1,
  overlays = [],
  selectedOverlayId = null,
  selectionTile = 0,
  canvas = document.createElement('canvas'),
}) {
  const tiling = computeTiles({ outputPaper: paper, designPaper, cols, rows, scale });
  const width = Math.round(paperPixels(paper).width * scale);
  const height = Math.round(paperPixels(paper).height * scale);

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(baseImage, 0, 0, width, height);

  if (!overlays.length) {
    return { canvas, layout: null, tiles: tiling?.tiles ?? [] };
  }

  const layout = computeLayout(designPaper, poseCount, border, scale);
  const tiles = tiling?.tiles ?? [{ index: 0, x: 0, y: 0, w: width, h: height }];

  for (const tile of tiles) {
    ctx.save();
    ctx.translate(tile.x, tile.y);
    drawOverlays(ctx, layout, overlays);
    ctx.restore();
  }

  if (selectedOverlayId) {
    const selected = overlays.find((overlay) => overlay.id === selectedOverlayId);
    const tile = tiles[Math.max(0, Math.min(selectionTile, tiles.length - 1))];
    if (selected && tile) {
      drawOverlaySelection(ctx, layout, selected, tile.x, tile.y);
    }
  }

  return { canvas, layout, tiles };
}

/** Menggambar pratinjau border kecil untuk carousel. */
export function renderBorderThumb(canvas, { paper, border, poseCount }) {
  const filter = { params: { css: 'none' } };
  const shots = Array.from({ length: poseCount }, () => {
    const tile = document.createElement('canvas');
    tile.width = 320;
    tile.height = 240;
    const ctx = tile.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 320, 240);
    gradient.addColorStop(0, border.params.accent);
    gradient.addColorStop(1, border.params.bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = 'rgba(53, 40, 58, 0.34)';
    ctx.beginPath();
    ctx.arc(160, 108, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(160, 212, 74, 44, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    return tile;
  });

  return renderSheet({
    paper,
    border,
    filter,
    intensity: 1,
    shots,
    poseCount,
    scale: 0.22,
    canvas,
  });
}
