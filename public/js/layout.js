export const MM_PER_INCH = 25.4;
export const SAFE_MARGIN_MM = 3;

export const pxFromMm = (mm, dpi = 300) => (mm * dpi) / MM_PER_INCH;

export function paperPixels(paper) {
  return {
    width: Math.round(pxFromMm(paper.lebarMm, paper.dpi)),
    height: Math.round(pxFromMm(paper.tinggiMm, paper.dpi)),
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Menghitung area cetak dan posisi setiap pose.
 *
 * Semua jarak memakai satuan milimeter desain yang diskalakan terhadap ukuran
 * kertas, sehingga border tetap proporsional di 3R maupun A4. Skala 0.5–1.6
 * menjaga margin tidak pernah lebih kecil dari batas aman 3 mm.
 */
export function computeLayout(paper, poseCount, border, scale = 1) {
  const pxPerMm = (paper.dpi / MM_PER_INCH) * scale;
  const width = paperPixels(paper).width * scale;
  const height = paperPixels(paper).height * scale;

  const designScale = clamp(Math.min(paper.lebarMm, paper.tinggiMm) / 101.6, 0.5, 1.6);
  const unit = pxPerMm * designScale;
  const safe = SAFE_MARGIN_MM * pxPerMm;

  const inset = border?.params?.inset ?? { t: 6, r: 6, b: 6, l: 6 };
  const pad = {
    t: Math.max(safe, inset.t * unit),
    r: Math.max(safe, inset.r * unit),
    b: Math.max(safe, inset.b * unit),
    l: Math.max(safe, inset.l * unit),
  };

  const content = {
    x: pad.l,
    y: pad.t,
    w: width - pad.l - pad.r,
    h: height - pad.t - pad.b,
  };

  const gap = Math.max(2 * pxPerMm, 3 * unit);
  const slots = [];

  if (paper.layout === 'strip') {
    const rows = poseCount;
    const rowHeight = (content.h - gap * (rows - 1)) / rows;
    for (let i = 0; i < rows; i += 1) {
      slots.push({
        x: content.x,
        y: content.y + i * (rowHeight + gap),
        w: content.w,
        h: rowHeight,
        index: i,
      });
    }
  } else if (poseCount <= 1) {
    slots.push({ ...content, index: 0 });
  } else if (poseCount === 2) {
    const rowHeight = (content.h - gap) / 2;
    for (let i = 0; i < 2; i += 1) {
      slots.push({
        x: content.x,
        y: content.y + i * (rowHeight + gap),
        w: content.w,
        h: rowHeight,
        index: i,
      });
    }
  } else if (poseCount === 3) {
    const topHeight = (content.h - gap) * 0.56;
    const bottomHeight = content.h - gap - topHeight;
    const bottomWidth = (content.w - gap) / 2;
    slots.push({ x: content.x, y: content.y, w: content.w, h: topHeight, index: 0 });
    slots.push({
      x: content.x,
      y: content.y + topHeight + gap,
      w: bottomWidth,
      h: bottomHeight,
      index: 1,
    });
    slots.push({
      x: content.x + bottomWidth + gap,
      y: content.y + topHeight + gap,
      w: bottomWidth,
      h: bottomHeight,
      index: 2,
    });
  } else {
    const cellW = (content.w - gap) / 2;
    const cellH = (content.h - gap) / 2;
    for (let i = 0; i < 4; i += 1) {
      slots.push({
        x: content.x + (i % 2) * (cellW + gap),
        y: content.y + Math.floor(i / 2) * (cellH + gap),
        w: cellW,
        h: cellH,
        index: i,
      });
    }
  }

  const radius = Math.min(
    ((border?.params?.radius ?? 2) * unit),
    Math.min(...slots.map((slot) => Math.min(slot.w, slot.h))) / 8,
  );

  return {
    width,
    height,
    pxPerMm,
    designScale,
    unit,
    safe,
    pad,
    content,
    gap,
    slots,
    radius,
  };
}

/**
 * Crop cover: mengisi slot tanpa ruang kosong dan tanpa distorsi.
 * Fokus crop sedikit di atas tengah agar wajah tidak terpotong.
 */
export function coverRect(sourceW, sourceH, destW, destH) {
  const scale = Math.max(destW / sourceW, destH / sourceH);
  const sw = destW / scale;
  const sh = destH / scale;
  const focusY = 0.42;
  return {
    sx: (sourceW - sw) / 2,
    sy: clamp((sourceH - sh) * focusY, 0, sourceH - sh),
    sw,
    sh,
  };
}
