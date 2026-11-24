/** Perilaku kiosk: layar penuh, tombol besar, keyboard, dan auto-reset idle. */
import { $, closeDialogs } from './dom.js';

export function initKiosk({ getIdleSeconds, onIdle, onKey }) {
  let idleTimer = null;

  function armIdle() {
    clearTimeout(idleTimer);
    const seconds = getIdleSeconds();
    idleTimer = setTimeout(() => onIdle(), seconds * 1000);
  }

  for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
    window.addEventListener(type, armIdle, { passive: true });
  }
  window.addEventListener('resize', armIdle);
  armIdle();

  $('#fullscreen-btn').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Beberapa browser/iframe menolak fullscreen; tetap lanjut tanpa fullscreen.
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDialogs();
      return;
    }
    onKey?.(event);
  });

  // Jangan biarkan hitung mundur berjalan diam-diam saat tab tidak aktif.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(idleTimer);
    else armIdle();
  });

  return { armIdle, reset: armIdle };
}
