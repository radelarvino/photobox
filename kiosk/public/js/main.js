/** Photobox kiosk — seluruh foto diproses di browser, tanpa upload. */
import { $, $$, el, icon, toast, withBusy, announce } from './dom.js';
import { loadSettings, saveSettings, applyTheme } from './config.js';
import { LAYOUTS, layoutById, tilesFor, printSizeForLayout, PRINT_SIZES } from './layouts.js';
import { FILTERS, filterById } from './filters.js';
import { FRAMES, frameById } from './frames.js';
import { STICKERS, stickerIcon } from './stickers.js';
import { Camera } from './camera.js';
import { renderSheet, renderFrameThumb, TEXT_COLORS } from './render.js';
import { drawCover, canvasToBlob, downloadBlob } from './image.js';
import { attachOverlayControls } from './overlays.js';
import { sessionGallery, renderGallery } from './gallery.js';
import { downloadSheet, printSheet, makeGif, drawQr, downloadSmall } from './export.js';
import { bindAdmin } from './admin.js';
import { initKiosk } from './kiosk.js';

const SCREENS = ['start', 'setup', 'capture', 'result', 'gallery'];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = {
  settings: loadSettings(),
  screen: 'start',
  layout: layoutById(loadSettings().layoutId),
  frameId: loadSettings().frameId,
  filterId: loadSettings().filterId,
  shots: [],
  activePose: 0,
  counting: false,
  countToken: 0,
  text: { nama: '', tanggal: '', kutipan: '' },
  overlays: [],
  selectedOverlayId: null,
  geo: null,
  logo: null,
  fullCanvas: null,
  previewCanvas: $('#preview-canvas'),
  printSizeId: '4x6',
  galleryItem: null,
  smallDataUrl: '',
  busy: false,
};

const camera = new Camera($('#camera-video'));
const kiosk = initKiosk({
  getIdleSeconds: () => state.settings.idleSeconds,
  onIdle: () => {
    if (state.screen === 'start' && !sessionGallery.count) return;
    resetSession();
    toast('Sesi direset otomatis karena tidak ada aktivitas.');
  },
  onKey: (event) => {
    const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
    if (event.code === 'Space' && state.screen === 'capture' && !typing && !state.counting && !state.busy) {
      event.preventDefault();
      capturePhoto();
    }
  },
});

/* ============================ navigasi ============================ */

function go(screen) {
  if (!SCREENS.includes(screen)) return;
  state.screen = screen;
  for (const section of $$('.screen')) {
    const active = section.dataset.screen === screen;
    section.classList.toggle('is-active', active);
    section.hidden = !active;
  }
  $$('dialog[open]').forEach((dialog) => dialog.close());
  history.replaceState({ screen }, '', `#${screen}`);
  state.countToken += 1;

  if (screen === 'setup') buildSetup();
  if (screen === 'capture') startCamera();
  if (screen === 'result') renderResult();
  if (screen === 'gallery') renderGalleryPage();
  if (screen !== 'capture') camera.stop();
}

/* ============================ pengaturan awal ============================ */

function syncTextFromSettings() {
  state.text = {
    nama: state.settings.eventName,
    tanggal: state.settings.eventDate,
    kutipan: state.settings.quote,
  };
}

function loadLogo() {
  const url = state.settings.logoDataUrl;
  if (!url) {
    state.logo = null;
    return;
  }
  const image = new Image();
  image.onload = () => { state.logo = image; if (state.screen === 'result') renderResult(); };
  image.src = url;
}

