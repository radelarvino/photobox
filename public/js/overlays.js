/* ==========================================================================
   Hiasan foto — stiker vektor dan teks.
   Semua koordinat hiasan disimpan ternormalisasi (0–1) terhadap lebar/tinggi
   kertas, sehingga pratinjau dan render 300 DPI memakai susunan yang sama.
   ========================================================================== */

const TAU = Math.PI * 2;
const INK = '#35283A';
const OUTLINE = 0.045;
const FONT_STACK = '"Baloo 2", "Trebuchet MS", sans-serif';

export const TEXT_COLORS = [
  { id: 'putih', nama: 'Putih', fill: '#FFFDF8' },
  { id: 'pink', nama: 'Pink', fill: '#FF9DB7' },
  { id: 'kuning', nama: 'Kuning', fill: '#FFD166' },
  { id: 'mint', nama: 'Mint', fill: '#9FE8CF' },
];

const colorById = (id) => TEXT_COLORS.find((color) => color.id === id) ?? TEXT_COLORS[0];

/* ------------------------------ alat gambar ------------------------------ */

function outline(ctx, color = INK, width = OUTLINE) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function shape(ctx, fill, color = INK, width = OUTLINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  outline(ctx, color, width);
}

function circle(ctx, cx, cy, r, fill, withOutline = true) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (withOutline) outline(ctx);
}

function ellipse(ctx, cx, cy, rx, ry, rotate, fill, withOutline = true) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotate, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (withOutline) outline(ctx);
}

function starPath(ctx, cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function sparklePath(ctx, cx, cy, radius) {
  const waist = radius * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.quadraticCurveTo(cx + waist, cy - waist, cx + radius, cy);
  ctx.quadraticCurveTo(cx + waist, cy + waist, cx, cy + radius);
  ctx.quadraticCurveTo(cx - waist, cy + waist, cx - radius, cy);
  ctx.quadraticCurveTo(cx - waist, cy - waist, cx, cy - radius);
  ctx.closePath();
}

/* ------------------------------- stiker ------------------------------- */

function drawHeart(ctx) {
  ctx.beginPath();
  ctx.moveTo(0.5, 0.87);
  ctx.bezierCurveTo(0.12, 0.6, 0.09, 0.27, 0.3, 0.2);
  ctx.bezierCurveTo(0.42, 0.16, 0.5, 0.26, 0.5, 0.35);
  ctx.bezierCurveTo(0.5, 0.26, 0.58, 0.16, 0.7, 0.2);
  ctx.bezierCurveTo(0.91, 0.27, 0.88, 0.6, 0.5, 0.87);
  ctx.closePath();
  shape(ctx, '#FF7A9C');
  ctx.beginPath();
  ctx.ellipse(0.34, 0.35, 0.07, 0.04, -0.65, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
}

function drawStar(ctx) {
  starPath(ctx, 0.5, 0.52, 0.45, 0.19);
  shape(ctx, '#FFD166');
  circle(ctx, 0.62, 0.4, 0.035, 'rgba(255, 255, 255, 0.75)', false);
}

function drawSparkle(ctx) {
  sparklePath(ctx, 0.5, 0.5, 0.44);
  shape(ctx, '#A8DDFF');
  sparklePath(ctx, 0.75, 0.22, 0.16);
  shape(ctx, '#FFE9A8', INK, 0.035);
  sparklePath(ctx, 0.23, 0.76, 0.12);
  shape(ctx, '#FFD8E2', INK, 0.035);
}

function drawSmiley(ctx) {
  circle(ctx, 0.5, 0.5, 0.43, '#FFE9A8');
  circle(ctx, 0.37, 0.43, 0.05, INK, false);
  circle(ctx, 0.63, 0.43, 0.05, INK, false);
  ctx.beginPath();
  ctx.arc(0.5, 0.53, 0.2, Math.PI * 0.18, Math.PI * 0.82);
  outline(ctx, INK, 0.05);
  circle(ctx, 0.27, 0.63, 0.05, '#FF9DB7', false);
  circle(ctx, 0.73, 0.63, 0.05, '#FF9DB7', false);
}

function drawFlower(ctx) {
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * TAU) / 6 - Math.PI / 2;
    const cx = 0.5 + Math.cos(angle) * 0.2;
    const cy = 0.5 + Math.sin(angle) * 0.2;
    ellipse(ctx, cx, cy, 0.15, 0.19, angle + Math.PI / 2, '#FFB3C7');
  }
  circle(ctx, 0.5, 0.5, 0.13, '#FFD166');
  circle(ctx, 0.47, 0.47, 0.03, 'rgba(255, 255, 255, 0.7)', false);
}

function drawBalloon(ctx) {
  ellipse(ctx, 0.5, 0.38, 0.25, 0.3, 0, '#BDF3E0');
  ctx.beginPath();
  ctx.moveTo(0.44, 0.67);
  ctx.lineTo(0.56, 0.67);
  ctx.lineTo(0.5, 0.76);
  ctx.closePath();
  shape(ctx, '#BDF3E0');
  ctx.beginPath();
  ctx.moveTo(0.5, 0.76);
  ctx.quadraticCurveTo(0.62, 0.86, 0.56, 0.97);
  ctx.lineWidth = 0.028;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.4, 0.3, 0.06, 0.09, -0.5, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fill();
}

