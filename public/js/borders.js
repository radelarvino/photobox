/**
 * Dekorasi border digambar sebagai vektor di kanvas berukuran penuh
 * (bukan di-zoom dari layar), sehingga garis dan teks tetap tajam di 300 DPI.
 */

const TAU = Math.PI * 2;
const DISPLAY = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const BODY = '"Nunito", "Segoe UI", system-ui, sans-serif';

/* ----------------------------- utilitas ----------------------------- */

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function luminance(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function alpha(hex, value) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function heartPath(ctx, cx, cy, size, rotation = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(0, -0.35);
  ctx.bezierCurveTo(0.2, -0.78, 0.96, -0.68, 0.96, -0.06);
  ctx.bezierCurveTo(0.96, 0.46, 0.46, 0.76, 0, 1);
  ctx.bezierCurveTo(-0.46, 0.76, -0.96, 0.46, -0.96, -0.06);
  ctx.bezierCurveTo(-0.96, -0.68, -0.2, -0.78, 0, -0.35);
  ctx.closePath();
  ctx.restore();
}

function drawHeart(ctx, cx, cy, size, color, rotation = 0) {
  heartPath(ctx, cx, cy, size, rotation);
  ctx.fillStyle = color;
  ctx.fill();
}

function starPath(ctx, cx, cy, outer, inner, points = 4, rotation = 0) {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStar(ctx, cx, cy, outer, color, rotation = 0, points = 4) {
  starPath(ctx, cx, cy, outer, outer * 0.38, points, rotation);
  ctx.fillStyle = color;
  ctx.fill();
}

function cloudPath(ctx, cx, cy, width) {
  const r = width * 0.19;
  ctx.beginPath();
  ctx.arc(cx - r, cy, r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(cx, cy - r * 0.55, r * 1.2, Math.PI * 1.05, Math.PI * 1.95);
  ctx.arc(cx + r * 1.15, cy, r * 0.95, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
}

function drawCloud(ctx, cx, cy, width, color) {
  cloudPath(ctx, cx, cy, width);
  ctx.fillStyle = color;
  ctx.fill();
}

function write(ctx, string, {
  x, y, size, color, align = 'center', baseline = 'middle',
  family = DISPLAY, weight = 700, style = 'normal', spacing = 0,
}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${style} ${weight} ${size}px ${family}`;
  if ('letterSpacing' in ctx && spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(string, x, y);
  ctx.restore();
}

function ringPoint(rnd, layout, size) {
  const side = Math.floor(rnd() * 4);
  const t = 0.06 + rnd() * 0.88;
  const { pad, width, height } = layout;
  if (side === 0) {
    return { x: width * t, y: Math.max(size * 0.6, pad.t * (0.25 + rnd() * 0.5)) };
  }
  if (side === 1) {
    return { x: width * t, y: height - Math.max(size * 0.6, pad.b * (0.25 + rnd() * 0.5)) };
  }
  if (side === 2) {
    return { x: Math.max(size * 0.6, pad.l * (0.25 + rnd() * 0.5)), y: height * t };
  }
  return { x: width - Math.max(size * 0.6, pad.r * (0.25 + rnd() * 0.5)), y: height * t };
}

/** Posisi teks bawah: tetap terlihat walau margin kertas sempit. */
function bottomTextY(layout, sizeMm) {
  const size = sizeMm * layout.unit;
  const safeY = layout.height - layout.safe - size * 0.6;
  return Math.min(layout.height - layout.pad.b * 0.5, safeY);
}

function outlineSlots(ctx, layout, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (const slot of layout.slots) {
    roundRectPath(ctx, slot.x, slot.y, slot.w, slot.h, layout.radius);
    ctx.stroke();
  }
  ctx.restore();
}

/* ----------------------------- gaya border ----------------------------- */

const renderers = {
  plain(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent } = border.params;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = m(1.1);
    roundRectPath(ctx, m(4.6), m(4.6), layout.width - m(9.2), layout.height - m(9.2), m(6));
    ctx.stroke();

    for (const [x, y] of [
      [m(4.6), m(4.6)],
      [layout.width - m(4.6), m(4.6)],
      [m(4.6), layout.height - m(4.6)],
      [layout.width - m(4.6), layout.height - m(4.6)],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, m(1.2), 0, TAU);
      ctx.fillStyle = accent;
      ctx.fill();
    }
    ctx.restore();
    outlineSlots(ctx, layout, 'rgba(53, 40, 58, 0.10)', Math.max(1, m(0.25)));
  },

  polaroid(ctx, layout, border, meta) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;
    const captionTop = layout.content.y + layout.content.h + m(2.4);

    ctx.save();
    ctx.strokeStyle = 'rgba(53, 40, 58, 0.14)';
    ctx.lineWidth = Math.max(1, m(0.18));
    ctx.beginPath();
    ctx.moveTo(layout.content.x, captionTop + m(6));
    ctx.lineTo(layout.width - layout.content.x, captionTop + m(6));
    ctx.stroke();
    ctx.restore();

    const baseline = layout.content.y + layout.content.h + m(13);
    write(ctx, border.params.title ?? 'photobox', {
      x: layout.content.x,
      y: baseline,
      size: m(8.4),
      color: ink,
      align: 'left',
      weight: 800,
      spacing: -m(0.12),
    });
    write(ctx, meta.dateLabel, {
      x: layout.width - layout.content.x,
      y: baseline + m(0.6),
      size: m(3.8),
      color: 'rgba(74, 59, 69, 0.7)',
      align: 'right',
      family: BODY,
      weight: 700,
    });
    ctx.save();
    ctx.beginPath();
    ctx.arc(layout.content.x + m(1.4), baseline - m(8.6), m(1.1), 0, TAU);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();
    outlineSlots(ctx, layout, 'rgba(53, 40, 58, 0.10)', Math.max(1, m(0.25)));
  },

  hearts(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;
    const rnd = mulberry32(hashSeed(border.id));

    for (let i = 0; i < 16; i += 1) {
      const size = m(2.2 + rnd() * 2.6);
      const point = ringPoint(rnd, layout, size);
      ctx.globalAlpha = 0.35 + rnd() * 0.5;
      drawHeart(ctx, point.x, point.y, size, accent, (rnd() - 0.5) * 0.7);
    }
    ctx.globalAlpha = 1;

    drawHeart(
      ctx,
      Math.max(m(4), layout.pad.l * 0.5),
      layout.height - Math.max(m(4), layout.pad.b * 0.5),
      Math.min(m(8), layout.pad.b * 0.8),
      accent, -0.2,
    );
    drawHeart(
      ctx,
      layout.width - Math.max(m(4), layout.pad.r * 0.5),
      Math.max(m(4), layout.pad.t * 0.5),
      Math.min(m(7), layout.pad.t * 0.8),
      accent, 0.25,
    );

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: bottomTextY(layout, 4.8),
      size: m(4.8),
      color: ink,
      family: DISPLAY,
      weight: 700,
      spacing: m(0.15),
    });

    ctx.save();
    ctx.strokeStyle = alpha(accent, 0.55);
    ctx.lineWidth = m(0.35);
    roundRectPath(ctx, m(4.4), m(4.4), layout.width - m(8.8), layout.height - m(8.8), m(6));
    ctx.stroke();
    ctx.restore();
  },

  stars(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink, bg } = border.params;
    const rnd = mulberry32(hashSeed(border.id));

    // Bulan sabit di kanan atas.
    const moonR = Math.min(m(3.6), layout.pad.t * 0.36);
    const moonX = layout.width - layout.pad.r * 0.52;
    const moonY = layout.pad.t * 0.52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.42, moonY - moonR * 0.3, moonR * 0.86, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 22; i += 1) {
      const size = m(1.1 + rnd() * 2.1);
      const point = ringPoint(rnd, layout, size);
      ctx.globalAlpha = 0.4 + rnd() * 0.6;
      drawStar(ctx, point.x, point.y, size, i % 4 === 0 ? '#ffffff' : accent, rnd() * TAU);
    }
    ctx.globalAlpha = 1;

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: bottomTextY(layout, 5),
      size: m(5),
      color: accent,
      family: DISPLAY,
      weight: 700,
      spacing: m(0.2),
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 246, 229, 0.22)';
    ctx.lineWidth = m(0.3);
    roundRectPath(ctx, m(3.4), m(3.4), layout.width - m(6.8), layout.height - m(6.8), m(6));
    ctx.stroke();
    ctx.restore();
  },

  clouds(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;
    const rnd = mulberry32(hashSeed(border.id));
    const white = 'rgba(255, 255, 255, 0.92)';

    drawCloud(ctx, layout.width * 0.22, layout.pad.t * 0.5, m(24), white);
    drawCloud(ctx, layout.width * 0.62, layout.pad.t * 0.34, m(18), white);
    drawCloud(ctx, layout.width * 0.42, layout.height - layout.pad.b * 0.45, m(20), white);
    drawCloud(ctx, layout.width * 0.84, layout.height - layout.pad.b * 0.62, m(14), white);

    for (let i = 0; i < 7; i += 1) {
      const size = m(0.9 + rnd() * 1.4);
      const point = ringPoint(rnd, layout, size);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: bottomTextY(layout, 4.8),
      size: m(4.8),
      color: ink,
      family: DISPLAY,
      weight: 700,
      style: 'italic',
      spacing: m(0.2),
    });

    ctx.save();
    ctx.strokeStyle = alpha(accent, 0.75);
    ctx.lineWidth = m(0.4);
    ctx.setLineDash([m(2), m(1.6)]);
    roundRectPath(ctx, m(3.4), m(3.4), layout.width - m(6.8), layout.height - m(6.8), m(6));
    ctx.stroke();
    ctx.restore();
  },

  film(ctx, layout, border, meta) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;

    const holeW = Math.min(m(6), layout.pad.l * 0.6, layout.pad.r * 0.6);
    const holeH = holeW * 1.3;
    const step = holeW * 2.26;
    const leftX = (layout.pad.l - holeW) / 2;
    const rightX = layout.width - (layout.pad.r + holeW) / 2;

    ctx.save();
    ctx.fillStyle = '#f5f2ea';
    for (let y = layout.pad.t * 0.35; y < layout.height - layout.pad.b * 0.2; y += step) {
      roundRectPath(ctx, leftX, y, holeW, holeH, m(1));
      ctx.fill();
      roundRectPath(ctx, rightX, y, holeW, holeH, m(1));
      ctx.fill();
    }
    ctx.restore();

    write(ctx, border.params.title, {
      x: layout.pad.l / 2 + m(1),
      y: layout.pad.t * 0.4,
      size: m(3),
      color: accent,
      align: 'left',
      weight: 800,
      spacing: m(0.5),
    });

    write(ctx, `${meta.poseCount} exp · 300 dpi`, {
      x: layout.width - layout.pad.r / 2 - m(1),
      y: layout.height - layout.pad.b * 0.4,
      size: m(2.6),
      color: 'rgba(245, 242, 234, 0.6)',
      align: 'right',
      family: BODY,
      weight: 700,
      spacing: m(0.2),
    });

    write(ctx, `${meta.dateLabel}`, {
      x: layout.pad.l / 2 + m(1),
      y: layout.height - layout.pad.b * 0.4,
      size: m(2.6),
      color: 'rgba(245, 242, 234, 0.55)',
      align: 'left',
      family: BODY,
      weight: 700,
    });

    outlineSlots(ctx, layout, 'rgba(245, 242, 234, 0.4)', Math.max(1, m(0.3)));
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 242, 234, 0.18)';
    ctx.lineWidth = m(0.25);
    ctx.beginPath();
    ctx.moveTo(leftX + holeW + m(1.5), m(2.2));
    ctx.lineTo(leftX + holeW + m(1.5), layout.height - m(2.2));
    ctx.moveTo(rightX - m(1.5), m(2.2));
    ctx.lineTo(rightX - m(1.5), layout.height - m(2.2));
    ctx.stroke();
    ctx.restore();
    void ink;
  },

  birthday(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;
    const rnd = mulberry32(hashSeed(border.id));
    const palette = [accent, '#4FA9DC', '#2EC4B6', '#FFD166', '#B285E8'];

    // Umbul-umbul di margin atas.
    const stringY = layout.pad.t * 0.42;
    const startX = layout.pad.l * 0.42;
    const endX = layout.width - layout.pad.r * 0.42;
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = m(0.35);
    ctx.beginPath();
    ctx.moveTo(startX, stringY);
    ctx.quadraticCurveTo(layout.width / 2, stringY + m(3.4), endX, stringY);
    ctx.stroke();

    const flags = Math.max(4, Math.round((endX - startX) / m(10)));
    for (let i = 0; i < flags; i += 1) {
      const t = (i + 0.5) / flags;
      const x = startX + (endX - startX) * t;
      const dip = Math.sin(t * Math.PI) * m(3.4);
      ctx.beginPath();
      ctx.moveTo(x - m(2.6), stringY + dip * 0.55);
      ctx.lineTo(x + m(2.6), stringY + dip * 0.55);
      ctx.lineTo(x, stringY + dip * 0.55 + m(6));
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
    }
    ctx.restore();

    for (let i = 0; i < 18; i += 1) {
      const size = m(0.8 + rnd() * 1.5);
      const point = ringPoint(rnd, layout, size);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(rnd() * TAU);
      ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
      ctx.fillRect(-size, -size / 2, size * 2, size);
      ctx.restore();
    }

    // Balon di kedua sudut bawah.
    for (const side of [-1, 1]) {
      const x = side < 0 ? m(8) : layout.width - m(8);
      const y = layout.height - layout.pad.b * 0.66;
      const r = Math.min(m(3.2), layout.pad.b * 0.22);
      const stringEnd = Math.min(layout.height - layout.safe * 0.9, y + r + m(7));
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = m(0.3);
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.quadraticCurveTo(x + m(2.2), (y + r + stringEnd) / 2, x, stringEnd);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.82, r, 0, 0, TAU);
      ctx.fillStyle = side < 0 ? accent : '#4FA9DC';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: bottomTextY(layout, 5.6),
      size: m(5.6),
      color: ink,
      family: DISPLAY,
      weight: 800,
      spacing: m(0.15),
    });
  },

  wedding(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;

    ctx.save();
    ctx.strokeStyle = alpha(accent, 0.85);
    ctx.lineWidth = m(0.35);
    roundRectPath(ctx, m(3.4), m(3.4), layout.width - m(6.8), layout.height - m(6.8), m(5));
    ctx.stroke();
    ctx.strokeStyle = alpha(accent, 0.45);
    ctx.lineWidth = m(0.18);
    roundRectPath(ctx, m(4.6), m(4.6), layout.width - m(9.2), layout.height - m(9.2), m(4));
    ctx.stroke();
    ctx.restore();

    // Ranting kecil di tiap sudut.
    const branch = (cx, cy, sx, sy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      ctx.strokeStyle = alpha(accent, 0.75);
      ctx.lineWidth = m(0.3);
      ctx.beginPath();
      ctx.moveTo(0, m(10));
      ctx.quadraticCurveTo(m(1), m(4), m(7), 0);
      ctx.stroke();
      for (let i = 1; i <= 4; i += 1) {
        const t = i / 4.6;
        const x = m(7) * t;
        const y = m(10) * (1 - t) ** 1.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.7 + i * 0.24);
        ctx.beginPath();
        ctx.ellipse(0, 0, m(1.5), m(0.7), 0, 0, TAU);
        ctx.fillStyle = alpha(accent, 0.5);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const inset = m(7);
    branch(inset, inset, 1, 1);
    branch(layout.width - inset, inset, -1, 1);
    branch(inset, layout.height - inset, 1, -1);
    branch(layout.width - inset, layout.height - inset, -1, -1);

    const titleY = bottomTextY(layout, 4.8);
    ctx.save();
    ctx.strokeStyle = alpha(accent, 0.6);
    ctx.lineWidth = m(0.2);
    ctx.beginPath();
    ctx.moveTo(layout.width * 0.3, titleY - m(3.2));
    ctx.lineTo(layout.width * 0.7, titleY - m(3.2));
    ctx.stroke();
    ctx.restore();

    drawHeart(ctx, layout.width / 2, titleY - m(5.8), m(2.4), alpha(accent, 0.9));

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: titleY,
      size: m(4.6),
      color: ink,
      family: BODY,
      weight: 600,
      style: 'italic',
      spacing: m(0.9),
    });
  },

  campus(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;

    ctx.save();
    ctx.strokeStyle = alpha(accent, 0.85);
    ctx.lineWidth = m(1.1);
    ctx.beginPath();
    ctx.moveTo(m(4), m(4));
    ctx.lineTo(layout.width - m(4), m(4));
    ctx.moveTo(m(4), layout.height - m(4));
    ctx.lineTo(layout.width - m(4), layout.height - m(4));
    ctx.stroke();

    ctx.strokeStyle = alpha(accent, 0.35);
    ctx.lineWidth = m(0.25);
    roundRectPath(ctx, m(4.6), m(4.6), layout.width - m(9.2), layout.height - m(9.2), m(4));
    ctx.stroke();
    ctx.restore();

    drawStar(ctx, layout.width / 2, layout.pad.t * 0.42, m(3.4), accent);

    const titleY = bottomTextY(layout, 4.4);
    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: titleY,
      size: m(4.4),
      color: accent,
      family: BODY,
      weight: 800,
      spacing: m(1.1),
    });

    for (const [cx, dir] of [[layout.width / 2 - m(34), 1], [layout.width / 2 + m(34), -1]]) {
      ctx.save();
      ctx.strokeStyle = alpha(accent, 0.55);
      ctx.lineWidth = m(0.3);
      ctx.beginPath();
      ctx.arc(cx, titleY + m(2), m(7), Math.PI * 1.05, Math.PI * 1.75, dir < 0);
      ctx.stroke();
      ctx.restore();
    }
    void ink;
  },

  confetti(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;
    const rnd = mulberry32(hashSeed(border.id));
    const palette = [accent, '#FFD166', '#FF7A9C', '#8ED3FF', '#B285E8'];

    for (let i = 0; i < 26; i += 1) {
      const size = m(0.9 + rnd() * 1.7);
      const point = ringPoint(rnd, layout, size);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(rnd() * TAU);
      ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
      ctx.globalAlpha = 0.55 + rnd() * 0.45;
      ctx.fillRect(-size, -size / 2.4, size * 2, size / 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Wajah doodle lucu.
    const faces = [
      { x: layout.width * 0.18, y: layout.pad.t * 0.55, r: m(3.2) },
      { x: layout.width * 0.82, y: layout.pad.b * 0.55 + layout.content.y + layout.content.h, r: m(2.8) },
      { x: layout.pad.l * 0.55, y: layout.height * 0.55, r: m(2.4) },
    ];
    for (const face of faces) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(face.x, face.y, face.r, 0, TAU);
      ctx.fillStyle = palette[0];
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = m(0.28);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(face.x - face.r * 0.32, face.y - face.r * 0.15, face.r * 0.11, 0, TAU);
      ctx.arc(face.x + face.r * 0.32, face.y - face.r * 0.15, face.r * 0.11, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(face.x, face.y + face.r * 0.1, face.r * 0.42, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.restore();
    }

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: bottomTextY(layout, 5.2),
      size: m(5.2),
      color: ink,
      family: DISPLAY,
      weight: 700,
      spacing: m(0.2),
    });
  },

  retro(ctx, layout, border) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;

    // Lengkungan matahari terbit di margin atas.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, layout.width, layout.pad.t);
    ctx.clip();
    const cx = layout.width / 2;
    const baseY = layout.pad.t * 1.02;
    const bands = [
      { r: layout.pad.t * 1.35, color: alpha(accent, 0.9) },
      { r: layout.pad.t * 1.05, color: alpha('#FFD166', 0.9) },
      { r: layout.pad.t * 0.75, color: alpha(accent, 0.65) },
      { r: layout.pad.t * 0.45, color: alpha('#FFF3C4', 0.9) },
    ];
    for (const band of bands) {
      ctx.beginPath();
      ctx.arc(cx, baseY, band.r, Math.PI, TAU);
      ctx.fillStyle = band.color;
      ctx.fill();
    }
    ctx.restore();

    // Gelombang di margin bawah.
    for (let i = 0; i < 3; i += 1) {
      const y = layout.height - layout.pad.b * 0.45 + i * m(2.4);
      ctx.save();
      ctx.strokeStyle = i === 1 ? alpha(ink, 0.35) : alpha(accent, 0.7);
      ctx.lineWidth = m(0.5);
      ctx.beginPath();
      for (let x = 0; x <= layout.width; x += m(2)) {
        const wy = y + Math.sin((x / layout.width) * TAU * 3 + i) * m(0.9);
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
      ctx.restore();
    }

    write(ctx, border.params.title, {
      x: layout.width / 2,
      y: layout.height - layout.pad.b * 0.56,
      size: m(5.6),
      color: ink,
      family: DISPLAY,
      weight: 700,
      style: 'italic',
      spacing: m(0.3),
    });
  },

  postcard(ctx, layout, border, meta) {
    const m = (v) => v * layout.unit;
    const { accent, ink } = border.params;

    // Strip airmail di tepi kiri.
    const stripeW = layout.pad.l * 0.48;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, stripeW, layout.height);
    ctx.clip();
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, stripeW, layout.height);
    const band = m(2.2);
    let stripeIndex = 0;
    for (let y = -layout.height; y < layout.height * 2; y += band * 2) {
      ctx.save();
      ctx.translate(stripeW / 2, 0);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = stripeIndex % 2 === 0 ? '#E2557A' : '#4A7C59';
      ctx.fillRect(-layout.height, y, layout.height * 2, band);
      ctx.restore();
      stripeIndex += 1;
    }
    ctx.restore();

    // Bingkai tipis.
    ctx.save();
    ctx.strokeStyle = alpha(ink, 0.35);
    ctx.lineWidth = m(0.22);
    roundRectPath(ctx, m(3), m(3), layout.width - m(6), layout.height - m(6), m(1.2));
    ctx.stroke();
    ctx.restore();

    const captionY = layout.height - layout.pad.b * 0.52;

    write(ctx, border.params.title, {
      x: layout.content.x,
      y: captionY,
      size: m(4.4),
      color: ink,
      align: 'left',
      family: BODY,
      weight: 600,
      style: 'italic',
      spacing: m(0.4),
    });

    write(ctx, meta.dateLabel, {
      x: layout.content.x,
      y: captionY + m(4.4),
      size: m(2.6),
      color: 'rgba(63, 74, 60, 0.65)',
      align: 'left',
      family: BODY,
      weight: 700,
      spacing: m(0.3),
    });

    // Prangko kecil di kanan bawah.
    const stampW = m(9.5);
    const stampH = m(11);
    const stampX = layout.width - layout.pad.r * 0.55 - stampW / 2;
    const stampY = layout.height - layout.safe - stampH - m(0.6);
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(stampX, stampY, stampW, stampH);
    ctx.strokeStyle = alpha(ink, 0.55);
    ctx.lineWidth = m(0.22);
    ctx.setLineDash([m(1), m(0.8)]);
    ctx.strokeRect(stampX, stampY, stampW, stampH);
    ctx.setLineDash([]);
    drawStar(ctx, stampX + stampW / 2, stampY + stampH / 2, stampW * 0.28, alpha(accent, 0.9), 0, 5);
    ctx.restore();

    outlineSlots(ctx, layout, 'rgba(63, 74, 60, 0.12)', Math.max(1, m(0.25)));
  },
};

export function drawBorder(ctx, layout, border, meta) {
  const renderer = renderers[border.style] ?? renderers.plain;
  ctx.save();
  renderer(ctx, layout, border, meta);
  ctx.restore();
}

export function borderBackground(border) {
  const bg = border?.params?.bg ?? '#FFFFFF';
  return { color: bg, dark: luminance(bg) < 0.5 };
}