function buildSetup() {
  const layoutBox = $('#layout-options');
  layoutBox.replaceChildren();
  for (const layout of LAYOUTS) {
    const card = el('button', 'option-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(layout.id === state.layout.id));
    const figure = el('span', `option-figure ${layout.figure}`);
    for (let i = 0; i < layout.poses; i += 1) figure.append(el('i'));
    card.append(figure, el('strong', null, layout.nama), el('small', null, layout.detail));
    card.addEventListener('click', () => {
      state.layout = layout;
      state.settings.layoutId = layout.id;
      state.shots = new Array(layout.poses).fill(null);
      buildSetup();
    });
    layoutBox.append(card);
  }

  const frameBox = $('#frame-options');
  frameBox.replaceChildren();
  for (const frame of FRAMES) {
    const card = el('button', 'frame-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(frame.id === state.frameId));
    const canvas = el('canvas');
    canvas.width = 300; canvas.height = 400;
    renderFrameThumb(canvas, frame.id, state.settings);
    card.append(canvas, el('span', null, frame.nama), el('small', null, frame.deskripsi));
    card.addEventListener('click', () => {
      state.frameId = frame.id;
      state.settings.frameId = frame.id;
      buildSetup();
    });
    frameBox.append(card);
  }

  const filterBox = $('#filter-options');
  filterBox.replaceChildren();
  for (const filter of FILTERS) {
    const chip = el('button', 'filter-chip', filter.nama);
    chip.type = 'button';
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(filter.id === state.filterId));
    chip.addEventListener('click', () => {
      state.filterId = filter.id;
      state.settings.filterId = filter.id;
      buildSetup();
    });
    filterBox.append(chip);
  }

  $('#field-name').value = state.text.nama;
  $('#field-date').value = state.text.tanggal;
  $('#field-quote').value = state.text.kutipan;
  $('#filter-name').textContent = filterById(state.filterId).nama;
  $('#setup-summary').textContent = `${state.settings.shots} foto · ${state.layout.nama}`;
}

function readTextFields() {
  state.text.nama = $('#field-name').value.trim().slice(0, 28);
  state.text.tanggal = $('#field-date').value.trim().slice(0, 24);
  state.text.kutipan = $('#field-quote').value.trim().slice(0, 48);
  state.settings = {
    ...state.settings,
    eventName: state.text.nama || 'Malam Ini',
    eventDate: state.text.tanggal,
    quote: state.text.kutipan,
    layoutId: state.layout.id,
    frameId: state.frameId,
    filterId: state.filterId,
  };
  saveSettings(state.settings);
}

/* ============================ kamera & jepret ============================ */

async function startCamera() {
  const viewport = $('#camera-viewport');
  const placeholder = $('#camera-placeholder');
  const alertBox = $('#camera-alert');
  placeholder.hidden = false;
  $('#camera-placeholder-text').textContent = 'Menyiapkan kamera…';
  alertBox.hidden = true;
  updateCameraHeader();

  try {
    await camera.start();
    viewport.style.setProperty('--mirror', camera.mirror ? '-1' : '1');
    $('#camera-status').textContent = camera.mirror ? 'kamera depan · tercermin' : 'kamera belakang';
    placeholder.hidden = true;
    $('#shutter').disabled = false;
  } catch (error) {
    $('#camera-alert-title').textContent = 'Kamera tidak bisa dibuka';
    $('#camera-alert-text').textContent = error.message;
    $('#camera-status').textContent = 'mode unggah foto';
    alertBox.hidden = false;
    viewport.style.setProperty('--mirror', '1');
    $('#shutter').disabled = true;
  }
}

function updateCameraHeader() {
  const filled = state.shots.filter(Boolean).length;
  $('#pose-count').textContent = `${filled} / ${state.layout.poses}`;
  $('#shot-progress').textContent = `${filled} / ${state.layout.poses}`;
  $('#capture-title').textContent = `Pose ${Math.min(filled + 1, state.layout.poses)} dari ${state.layout.poses}`;
  $('#to-result').disabled = filled < state.layout.poses;
  renderShots();
}

function renderShots() {
  const list = $('#shot-list');
  list.replaceChildren();
  for (let i = 0; i < state.layout.poses; i += 1) {
    const item = el('button', `shot-item${state.shots[i] ? ' is-active' : ' is-empty'}`);
    item.type = 'button';
    item.dataset.label = String(i + 1);
    item.setAttribute('aria-label', state.shots[i] ? `Ulangi foto ${i + 1}` : `Ambil foto ${i + 1}`);
    if (state.shots[i]) {
      const preview = document.createElement('canvas');
      preview.width = state.shots[i].width;
      preview.height = state.shots[i].height;
      preview.getContext('2d').drawImage(state.shots[i], 0, 0);
      item.append(preview, el('span', 'retake', 'ulang'));
    }
    item.addEventListener('click', () => capturePhoto(i));
    list.append(item);
  }
}

async function countdown(seconds) {
  const token = ++state.countToken;
  const node = $('#countdown');
  const number = node.querySelector('span');
  node.hidden = false;
  for (let i = seconds; i > 0; i -= 1) {
    number.textContent = String(i);
    number.style.animation = 'none';
    void number.offsetWidth;
    number.style.animation = '';
    await wait(1000);
    if (token !== state.countToken) {
      node.hidden = true;
      return false;
    }
  }
  node.hidden = true;
  return true;
}

async function capturePhoto(target = null) {
  if (state.counting || state.busy) return;
  let index = target;
  if (index === null) index = state.shots.findIndex((shot) => !shot);
  if (index === undefined || index < 0 || index >= state.layout.poses) return;
  if (!camera.active) {
    toast('Kamera belum siap. Izinkan kamera atau unggah foto.');
    return;
  }

  state.counting = true;
  $('#shutter').disabled = true;
  state.activePose = index;
  const ok = await countdown(state.settings.countdown);
  state.counting = false;
  if (!ok) {
    $('#shutter').disabled = !camera.active;
    return;
  }

  const tile = tilesFor(state.layout).tiles[index];
  const filter = filterById(state.filterId);
  state.shots[index] = camera.capture(tile.w, tile.h, filter.css);

  const flash = $('#flash');
  flash.classList.remove('is-on');
  void flash.offsetWidth;
  flash.classList.add('is-on');
  announce(`Foto ${index + 1} tersimpan.`);
  updateCameraHeader();
  $('#shutter').disabled = !state.shots.some((shot) => !shot) || !camera.active;
  if (state.shots.every(Boolean)) $('#to-result').disabled = false;
}

async function handleUpload(files) {
  if (!files?.length) return;
  const tile = tilesFor(state.layout).tiles[0];
  let index = state.shots.findIndex((shot) => !shot);
  for (const file of files) {
    if (index < 0 || index >= state.layout.poses) break;
    if (!file.type.startsWith('image/')) continue;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = tile.w; canvas.height = tile.h;
      drawCover(canvas.getContext('2d'), bitmap, 0, 0, tile.w, tile.h);
      bitmap.close?.();
      state.shots[index] = canvas;
      index = state.shots.findIndex((shot) => !shot);
    } catch {
      toast('Salah satu berkas gagal dibaca.', 'error');
    }
  }
  updateCameraHeader();
  if (state.shots.every(Boolean)) $('#to-result').disabled = false;
}

