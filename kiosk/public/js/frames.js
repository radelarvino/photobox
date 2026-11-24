/**
 * Delapan tema bingkai romantis. Semua ornamen digambar dengan path vektor
 * dan ditempatkan di pita header/footer atau margin — tidak pernah di atas
 * area foto, supaya wajah tidak tertutup.
 */

const hex = (value) => {
  const s = String(value).replace('#', '');
  if (s.length !== 6) return [28, 26, 24];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

function luminance(color) {
  const [r, g, b] = hex(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pastikan teks terbaca; jika tidak, ganti ke tinta gelap/terang. */
export function readableInk(paper, preferred) {
  return contrastRatio(paper, preferred) >= 4.5
    ? preferred
    : (luminance(paper) > 0.45 ? '#1c1a18' : '#fffdf8');
}

function fitFont(ctx, text, maxWidth, size, family, weight = 400, style = 'normal') {
  let s = size;
  do {
    ctx.font = `${style} ${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 1;
  } while (s > 8);
  return s;
}

function spaced(ctx, text, x, y, spacing, align = 'center') {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + spacing;
  });
  return total;
}

function rule(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

function cornerMarks(ctx, geo, color, len = 14) {
  const pts = [
    [geo.margin / 2, geo.margin / 2, 1, 1],
    [geo.width - geo.margin / 2, geo.margin / 2, -1, 1],
    [geo.margin / 2, geo.height - geo.margin / 2, 1, -1],
    [geo.width - geo.margin / 2, geo.height - geo.margin / 2, -1, -1],
  ];
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.4;
  for (const [x, y, sx, sy] of pts) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * len); ctx.lineTo(x, y); ctx.lineTo(x + sx * len, y); ctx.stroke();
  }
  ctx.restore();
}

function perforations(ctx, geo, color) {
  const step = 54;
  const r = 4;
  ctx.save();
  ctx.fillStyle = color;
  for (let y = geo.area.y; y < geo.area.y + geo.area.h; y += step) {
    ctx.beginPath(); ctx.arc(geo.margin / 2, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(geo.width - geo.margin / 2, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function sprig(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 64); ctx.quadraticCurveTo(8, 32, 30, 2); ctx.stroke();
  for (const [tx, ty, cx, cy] of [[10, 46, 2, 40], [18, 30, 10, 26], [25, 15, 18, 12]]) {
    ctx.beginPath(); ctx.moveTo(7 + tx / 3, ty + 8);
    ctx.quadraticCurveTo(cx + 16, cy, tx + 14, ty - 6); ctx.stroke();
  }
  ctx.restore();
}

function seal(ctx, x, y, r, initials, accent, paper, ink) {
  ctx.save();
  ctx.fillStyle = accent; ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = paper; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = paper;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(ctx, initials, r * 1.4, r * 0.72, 'Bodoni Moda', 700);
  ctx.fillText(initials, x, y + 1);
  ctx.restore();
}

function initialsOf(name) {
  return [...name.trim().split(/\s+/).filter(Boolean)].slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'PB';
}

/** Gambar header (nama + tanggal) dengan gaya khas tiap frame. */
function header(ctx, info, ink, accent, opts = {}) {
  const { geo, text } = info;
  const cx = geo.width / 2;
  const nameSize = geo.width < 700 ? 30 : geo.width > 1500 ? 54 : 44;
  const dateSize = geo.width < 700 ? 17 : 22;
  const yName = geo.header * (opts.high ? 0.46 : 0.58);
  ctx.save();
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, text.nama || 'PHOTOBOX', geo.width - 2 * geo.margin - 40, nameSize, 'Bodoni Moda', 700, opts.italicName ? 'italic' : 'normal');
  if (opts.spacedName) {
    spaced(ctx, text.nama || 'PHOTOBOX', cx, yName, nameSize * 0.1);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(text.nama || 'PHOTOBOX', cx, yName);
  }
  if (text.tanggal) {
    ctx.fillStyle = opts.accentDate ? accent : ink;
    ctx.globalAlpha = opts.accentDate ? 1 : 0.78;
    fitFont(ctx, text.tanggal, geo.width - 2 * geo.margin - 40, dateSize, 'DM Sans', 500);
    ctx.textAlign = 'center';
    ctx.fillText(text.tanggal, cx, yName + dateSize * 1.5);
  }
  ctx.restore();
}

function footer(ctx, info, ink, accent, opts = {}) {
  const { geo, text } = info;
  const top = geo.height - geo.footer;
  const cx = geo.width / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  if (text.kutipan) {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.86;
    fitFont(ctx, text.kutipan, geo.width - 2 * geo.margin - 60, geo.width < 700 ? 22 : 30, 'Bodoni Moda', 400, 'italic');
    ctx.textAlign = 'center';
    ctx.fillText(`“${text.kutipan}”`, cx, top + geo.footer * (opts.high ? 0.5 : 0.44));
  }
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = ink;
  fitFont(ctx, 'PHOTOBOX · CETAKAN 300 DPI', geo.width - 2 * geo.margin - 40, 13, 'DM Sans', 700);
  ctx.textAlign = 'center';
  spaced(ctx, 'PHOTOBOX · CETAKAN 300 DPI', cx, geo.height - geo.margin * 0.7, 2.4);
  ctx.restore();
}

export const FRAMES = Object.freeze([
  {
    id: 'ivory-letterpress', nama: 'Ivory Letterpress', deskripsi: 'Garis ganda, cap sudut, tipografi undangan.',
    palet: { kertas: '#f7f2e8', tinta: '#1c1a18', aksen: '#a9885b' },
    alasan: 'Garis timbul dan ruang kosong memberi kesan kertas undangan cetak, tanpa ornamen figural.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      rule(ctx, 8, 8, geo.width - 8, 8, ink, 1.4);
      rule(ctx, 8, geo.height - 8, geo.width - 8, geo.height - 8, ink, 1.4);
      rule(ctx, 13, 13, 13, geo.height - 13, accent, 1);
      rule(ctx, geo.width - 13, 13, geo.width - 13, geo.height - 13, accent, 1);
      cornerMarks(ctx, geo, ink);
      header(ctx, info, ink, accent, { spacedName: true });
      rule(ctx, geo.margin, geo.header * 0.84, geo.width - geo.margin, geo.header * 0.84, accent, 1);
      footer(ctx, info, ink, accent);
    },
  },
  {
    id: 'botanical-line', nama: 'Botanical Line', deskripsi: 'Satu ranting di pojok, sisanya polos.',
    palet: { kertas: '#f6f3e9', tinta: '#2f3a31', aksen: '#6d7d6a' },
    alasan: 'Satu goresan botani memberi kelembutan; sisanya sengaja kosong agar foto bernapas.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      rule(ctx, geo.margin, 12, geo.width - geo.margin, 12, accent, 1.2);
      const cx = geo.width / 2;
      ctx.save();
      ctx.fillStyle = ink;
      fitFont(ctx, info.text.nama || 'PHOTOBOX', geo.width - 140, geo.width < 700 ? 32 : 48, 'Bodoni Moda', 700, 'italic');
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(info.text.nama || 'PHOTOBOX', geo.width - geo.margin, geo.header * 0.62);
      if (info.text.tanggal) {
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.8; fitFont(ctx, info.text.tanggal, geo.width - 140, 18, 'DM Sans', 500);
        ctx.textAlign = 'left'; ctx.fillText(info.text.tanggal, geo.margin, geo.header * 0.72);
      }
      ctx.restore();
      sprig(ctx, geo.margin, geo.height - geo.footer + 8, geo.footer * 0.72, accent);
      void cx;
      footer(ctx, info, ink, accent, { high: true });
    },
  },
  {
    id: 'film-noir', nama: 'Film Noir Romance', deskripsi: 'Hitam putih, perforasi film, cap tanggal.',
    palet: { kertas: '#171614', tinta: '#f2ece1', aksen: '#c1442b' },
    alasan: 'Romantik lewat nostalgia film hitam putih dan satu cap merah, bukan hati bertebaran.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      perforations(ctx, geo, ink);
      header(ctx, info, ink, accent, { spacedName: true });
      if (info.text.tanggal) {
        ctx.save();
        ctx.strokeStyle = accent; ctx.lineWidth = 1.6;
        const w = ctx.measureText(info.text.tanggal).width + 26;
        ctx.strokeRect(geo.width / 2 - w / 2, geo.header * 0.68 - 17, w, 27);
        ctx.restore();
      }
      rule(ctx, geo.margin, geo.header * 0.9, geo.width - geo.margin, geo.header * 0.9, ink, 0.8);
      footer(ctx, info, ink, accent);
    },
  },
  {
    id: 'soft-blush', nama: 'Soft Blush', deskripsi: 'Tepi dusty rose, sudut halus, monogram.',
    palet: { kertas: '#f5e9e5', tinta: '#3a2c2b', aksen: '#b98b82' },
    alasan: 'Warna dusty yang tertahan dan monogram kecil terasa manis tanpa menjadi norak.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      ctx.save();
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(10, 10, geo.width - 20, geo.height - 20, 14); ctx.stroke();
      ctx.restore();
      header(ctx, info, ink, accent, { italicName: true });
      seal(ctx, geo.width - geo.margin - 26, geo.header * 0.5, 20, initialsOf(info.text.nama), accent, this.palet.kertas, ink);
      footer(ctx, info, ink, accent, { high: true });
    },
  },
  {
    id: 'gold-foil', nama: 'Gold Foil Minimal', deskripsi: 'Garis champagne, serif nama & tanggal.',
    palet: { kertas: '#f8f3e9', tinta: '#26231f', aksen: '#a9885b' },
    alasan: 'Satu garis metalik tipis dan tipografi serif menghadirkan kesan undanganformal.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      rule(ctx, 14, 14, geo.width - 14, 14, accent, 1.2);
      rule(ctx, 14, geo.height - 14, geo.width - 14, geo.height - 14, accent, 1.2);
      rule(ctx, geo.margin, geo.header * 0.88, geo.width - geo.margin, geo.header * 0.88, accent, 0.8);
      header(ctx, info, ink, accent, { spacedName: true, high: true });
      footer(ctx, info, ink, accent);
    },
  },
  {
    id: 'polaroid-letter', nama: 'Polaroid Love Letter', deskripsi: 'Bingkai putih, ruang catatan tulisan tangan.',
    palet: { kertas: '#fffdf8', tinta: '#1c1a18', aksen: '#c1442b' },
    alasan: 'Bingkai Polaroid yang akrab ditambah ruang catatan membuatnya terasa personal.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      ctx.save();
      ctx.fillStyle = accent;
      ctx.fillRect(geo.width - geo.margin - 46, 18, 34, 5);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      fitFont(ctx, info.text.nama || 'PHOTOBOX', geo.width - 120, 22, 'Bodoni Moda', 400, 'italic');
      ctx.fillText(info.text.nama || 'PHOTOBOX', geo.width - geo.margin, geo.header * 0.66);
      if (info.text.tanggal) {
        ctx.globalAlpha = 0.7; fitFont(ctx, info.text.tanggal, geo.width - 120, 15, 'DM Sans', 500);
        ctx.fillText(info.text.tanggal, geo.width - geo.margin, geo.header * 0.86);
      }
      ctx.restore();
      const top = geo.height - geo.footer;
      rule(ctx, geo.margin, top + 6, geo.width - geo.margin, top + 6, ink, 0.8);
      ctx.save();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitFont(ctx, info.text.kutipan || 'untuk malam yang tidak berulang', geo.width - 2 * geo.margin - 40, geo.width < 700 ? 24 : 34, 'Bodoni Moda', 400, 'italic');
      ctx.fillText(info.text.kutipan || 'untuk malam yang tidak berulang', geo.width / 2, top + geo.footer * 0.46);
      ctx.restore();
      rule(ctx, geo.margin, geo.height - geo.margin, geo.width - geo.margin, geo.height - geo.margin, ink, 1.4);
    },
  },
  {
    id: 'ink-and-vow', nama: 'Ink & Vow', deskripsi: 'Frame gelap, hairline terang, segel merah.',
    palet: { kertas: '#171614', tinta: '#f3ede1', aksen: '#c1442b' },
    alasan: 'Latar gelap dan satu segel merah memberi drama yang tetap tertahan dan elegan.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      rule(ctx, 9, 9, geo.width - 9, 9, ink, 0.9);
      rule(ctx, 9, geo.height - 9, geo.width - 9, geo.height - 9, ink, 0.9);
      header(ctx, info, ink, accent, { spacedName: true, high: true });
      const top = geo.height - geo.footer;
      seal(ctx, geo.width / 2, top + geo.footer * 0.52, Math.min(30, geo.footer * 0.3), initialsOf(info.text.nama), accent, this.palet.kertas, ink);
      ctx.save();
      ctx.fillStyle = ink; ctx.globalAlpha = 0.7; ctx.textAlign = 'center';
      fitFont(ctx, info.text.kutipan || '', geo.width - 2 * geo.margin - 40, 18, 'Bodoni Moda', 400, 'italic');
      ctx.fillText(info.text.kutipan || '', geo.width / 2, geo.height - geo.margin * 0.9);
      ctx.restore();
    },
  },
  {
    id: 'paper-and-thread', nama: 'Paper & Thread', deskripsi: 'Kraft, jahitan putus-putus, segel lilin.',
    palet: { kertas: '#e8dcc4', tinta: '#2b2620', aksen: '#6d7d6a' },
    alasan: 'Tekstur kraft dan garis jahitan menghadirkan kehangatan barang buatan tangan.',
    draw(ctx, info) {
      const { geo } = info;
      const ink = readableInk(this.palet.kertas, this.palet.tinta);
      const accent = info.settings.frameAccent || this.palet.aksen;
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
      ctx.strokeRect(12, 12, geo.width - 24, geo.height - 24);
      ctx.restore();
      header(ctx, info, ink, accent, { high: true });
      const top = geo.height - geo.footer;
      seal(ctx, geo.margin + 36, top + geo.footer * 0.5, Math.min(26, geo.footer * 0.27), initialsOf(info.text.nama), accent, this.palet.kertas, ink);
      ctx.save();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitFont(ctx, info.text.kutipan || '', geo.width - 160, 24, 'Bodoni Moda', 400, 'italic');
      ctx.fillText(info.text.kutipan || '', geo.width / 2 + 20, top + geo.footer * 0.5);
      ctx.restore();
      rule(ctx, geo.margin, geo.height - geo.margin * 0.8, geo.width - geo.margin, geo.height - geo.margin * 0.8, ink, 0.8);
    },
  },
]);

export function frameById(id) {
  return FRAMES.find((frame) => frame.id === id) ?? FRAMES[0];
}
