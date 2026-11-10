/**
 * Filter memakai sintaks CSS `filter` yang sama untuk pratinjau dan hasil
 * akhir. Bila peramban tidak mendukung `ctx.filter` (Safari lama), dipakai
 * cadangan pemrosesan piksel agar hasil unduhan tetap sama.
 */

const DEFAULTS = {
  grayscale: 0,
  sepia: 0,
  saturate: 1,
  contrast: 1,
  brightness: 1,
};

export function parseFilter(css) {
  const result = { ...DEFAULTS };
  if (!css || css === 'none') return result;
  for (const match of css.matchAll(/([a-z-]+)\(([\d.]+)\)/g)) {
    const [, name, raw] = match;
    const value = Number(raw);
    if (name in result && Number.isFinite(value)) result[name] = value;
  }
  return result;
}

let cachedSupport = null;

export function detectCanvasFilter() {
  if (cachedSupport !== null) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 2, 2);
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(canvas, 0, 0);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    cachedSupport = Math.abs(r - g) < 6 && Math.abs(g - b) < 6;
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Terapkan filter CSS sederhana langsung ke data piksel. */
export function applyFilterPixels(imageData, css, intensity = 1) {
  const params = parseFilter(css);
  if (css === 'none' || intensity <= 0) return imageData;

  const data = imageData.data;
  const { grayscale, sepia, saturate, contrast, brightness } = params;
  const mix = Math.min(1, Math.max(0, intensity));

  for (let i = 0; i < data.length; i += 4) {
    const or = data[i];
    const og = data[i + 1];
    const ob = data[i + 2];
    let r = or;
    let g = og;
    let b = ob;

    if (grayscale > 0) {
      const lum = luminance(r, g, b);
      r += (lum - r) * grayscale;
      g += (lum - g) * grayscale;
      b += (lum - b) * grayscale;
    }

    if (sepia > 0) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }

    if (saturate !== 1) {
      const lum = luminance(r, g, b);
      r = lum + (r - lum) * saturate;
      g = lum + (g - lum) * saturate;
      b = lum + (b - lum) * saturate;
    }

    if (contrast !== 1) {
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
    }

    if (brightness !== 1) {
      r *= brightness;
      g *= brightness;
      b *= brightness;
    }

    data[i] = or + (r - or) * mix;
    data[i + 1] = og + (g - og) * mix;
    data[i + 2] = ob + (b - ob) * mix;
  }

  return imageData;
}