/* ============================ hasil & hiasan ============================ */

const previewScale = () => Math.min(1, 760 / Math.max(state.layout.size.width, state.layout.size.height));

function renderResult() {
  if (state.shots.some((shot) => !shot)) {
    toast('Lengkapi semua pose dulu ya.', 'error');
    go('capture');
    return;
  }
  // Hiasan bisa berubah kapan saja, jadi cache lembar penuh harus dibuang.
  invalidateSheet();
  const result = renderSheet({
    canvas: state.previewCanvas,
    layout: state.layout,
    frameId: state.frameId,
    filterId: state.filterId,
    shots: state.shots,
    overlays: state.overlays,
    settings: state.settings,
    text: state.text,
    scale: previewScale(),
    selectedOverlayId: state.selectedOverlayId,
    logo: state.logo,
  });
  state.geo = result.geo;
  $('#result-caption').textContent =
    `${state.layout.nama} · ${frameById(state.frameId).nama} · ${filterById(state.filterId).nama} · 300 DPI`;
  $('#result-tag').textContent = `${state.layout.size.width} × ${state.layout.size.height}`;
  syncOverlayUI();
}

function fullSheet() {
  return renderSheet({
    canvas: document.createElement('canvas'),
    layout: state.layout,
    frameId: state.frameId,
    filterId: state.filterId,
    shots: state.shots,
    overlays: state.overlays,
    settings: state.settings,
    text: state.text,
    scale: 1,
    logo: state.logo,
  }).canvas;
}

