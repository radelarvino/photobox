/** Interaksi hiasan langsung di kanvas pratinjau. */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function localPoint(overlay, px, py, geo) {
  const cx = overlay.x * geo.width;
  const cy = overlay.y * geo.height;
  const angle = -((overlay.rotation ?? 0) * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    cx, cy,
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

export function hitTest(overlay, px, py, geo) {
  const unit = Math.min(geo.width, geo.height);
  const half = overlay.size * unit / 2;
  const p = localPoint(overlay, px, py, geo);
  const hit = (hx, hy, r = 15) => (p.x - hx) ** 2 + (p.y - hy) ** 2 <= r * r;
  if (hit(half, half)) return 'resize';
  if (hit(0, -half - 18)) return 'rotate';
  const pad = Math.max(10, half * 0.25);
  if (Math.abs(p.x) <= half + pad && Math.abs(p.y) <= half + pad) return 'body';
  return null;
}

/**
 * Pasang kontrol pointer & keyboard.
 * getState() harus mengembalikan { overlays, selectedId, geo, settings }.
 * onChange() dipanggil setiap kali data berubah.
 */
export function attachOverlayControls(canvas, getState, onChange) {
  let mode = null;
  let start = null;

  function pointOf(event) {
    const rect = canvas.getBoundingClientRect();
    const { geo } = getState();
    return {
      x: ((event.clientX - rect.left) / rect.width) * geo.width,
      y: ((event.clientY - rect.top) / rect.height) * geo.height,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const state = getState();
    const p = pointOf(event);
    for (let i = state.overlays.length - 1; i >= 0; i -= 1) {
      const overlay = state.overlays[i];
      const part = hitTest(overlay, p.x, p.y, state.geo);
      if (!part) continue;
      state.selectedId = overlay.id;
      mode = part;
      start = { p, x: overlay.x, y: overlay.y, size: overlay.size, rotation: overlay.rotation ?? 0 };
      canvas.setPointerCapture(event.pointerId);
      onChange('select');
      return;
    }
    state.selectedId = null;
    mode = null;
    onChange('select');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!mode || !start) return;
    const state = getState();
    const overlay = state.overlays.find((o) => o.id === state.selectedId);
    if (!overlay) return;
    const p = pointOf(event);
    const { geo } = state;
    const unit = Math.min(geo.width, geo.height);

    if (mode === 'body') {
      overlay.x = clamp(start.x + (p.x - start.p.x) / geo.width, 0.02, 0.98);
      overlay.y = clamp(start.y + (p.y - start.p.y) / geo.height, 0.02, 0.98);
    } else if (mode === 'resize') {
      const dist = Math.hypot(p.x - overlay.x * geo.width, p.y - overlay.y * geo.height);
      overlay.size = clamp(dist / unit * 2, 0.04, 0.3);
    } else if (mode === 'rotate') {
      const angle = Math.atan2(p.y - overlay.y * geo.height, p.x - overlay.x * geo.width) * 180 / Math.PI;
      overlay.rotation = Math.round((angle + 90 + 360) % 360);
    }
    onChange('move');
  });

  const end = (event) => {
    if (mode && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    mode = null; start = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener('keydown', (event) => {
    const state = getState();
    const overlay = state.overlays.find((o) => o.id === state.selectedId);
    if (!overlay) return;
    const step = event.shiftKey ? 0.02 : 0.005;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': overlay.x = clamp(overlay.x - step, 0.02, 0.98); break;
      case 'ArrowRight': overlay.x = clamp(overlay.x + step, 0.02, 0.98); break;
      case 'ArrowUp': overlay.y = clamp(overlay.y - step, 0.02, 0.98); break;
      case 'ArrowDown': overlay.y = clamp(overlay.y + step, 0.02, 0.98); break;
      case '+': case '=': overlay.size = clamp(overlay.size + 0.01, 0.04, 0.3); break;
      case '-': overlay.size = clamp(overlay.size - 0.01, 0.04, 0.3); break;
      case '[': overlay.rotation = ((overlay.rotation ?? 0) - 5 + 360) % 360; break;
      case ']': overlay.rotation = ((overlay.rotation ?? 0) + 5) % 360; break;
      case 'Delete': case 'Backspace': {
        const index = state.overlays.findIndex((o) => o.id === overlay.id);
        if (index >= 0) state.overlays.splice(index, 1);
        state.selectedId = null;
        break;
      }
      default: handled = false;
    }
    if (handled) {
      event.preventDefault();
      onChange('keyboard');
    }
  });
}
