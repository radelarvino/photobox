/** Pengaturan acara. Disimpan di localStorage; foto tidak pernah disimpan di sini. */
const KEY = 'photobox-kiosk.settings.v1';

export const DEFAULTS = Object.freeze({
  pin: '2468',
  shots: 4,
  countdown: 3,
  eventName: 'Malam Ini',
  eventDate: '',
  quote: '',
  accent: '#c1442b',
  frameAccent: '#a9885b',
  idleSeconds: 60,
  logoDataUrl: '',
  frameId: 'ivory-letterpress',
  layoutId: 'strip-2x6',
  filterId: 'normal',
});

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Baca pengaturan; nilai rusak diabaikan satu per satu. */
export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  return {
    pin: String(saved.pin ?? DEFAULTS.pin).slice(0, 8) || DEFAULTS.pin,
    shots: clampInt(saved.shots, 1, 6, DEFAULTS.shots),
    countdown: clampInt(saved.countdown, 1, 9, DEFAULTS.countdown),
    eventName: String(saved.eventName ?? DEFAULTS.eventName).slice(0, 28),
    eventDate: String(saved.eventDate ?? DEFAULTS.eventDate).slice(0, 24),
    quote: String(saved.quote ?? DEFAULTS.quote).slice(0, 48),
    accent: /^#[0-9a-f]{6}$/i.test(saved.accent ?? '') ? saved.accent : DEFAULTS.accent,
    frameAccent: /^#[0-9a-f]{6}$/i.test(saved.frameAccent ?? '') ? saved.frameAccent : DEFAULTS.frameAccent,
    idleSeconds: clampInt(saved.idleSeconds, 15, 600, DEFAULTS.idleSeconds),
    logoDataUrl: typeof saved.logoDataUrl === 'string' ? saved.logoDataUrl : '',
    frameId: typeof saved.frameId === 'string' ? saved.frameId : DEFAULTS.frameId,
    layoutId: typeof saved.layoutId === 'string' ? saved.layoutId : DEFAULTS.layoutId,
    filterId: typeof saved.filterId === 'string' ? saved.filterId : DEFAULTS.filterId,
  };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Terapkan warna ke CSS variable supaya seluruh UI ikut berubah. */
export function applyTheme(settings) {
  document.documentElement.style.setProperty('--accent', settings.accent);
  document.documentElement.style.setProperty('--frame-accent', settings.frameAccent);
}