function syncOverlayUI() {
  const count = state.overlays.length;
  $('#overlay-count').textContent = count ? `${count} hiasan` : 'Belum ada';
  const selected = state.overlays.find((overlay) => overlay.id === state.selectedOverlayId);
  $('#overlay-tools').hidden = !selected;
  if (selected) {
    $('#overlay-size').value = String(Math.round(selected.size * 100));
    $('#overlay-size-value').textContent = `${Math.round(selected.size * 100)}%`;
  }
}

function addOverlay(overlay) {
  if (state.overlays.length >= 12) {
    toast('Maksimal 12 hiasan per foto.');
    return;
  }
  state.overlays.push(overlay);
  state.selectedOverlayId = overlay.id;
  renderResult();
  announce('Hiasan ditambahkan.');
}

function addText(text) {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!clean) {
    toast('Tulis teks dulu ya.');
    return;
  }
  addOverlay({
    id: `hiasan-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    type: 'text', text: clean, color: 'ink',
    x: 0.5, y: 0.5, size: 0.08, rotation: 0,
  });
}

attachOverlayControls(state.previewCanvas, () => state, () => renderResult());

/* ============================ ekspor ============================ */

async function currentCanvas() {
  if (state.fullCanvas) return state.fullCanvas;
  state.fullCanvas = fullSheet();
  return state.fullCanvas;
}

function invalidateSheet() {
  state.fullCanvas = null;
  state.smallDataUrl = '';
}

async function exportImage(format) {
  await withBusy('Menyiapkan berkas 300 DPI…', async () => {
    const canvas = await currentCanvas();
    await downloadSheet(canvas, state.layout.id, format);
  });
  toast(format === 'jpg' ? 'JPG siap diunduh.' : 'PNG siap diunduh.', 'success');
}

function renderPrintOptions() {
  const box = $('#print-options');
  box.replaceChildren();
  for (const paper of PRINT_SIZES) {
    const button = el('button', 'print-option');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(paper.id === state.printSizeId));
    button.append(el('strong', null, paper.nama), el('small', null, paper.detail));
    button.addEventListener('click', () => {
      state.printSizeId = paper.id;
      renderPrintOptions();
    });
    box.append(button);
  }
}

async function openPrint() {
  state.printSizeId = printSizeForLayout(state.layout).id;
  renderPrintOptions();
  $('#print-dialog').showModal();
}

$('#print-go').addEventListener('click', async () => {
  const paper = PRINT_SIZES.find((p) => p.id === state.printSizeId) ?? PRINT_SIZES[0];
  await withBusy('Menyiapkan cetakan…', async () => {
    printSheet(await currentCanvas(), paper);
  });
  $('#print-dialog').close();
  toast('Dialog cetak dibuka. Pilih printer dan ukuran kertas yang sesuai.');
});

async function openQr() {
  await withBusy('Membuat QR…', async () => {
    const canvas = await currentCanvas();
    state.smallDataUrl = drawQr($('#qr-canvas'), canvas);
  });
  $('#qr-dialog').showModal();
}

$('#qr-download').addEventListener('click', () => {
  downloadSmall(state.fullCanvas ?? fullSheet());
  toast('Versi kecil diunduh.', 'success');
});

async function exportGif() {
  await withBusy('Membuat GIF…', async () => {
    const blob = makeGif(state.shots, filterById(state.filterId).css);
    downloadBlob(blob, `photobox-${state.layout.id}-${stamp()}.gif`);
  });
  toast('GIF siap diunduh.', 'success');
}

const stamp = () => new Date().toISOString().slice(0, 10);

/* ============================ galeri ============================ */

function renderGalleryPage() {
  const grid = $('#gallery-grid');
  renderGallery(grid, openGalleryItem, (id) => {
    sessionGallery.remove(id);
    renderGalleryPage();
    toast('Foto dihapus dari sesi.');
  });
  $('#gallery-empty').hidden = sessionGallery.count > 0;
  $('#gallery-count').textContent = String(sessionGallery.count);
  $('#gallery-count').hidden = sessionGallery.count === 0;
}

async function saveSession() {
  await withBusy('Menyimpan ke galeri sesi…', async () => {
    const canvas = fullSheet();
    const preview = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
    preview.width = Math.round(canvas.width * scale);
    preview.height = Math.round(canvas.height * scale);
    preview.getContext('2d').drawImage(canvas, 0, 0, preview.width, preview.height);
    sessionGallery.add({
      preview: preview.toDataURL('image/jpeg', 0.84),
      full: canvas.toDataURL('image/jpeg', 0.92),
      layoutNama: state.layout.nama,
      frameNama: frameById(state.frameId).nama,
    });
  });
  renderGalleryPage();
  toast('Masuk galeri sesi. Foto ini tidak dikirim ke server.', 'success');
}

async function imageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar tidak bisa dibaca.'));
    image.src = url;
  });
}

async function canvasFromItem(item) {
  const image = await imageFromDataUrl(item.full);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas;
}

async function openGalleryItem(item) {
  state.galleryItem = item;
  $('#item-title').textContent = `${item.layoutNama} · ${item.frameNama}`;
  $('#item-img').src = item.full;
  $('#item-dialog').showModal();
}

$('#item-download').addEventListener('click', async () => {
  const item = state.galleryItem;
  if (!item) return;
  await withBusy('Menyiapkan unduhan…', async () => {
    await downloadSheet(await canvasFromItem(item), 'galeri', 'png');
  });
  toast('Foto diunduh.', 'success');
});

$('#item-print').addEventListener('click', async () => {
  const item = state.galleryItem;
  if (!item) return;
  state.printSizeId = printSizeForLayout(layoutById(state.layout.id)).id;
  renderPrintOptions();
  $('#item-dialog').close();
  await withBusy('Menyiapkan cetakan…', async () => {
    printSheet(await canvasFromItem(item), PRINT_SIZES.find((p) => p.id === state.printSizeId));
  });
  toast('Dialog cetak dibuka.');
});

function resetSession() {
  camera.stop();
  state.countToken += 1;
  state.shots = new Array(state.layout.poses).fill(null);
  state.overlays = [];
  state.selectedOverlayId = null;
  state.fullCanvas = null;
  state.smallDataUrl = '';
  state.activePose = 0;
  state.galleryItem = null;
  sessionGallery.clear();
  renderGalleryPage();
  updateCameraHeader();
  go('start');
}

/* ============================ ikatan tombol ============================ */

function bindEvents() {
  for (const button of $$('[data-go]')) {
    button.addEventListener('click', () => go(button.dataset.go));
  }

  $('#start-btn').addEventListener('click', () => {
    readTextFields();
    state.layout = layoutById(state.settings.layoutId);
    state.shots = new Array(state.layout.poses).fill(null);
    state.overlays = [];
    state.selectedOverlayId = null;
    syncTextFromSettings();
    renderShots();
    go('setup');
  });

  $('#to-capture').addEventListener('click', () => {
    readTextFields();
    state.shots = new Array(state.layout.poses).fill(null);
    state.overlays = [];
    state.selectedOverlayId = null;
    updateCameraHeader();
    go('capture');
  });

  $('#gallery-btn').addEventListener('click', () => go('gallery'));
  $('#reset-session').addEventListener('click', () => {
    if (!window.confirm('Reset sesi? Semua foto di galeri akan hilang.')) return;
    resetSession();
    toast('Sesi direset.');
  });

  $('#flip-btn').addEventListener('click', async () => {
    try {
      await camera.flip();
      $('#camera-viewport').style.setProperty('--mirror', camera.mirror ? '-1' : '1');
      $('#camera-status').textContent = camera.mirror ? 'kamera depan · tercermin' : 'kamera belakang';
    } catch (error) {
      toast(error.message, 'error');
    }
  });
  $('#camera-retry').addEventListener('click', startCamera);
  $('#upload-input').addEventListener('change', async (event) => {
    await handleUpload([...event.target.files]);
    event.target.value = '';
  });

  $('#shutter').addEventListener('click', () => capturePhoto());
  $('#retake-all').addEventListener('click', () => {
    state.shots = new Array(state.layout.poses).fill(null);
    state.overlays = [];
    updateCameraHeader();
    toast('Semua foto diulang.');
  });
  $('#to-result').addEventListener('click', () => go('result'));

  $('#sticker-options').replaceChildren();
  for (const sticker of STICKERS) {
    const button = el('button', 'sticker-btn');
    button.type = 'button';
    button.title = sticker.nama;
    button.setAttribute('aria-label', `Tambah stiker ${sticker.nama}`);
    button.append(stickerIcon(sticker));
    button.addEventListener('click', () => {
      addOverlay({
        id: `hiasan-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'sticker', stickerId: sticker.id, color: 'accent',
        x: 0.5, y: 0.5, size: 0.14, rotation: 0,
      });
    });
    $('#sticker-options').append(button);
  }

  $('#text-form').addEventListener('submit', (event) => {
    event.preventDefault();
    addText($('#text-input').value);
    $('#text-input').value = '';
  });
  $('#overlay-size').addEventListener('input', (event) => {
    const selected = state.overlays.find((overlay) => overlay.id === state.selectedOverlayId);
    if (!selected) return;
    selected.size = Number(event.target.value) / 100;
    $('#overlay-size-value').textContent = `${event.target.value}%`;
    invalidateSheet();
    renderResult();
  });
  $('#rotate-left').addEventListener('click', () => rotateSelected(-15));
  $('#rotate-right').addEventListener('click', () => rotateSelected(15));
  $('#delete-overlay').addEventListener('click', () => {
    const index = state.overlays.findIndex((overlay) => overlay.id === state.selectedOverlayId);
    if (index >= 0) state.overlays.splice(index, 1);
    state.selectedOverlayId = null;
    invalidateSheet();
    renderResult();
  });

  $('#download-png').addEventListener('click', () => exportImage('png'));
  $('#download-jpg').addEventListener('click', () => exportImage('jpg'));
  $('#print-btn').addEventListener('click', openPrint);
  $('#qr-btn').addEventListener('click', openQr);
  $('#gif-btn').addEventListener('click', exportGif);
  $('#save-session').addEventListener('click', saveSession);
  $('#new-session').addEventListener('click', () => {
    state.shots = new Array(state.layout.poses).fill(null);
    state.overlays = [];
    state.selectedOverlayId = null;
    invalidateSheet();
    go('capture');
  });

  bindAdmin(() => state.settings, (next) => {
    state.settings = next;
    applyTheme(next);
    loadLogo();
    state.layout = layoutById(next.layoutId);
    state.frameId = next.frameId;
    state.filterId = next.filterId;
    syncTextFromSettings();
    resetSession();
  });

  void kiosk;
  void TEXT_COLORS;
  void el; void icon;
}

/* ============================ awal ============================ */

function rotateSelected(delta) {
  const selected = state.overlays.find((overlay) => overlay.id === state.selectedOverlayId);
  if (!selected) return;
  selected.rotation = ((selected.rotation ?? 0) + delta + 360) % 360;
  invalidateSheet();
  renderResult();
}

applyTheme(state.settings);
syncTextFromSettings();
state.layout = layoutById(state.settings.layoutId);
state.frameId = state.settings.frameId;
state.filterId = state.settings.filterId;
state.shots = new Array(state.layout.poses).fill(null);
loadLogo();
bindEvents();
renderGalleryPage();
updateCameraHeader();
go('start');