function drawCrown(ctx) {
  ctx.beginPath();
  ctx.moveTo(0.14, 0.72);
  ctx.lineTo(0.15, 0.34);
  ctx.lineTo(0.32, 0.52);
  ctx.lineTo(0.5, 0.25);
  ctx.lineTo(0.68, 0.52);
  ctx.lineTo(0.85, 0.34);
  ctx.lineTo(0.86, 0.72);
  ctx.closePath();
  shape(ctx, '#FFD166');
  ctx.beginPath();
  ctx.rect(0.14, 0.68, 0.72, 0.12);
  shape(ctx, '#FFD166');
  circle(ctx, 0.32, 0.74, 0.045, '#FF7A9C');
  circle(ctx, 0.5, 0.74, 0.05, '#A8DDFF');
  circle(ctx, 0.68, 0.74, 0.045, '#BDF3E0');
  circle(ctx, 0.5, 0.34, 0.035, 'rgba(255, 255, 255, 0.7)', false);
}

function drawSun(ctx) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * TAU) / 8;
    const x1 = 0.5 + Math.cos(angle) * 0.3;
    const y1 = 0.5 + Math.sin(angle) * 0.3;
    const x2 = 0.5 + Math.cos(angle) * 0.45;
    const y2 = 0.5 + Math.sin(angle) * 0.45;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    outline(ctx, INK, 0.085);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    outline(ctx, '#FFD166', 0.045);
  }
  circle(ctx, 0.5, 0.5, 0.25, '#FFD166');
  circle(ctx, 0.42, 0.46, 0.035, INK, false);
  circle(ctx, 0.58, 0.46, 0.035, INK, false);
  ctx.beginPath();
  ctx.arc(0.5, 0.52, 0.11, Math.PI * 0.18, Math.PI * 0.82);
  outline(ctx, INK, 0.04);
}

function drawRainbow(ctx) {
  const bands = [
    { r: 0.42, color: '#FF7A9C' },
    { r: 0.31, color: '#FFD166' },
    { r: 0.2, color: '#BDF3E0' },
    { r: 0.09, color: '#A8DDFF' },
  ];
  for (const band of bands) {
    ctx.beginPath();
    ctx.arc(0.5, 0.64, band.r, Math.PI, TAU);
    outline(ctx, INK, 0.13);
    ctx.beginPath();
    ctx.arc(0.5, 0.64, band.r, Math.PI, TAU);
    outline(ctx, band.color, 0.085);
  }
  for (const x of [0.13, 0.25, 0.75, 0.87]) {
    circle(ctx, x, 0.65, 0.11, '#FFFDF8');
  }
  for (const x of [0.13, 0.25, 0.75, 0.87]) {
    circle(ctx, x, 0.61, 0.07, '#FFFDF8', false);
  }
}

function drawPaw(ctx) {
  ellipse(ctx, 0.34, 0.4, 0.075, 0.095, -0.5, '#D9CDFF');
  ellipse(ctx, 0.47, 0.33, 0.075, 0.1, -0.15, '#D9CDFF');
  ellipse(ctx, 0.6, 0.36, 0.075, 0.095, 0.28, '#D9CDFF');
  ellipse(ctx, 0.71, 0.46, 0.068, 0.085, 0.6, '#D9CDFF');
  ellipse(ctx, 0.5, 0.68, 0.22, 0.18, 0, '#D9CDFF');
}

function drawCamera(ctx) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(0.13, 0.3, 0.74, 0.5, 0.09)
    : ctx.rect(0.13, 0.3, 0.74, 0.5);
  shape(ctx, '#A8DDFF');
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(0.35, 0.23, 0.3, 0.14, 0.05)
    : ctx.rect(0.35, 0.23, 0.3, 0.14);
  shape(ctx, '#A8DDFF');
  circle(ctx, 0.5, 0.56, 0.16, '#FFFDF8');
  circle(ctx, 0.5, 0.56, 0.09, '#3F9BCF');
  circle(ctx, 0.46, 0.52, 0.03, 'rgba(255, 255, 255, 0.8)', false);
  circle(ctx, 0.74, 0.4, 0.04, '#FFD166');
}

function drawCherry(ctx) {
  ctx.beginPath();
  ctx.moveTo(0.37, 0.62);
  ctx.quadraticCurveTo(0.45, 0.36, 0.56, 0.19);
  ctx.moveTo(0.64, 0.66);
  ctx.quadraticCurveTo(0.62, 0.42, 0.58, 0.2);
  outline(ctx, INK, 0.035);
  ellipse(ctx, 0.66, 0.2, 0.11, 0.055, -0.35, '#BDF3E0');
  circle(ctx, 0.33, 0.68, 0.16, '#FF7A9C');
  circle(ctx, 0.64, 0.71, 0.14, '#FF7A9C');
  circle(ctx, 0.28, 0.62, 0.04, 'rgba(255, 255, 255, 0.6)', false);
}

