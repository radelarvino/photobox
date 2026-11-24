/** Pembantu DOM kecil: query, elemen, ikon, toast, dialog, dan busy overlay. */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

let toastTimer = null;
export function toast(message, tone = 'info') {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('is-error', tone === 'error');
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 3600);
}

export function setBusy(active, text = 'Menyiapkan…') {
  const node = $('#busy');
  $('#busy-text').textContent = text;
  node.hidden = !active;
}

export async function withBusy(text, task) {
  setBusy(true, text);
  // Beri satu frame agar overlay sempat tergambar sebelum pekerjaan berat.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await task();
  } finally {
    setBusy(false);
  }
}

export function announce(message) {
  $('#overlay-status').textContent = message;
}

/** Tutup semua dialog kecuali yang disebut. */
export function closeDialogs(except = null) {
  for (const dialog of $$('dialog[open]')) {
    if (dialog !== except) dialog.close();
  }
}