export const STICKERS = [
  { id: 'heart', nama: 'Hati', draw: drawHeart },
  { id: 'star', nama: 'Bintang', draw: drawStar },
  { id: 'sparkle', nama: 'Kilau', draw: drawSparkle },
  { id: 'smiley', nama: 'Senyum', draw: drawSmiley },
  { id: 'flower', nama: 'Bunga', draw: drawFlower },
  { id: 'balloon', nama: 'Balon', draw: drawBalloon },
  { id: 'crown', nama: 'Mahkota', draw: drawCrown },
  { id: 'sun', nama: 'Matahari', draw: drawSun },
  { id: 'rainbow', nama: 'Pelangi', draw: drawRainbow },
  { id: 'paw', nama: 'Tapak', draw: drawPaw },
  { id: 'camera', nama: 'Kamera', draw: drawCamera },
  { id: 'cherry', nama: 'Ceri', draw: drawCherry },
];

export const stickerById = (id) => STICKERS.find((sticker) => sticker.id === id) ?? STICKERS[0];

/** Gambar stiker pada kotak persegi (x, y, size) di koordinat kanvas. */
export function drawSticker(ctx, id, x, y, size) {
  const sticker = stickerById(id);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = OUTLINE;
  ctx.strokeStyle = INK;
  sticker.draw(ctx);
  ctx.restore();
}

/* ------------------------------- teks ------------------------------- */

function textStyle(ctx, layout, overlay) {
  const text = String(overlay.text ?? '');
  let fontSize = Math.max(8, overlay.size * layout.width);
  ctx.save();
  ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
  let width = ctx.measureText(text || ' ').width;
  const maxWidth = layout.width * 0.9;
  if (width > maxWidth) {
    fontSize *= maxWidth / width;
    ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
    width = ctx.measureText(text || ' ').width;
  }
  ctx.restore();
  return { text, fontSize, width };
}

function overlayBox(ctx, layout, overlay) {
  const size = Math.max(1, overlay.size * layout.width);
  if (overlay.type === 'sticker') {
    return { w: size, h: size, size };
  }
  const { fontSize, width } = textStyle(ctx, layout, overlay);
  return {
    w: width + fontSize * 0.28,
    h: fontSize * 1.35,
    size: fontSize,
  };
}

function drawText(ctx, layout, overlay) {
  const { text, fontSize, width } = textStyle(ctx, layout, overlay);
  if (!text) return;
  const cx = overlay.x * layout.width;
  const cy = overlay.y * layout.height;
  const color = colorById(overlay.color).fill;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((overlay.rotation * Math.PI) / 180);
  ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, fontSize * 0.1);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  return { fontSize, width };
}

/** Kotak putus-putus di sekitar hiasan terpilih; dipakai pratinjau dan multi-cetak. */
export function drawOverlaySelection(ctx, layout, overlay, dx = 0, dy = 0) {
  if (!overlay) return;
  const box = overlayBox(ctx, layout, overlay);
  const base = Math.max(2, layout.width * 0.006);
  ctx.save();
  ctx.translate(dx + overlay.x * layout.width, dy + overlay.y * layout.height);
  ctx.rotate((overlay.rotation * Math.PI) / 180);
  ctx.setLineDash([]);
  ctx.lineWidth = base * 2.4;
  ctx.strokeStyle = '#FFFDF8';
  ctx.strokeRect(-box.w / 2 - base, -box.h / 2 - base, box.w + base * 2, box.h + base * 2);
  ctx.setLineDash([base * 3, base * 2.2]);
  ctx.lineWidth = base;
  ctx.strokeStyle = '#35283A';
  ctx.strokeRect(-box.w / 2 - base, -box.h / 2 - base, box.w + base * 2, box.h + base * 2);
  ctx.restore();
}

/** Gambar semua hiasan di atas border, plus kotak pilihan saat pratinjau. */
export function drawOverlays(ctx, layout, overlays, { selectedId = null } = {}) {
  ctx.save();
  for (const overlay of overlays) {
    const cx = overlay.x * layout.width;
    const cy = overlay.y * layout.height;
    if (overlay.type === 'sticker') {
      const size = overlay.size * layout.width;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      drawSticker(ctx, overlay.stickerId, -size / 2, -size / 2, size);
      ctx.restore();
    } else {
      drawText(ctx, layout, overlay);
    }
  }

  if (selectedId) {
    const selected = overlays.find((overlay) => overlay.id === selectedId);
    if (selected) drawOverlaySelection(ctx, layout, selected);
  }
  ctx.restore();
}

/** Uji apakah titik kanvas (px, py) mengenai hiasan, dengan toleransi sentuh. */
export function hitTestOverlay(ctx, layout, overlay, px, py) {
  const box = overlayBox(ctx, layout, overlay);
  const cx = overlay.x * layout.width;
  const cy = overlay.y * layout.height;
  const angle = (-overlay.rotation * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  const pad = Math.max(10, box.size * 0.12);
  return Math.abs(localX) <= box.w / 2 + pad && Math.abs(localY) <= box.h / 2 + pad;
}
