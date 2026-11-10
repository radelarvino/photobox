import { api, getSessionId } from './api.js';
import { Camera, describeCameraError } from './camera.js';
import { Sound } from './audio.js';
import { renderMultiSheet, renderFromSaved, renderBorderThumb } from './render.js';
import { modesFor, modeFor } from './multi.js';
import { STICKERS, TEXT_COLORS, drawSticker, hitTestOverlay, stickerById } from './overlays.js';
import {
  buildExport,
  canvasToBlob,
  downloadBlob,
  makeThumbnail,
  imageBlobWithDpi,
  fileName,
} from './export.js';

/* ============================== util ============================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENS = ['home', 'setup', 'camera', 'result', 'gallery'];
const DEFAULT_PAPER = '4r';
const DEFAULT_BORDER = 'polaroid';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function thumbDataUrl(canvas, max = 420) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(canvas.width * scale));
  thumb.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = thumb.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL('image/jpeg', 0.74);
}

const formatDate = (iso) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));

/* ============================== state ============================== */

const state = {
  screen: 'home',
  catalog: null,
  paper: null,
  poseCount: 4,
  border: null,
  filter: null,
  intensity: 1,
  shots: [],
  retakeIndex: null,
  cameraReady: false,
  cameraStarting: false,
  facing: 'user',
  counting: false,
  countToken: 0,
  savedPhoto: null,
  photos: [],
  busy: false,
  editBase: null,
  carouselPromise: null,
  overlays: [],
  selectedOverlayId: null,
  overlaySeq: 0,
  textColor: 'putih',
  drag: null,
  previewLayout: null,
  previewTiles: [],
  activeTile: 0,
  multiId: 'single',
};

const sound = new Sound();
const camera = new Camera($('#camera-video'));

let toastTimer = null;
let galleryUrls = [];
let previewFrame = null;
let lightboxPhoto = null;
let lightboxUrl = null;
let lightboxBlob = null;
let lightboxDecorated = null;

const el = {
  screens: $$('.screen'),
  curtain: $('#curtain'),
  mascot: $('#home-mascot'),
  speech: $('#home-speech'),

  soundToggle: $('#sound-toggle'),
  galleryCount: $('#gallery-count'),

  paperOptions: $('#paper-options'),
  poseOptions: $('#pose-options'),
  poseHint: $('#pose-hint'),
  multiBlock: $('#multi-block'),
  multiOptions: $('#multi-options'),
  multiHint: $('#multi-hint'),
  borderCarousel: $('#border-carousel'),
  borderCount: $('#border-count'),
  selectionSummary: $('#selection-summary'),
  cameraPill: $('#camera-pill'),
  cameraPillText: $('#camera-pill-text'),

  video: $('#camera-video'),
  placeholder: $('#camera-placeholder'),
  countdown: $('#countdown'),
  countdownNumber: $('#countdown span'),
  flash: $('#flash'),
  mirrorBadge: $('#mirror-badge'),
  cameraName: $('#camera-name'),
  cameraTitle: $('#camera-title'),
  poseChip: $('#pose-chip'),
  cameraAlert: $('#camera-alert'),
  cameraAlertTitle: $('#camera-alert-title'),
  cameraAlertText: $('#camera-alert-text'),
  cameraStage: $('.camera-stage'),
  boothLights: $('#booth-lights'),
  shutter: $('#shutter'),
  shotList: $('#shot-list'),
  shotProgress: $('#shot-progress'),
  shotHint: $('#shot-hint'),
  toResult: $('#to-result'),
  uploadInput: $('#upload-input'),

  previewCanvas: $('#preview-canvas'),
  resultMeta: $('#result-meta'),
  resultBack: $('#result-back'),
  resultPaper: $('#result-paper'),
  filterCard: $('#filter-card'),
  editNote: $('#edit-note'),
  filterRow: $('#filter-row'),
  filterName: $('#filter-name'),
  intensity: $('#intensity'),
  intensityValue: $('#intensity-value'),
  dpiChip: $('#dpi-chip'),
  saveBtn: $('#save-btn'),
  saveStatus: $('#save-status'),

  overlayForm: $('#overlay-form'),
  overlayText: $('#overlay-text'),
  addText: $('#add-text'),
  textColors: $('#text-colors'),
  stickerGrid: $('#sticker-grid'),
  overlayList: $('#overlay-list'),
  overlayTools: $('#overlay-tools'),
  overlaySelected: $('#overlay-selected'),
  overlaySize: $('#overlay-size'),
  overlaySizeValue: $('#overlay-size-value'),
  rotateLeft: $('#rotate-left'),
  rotateRight: $('#rotate-right'),
  deleteOverlay: $('#delete-overlay'),
  overlayCount: $('#overlay-count'),
  overlayStatus: $('#overlay-status'),
  decorateHint: $('#decorate-hint'),

  galleryGrid: $('#gallery-grid'),
  galleryEmpty: $('#gallery-empty'),
  lightbox: $('#lightbox'),
  lightboxImg: $('#lightbox-img'),
  lightboxTitle: $('#lightbox-title'),
  lightboxSub: $('#lightbox-sub'),
  lightboxEdit: $('#lightbox-edit'),
  lightboxDownload: $('#lightbox-download'),
  lightboxDelete: $('#lightbox-delete'),
  privacy: $('#privacy-dialog'),

  toast: $('#toast'),
  busy: $('#busy'),
  busyText: $('#busy-text'),
};

/* ============================== umpan balik ============================== */

function toast(message, tone = 'info') {
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), 3400);
}

function setBusy(value, text = 'Menyiapkan file…') {
  state.busy = value;
  el.busy.hidden = !value;
  el.busyText.textContent = text;
}

async function withBusy(text, task) {
  setBusy(true, text);
  // Beri satu bingkai agar overlay sempat tergambar sebelum render berat.
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 20)));
  try {
    return await task();
  } finally {
    setBusy(false);
  }
}

function setPill(status, text) {
  el.cameraPill.dataset.state = status;
  el.cameraPillText.textContent = text;
}

/* ============================== navigasi ============================== */

function go(screen, { push = true } = {}) {
  if (!SCREENS.includes(screen)) screen = 'home';
  if (state.screen === 'camera' && screen !== 'camera') {
    state.countToken += 1;
    stopCamera();
  }

  for (const section of el.screens) {
    const active = section.dataset.screen === screen;
    section.classList.toggle('is-active', active);
    section.hidden = !active;
  }
  state.screen = screen;

  if (push) history.pushState({ screen }, '', `#${screen}`);
  window.scrollTo({ top: 0 });

  // Pindahkan fokus ke judul layar agar pembaca layar tahu konteksnya.
  const heading = document.querySelector(`#screen-${screen} h1, #screen-${screen} h2`);
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  if (screen === 'camera') enterCamera();
  if (screen === 'result') prepareResult();
  if (screen === 'gallery') loadGallery();
  if (screen === 'setup') {
    updateSummary();
    ensureBorderCarousel();
  }
}

function stopCamera() {
  state.cameraReady = false;
  camera.stop();
  el.video.classList.add('is-hidden');
}

/* ============================== pengaturan ============================== */

function renderPaperOptions() {
  el.paperOptions.replaceChildren();
  for (const paper of state.catalog.paperSizes) {
    const card = element('button', 'paper-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.dataset.id = paper.id;
    card.setAttribute('aria-checked', String(state.paper?.id === paper.id));

    const height = 42;
    const width = Math.max(16, Math.round(height * (paper.lebarMm / paper.tinggiMm)));
    const sheet = element('span', 'paper-sheet');
    sheet.style.setProperty('--w', width);
    sheet.style.setProperty('--h', height);

    const dimension = (paper.deskripsi ?? '').split('·')[0].trim();
    card.append(
      sheet,
      element('span', 'paper-name', paper.nama),
      element('span', 'paper-dim', dimension),
      element('span', 'paper-px', `${paper.lebarPx} × ${paper.tinggiPx} px`),
    );
    card.addEventListener('click', () => selectPaper(paper));
    el.paperOptions.append(card);
  }
}

/* ------------------------------ multi-cetak ------------------------------ */

function modes() {
  return modesFor(state.paper?.id);
}

function currentMode() {
  return modeFor(state.paper?.id, state.multiId);
}

function designPaper() {
  return paperById(currentMode().designId) ?? state.paper;
}

function renderMultiOptions() {
  const list = modes();
  el.multiBlock.hidden = list.length <= 1;
  el.multiOptions.replaceChildren();
  if (list.length <= 1) {
    refreshSetupSteps();
    return;
  }

  for (const mode of list) {
    const card = element('button', 'multi-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.dataset.id = mode.id;
    card.setAttribute('aria-checked', String(mode.id === state.multiId));
    card.setAttribute('aria-label', `${mode.nama}. ${mode.detail}`);
    card.append(
      element('strong', null, mode.nama),
      element('small', null, mode.detail),
    );
    card.addEventListener('click', () => selectMulti(mode));
    el.multiOptions.append(card);
  }

  const active = currentMode();
  el.multiHint.textContent = active.copies > 1
    ? 'Setiap salinan identik. Hiasan, filter, dan border berlaku untuk semuanya.'
    : 'Pilih beberapa salinan agar satu lembar kertas bisa dipotong menjadi beberapa foto.';
  refreshSetupSteps();
}

/** Nomor langkah mengikuti kartu yang terlihat, agar tidak melompat. */
function refreshSetupSteps() {
  const cards = $$('.setup-grid > .card').filter((card) => !card.hidden);
  cards.forEach((card, index) => {
    const num = card.querySelector('.num');
    if (num) num.textContent = String(index + 1);
  });
}

function selectMulti(mode) {
  if (mode.id === state.multiId) return;
  state.multiId = mode.id;
  state.activeTile = 0;
  const design = designPaper();
  state.poseCount = Math.min(design.posesMax, Math.max(design.posesMin, state.poseCount));
  renderPoseOptions();
  renderMultiOptions();
  updateSummary();
  updateDecorateHint();
  sound.click();
}

function renderPoseOptions() {
  el.poseOptions.replaceChildren();
  const paper = designPaper();
  for (let count = 1; count <= 4; count += 1) {
    const disabled = count < paper.posesMin || count > paper.posesMax;
    const card = element('button', 'pose-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.disabled = disabled;
    card.dataset.n = String(count);
    card.setAttribute('aria-checked', String(count === state.poseCount));
    card.setAttribute('aria-label', `${count} pose`);

    const preview = element('span', 'pose-preview');
    preview.dataset.n = String(count);
    for (let i = 0; i < count; i += 1) preview.append(element('span'));
    card.append(preview, element('span', null, `${count} pose`));
    card.addEventListener('click', () => selectPoseCount(count));
    el.poseOptions.append(card);
  }
  el.poseHint.textContent = paper.layout === 'strip'
    ? 'Strip 2×6 inci butuh 3–4 pose vertikal.'
    : 'Setiap pose punya hitung mundur 3 detik dan bisa diulang.';
}

async function renderBorderCarousel() {
  await document.fonts.ready;
  el.borderCarousel.replaceChildren();
  const paper = state.catalog.paperSizes.find((item) => item.id === DEFAULT_PAPER) ?? state.paper;

  for (const [index, border] of state.catalog.borders.entries()) {
    const card = element('button', 'border-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.dataset.id = border.id;
    card.setAttribute('aria-checked', String(state.border?.id === border.id));
    card.setAttribute('aria-label', `Border ${border.nama}`);

    const wrap = element('span', 'border-thumb');
    const canvas = document.createElement('canvas');
    wrap.append(canvas);

    const caption = element('span', 'border-name');
    caption.append(
      element('span', null, border.nama),
      element('span', 'border-cat', border.kategori),
    );

    card.append(wrap, caption);
    card.addEventListener('click', () => selectBorder(border));
    el.borderCarousel.append(card);

    renderBorderThumb(canvas, { paper, border, poseCount: 4 });

    if (index % 4 === 3) await wait(0);
  }

  el.borderCount.textContent = `${state.catalog.borders.length} border`;
}

/** Render carousel satu kali saja, saat layar pengaturan pertama dibuka. */
function ensureBorderCarousel() {
  if (!state.carouselPromise) state.carouselPromise = renderBorderCarousel();
  return state.carouselPromise;
}

function selectPaper(paper) {
  state.paper = paper;
  state.multiId = modesFor(paper.id)[0].id;
  state.activeTile = 0;
  const design = designPaper();
  if (state.poseCount < design.posesMin) state.poseCount = design.posesMin;
  if (state.poseCount > design.posesMax) state.poseCount = design.posesMax;
  resetShots();
  for (const card of $$('.paper-card', el.paperOptions)) {
    card.setAttribute('aria-checked', String(card.dataset.id === paper.id));
  }
  renderMultiOptions();
  renderPoseOptions();
  updateSummary();
  updateDecorateHint();
  sound.click();
}

function selectPoseCount(count) {
  state.poseCount = count;
  resetShots();
  for (const card of $$('.pose-card', el.poseOptions)) {
    card.setAttribute('aria-checked', String(Number(card.dataset.n) === count));
  }
  updateSummary();
  sound.click();
}

function selectBorder(border) {
  state.border = border;
  for (const card of $$('.border-card', el.borderCarousel)) {
    card.setAttribute('aria-checked', String(card.dataset.id === border.id));
  }
  updateSummary();
  sound.click();
}

function updateSummary() {
  if (!state.paper || !state.border) return;
  const mode = currentMode();
  const multi = mode.copies > 1 ? ` · ${mode.nama}` : '';
  el.selectionSummary.textContent =
    `${state.paper.nama}${multi} · ${state.poseCount} pose · ${state.border.nama}`;
}

function updateDecorateHint() {
  if (!el.decorateHint || !state.paper) return;
  el.decorateHint.textContent = currentMode().copies > 1
    ? 'Hiasan yang sama tampil di setiap salinan. Geser di pratinjau untuk mengatur.'
    : 'Tambahkan teks atau stiker, lalu geser langsung di pratinjau.';
}

/* ============================== kamera ============================== */

function resetShots() {
  state.shots = new Array(state.poseCount).fill(null);
  state.retakeIndex = null;
  state.savedPhoto = null;
  state.countToken += 1;
}

async function warmupCamera() {
  setPill('loading', 'Meminta izin kamera…');
  if (!navigator.mediaDevices?.getUserMedia) {
    setPill('error', 'Kamera tidak didukung');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    for (const track of stream.getTracks()) track.stop();
    setPill('ready', 'Kamera siap');
  } catch (error) {
    const info = describeCameraError(error);
    setPill('error', info.title);
  }
}

async function enterCamera() {
  renderShots();
  if (!camera.ready && !state.cameraStarting) await startCamera();
}

async function startCamera() {
  if (state.cameraStarting) return;
  state.cameraStarting = true;
  hideCameraAlert();
  showPlaceholder('Menyalakan kamera…');
  el.shutter.disabled = true;

  try {
    await camera.start({ facing: state.facing });
    if (!camera.ready) {
      throw Object.assign(new Error('Kamera belum mengirim gambar.'), { name: 'NotReadableError' });
    }
    state.facing = camera.facing;
    state.cameraReady = true;
    el.cameraName.textContent = camera.label || (camera.mirrored ? 'kamera depan' : 'kamera belakang');
    el.mirrorBadge.textContent = camera.mirrored ? 'kamera depan' : 'kamera belakang';
    hidePlaceholder();
    setPill('ready', 'Kamera siap');
  } catch (error) {
    state.cameraReady = false;
    const info = describeCameraError(error);
    showCameraAlert(info.title, info.message);
    setPill('error', info.title);
    sound.error();
  } finally {
    state.cameraStarting = false;
    updateCameraHeader();
  }
}

async function switchCamera() {
  if (!state.cameraReady) {
    await startCamera();
    return;
  }
  try {
    const label = await camera.switchCamera();
    state.facing = camera.facing;
    el.cameraName.textContent = label || 'kamera';
    el.mirrorBadge.textContent = camera.mirrored ? 'kamera depan' : 'kamera belakang';
    sound.click();
  } catch (error) {
    const info = describeCameraError(error);
    showCameraAlert(info.title, info.message);
    sound.error();
  }
}

function showPlaceholder(text) {
  el.placeholder.querySelector('p').textContent = text;
  el.placeholder.hidden = false;
  el.video.classList.add('is-hidden');
}

function hidePlaceholder() {
  el.placeholder.hidden = true;
  el.video.classList.remove('is-hidden');
}

function showCameraAlert(title, message) {
  el.cameraAlertTitle.textContent = title;
  el.cameraAlertText.textContent = message;
  el.cameraAlert.hidden = false;
  el.cameraStage.classList.add('has-alert');
  showPlaceholder('Kamera belum aktif');
}

function hideCameraAlert() {
  el.cameraAlert.hidden = true;
  el.cameraStage.classList.remove('has-alert');
}

function filledCount() {
  return state.shots.filter(Boolean).length;
}

function nextEmptyIndex() {
  return state.shots.findIndex((shot) => !shot);
}

function updateCameraHeader() {
  const filled = filledCount();
  el.poseChip.textContent = `${filled} / ${state.poseCount}`;
  el.shotProgress.textContent = `${filled} / ${state.poseCount}`;
  el.toResult.disabled = filled < state.poseCount;

  if (state.retakeIndex !== null) {
    el.cameraTitle.textContent = `Ulang pose ${state.retakeIndex + 1}`;
  } else if (filled >= state.poseCount) {
    el.cameraTitle.textContent = 'Semua pose siap';
  } else {
    el.cameraTitle.textContent = `Ambil pose ${nextEmptyIndex() + 1} dari ${state.poseCount}`;
  }

  el.shutter.disabled = !state.cameraReady || state.counting ||
    (filled >= state.poseCount && state.retakeIndex === null);
}

function renderShots() {
  el.shotList.replaceChildren();
  const next = nextEmptyIndex();
  for (let index = 0; index < state.poseCount; index += 1) {
    const shot = state.shots[index];
    const box = element('div', 'shot');

    if (shot) {
      const img = document.createElement('img');
      img.src = shot.url;
      img.alt = `Pose ${index + 1}`;
      const retake = element('button', 'shot-retake');
      retake.type = 'button';
      retake.append(icon('refresh'), element('span', null, 'Ulang'));
      retake.addEventListener('click', () => retakePose(index));
      box.append(img, retake);
    } else {
      box.classList.add('is-empty');
      box.append(element('span', null, String(index + 1)));
      if (index === next) box.classList.add('is-next');
    }

    el.shotList.append(box);
  }
  updateCameraHeader();
}

function retakePose(index) {
  state.shots[index] = null;
  state.retakeIndex = index;
  state.savedPhoto = null;
  renderShots();
  if (!camera.ready) startCamera();
  sound.click();
}

function animateCountdown(number) {
  el.countdown.hidden = false;
  el.countdownNumber.textContent = String(number);
  el.countdownNumber.style.animation = 'none';
  void el.countdownNumber.offsetWidth;
  el.countdownNumber.style.animation = '';
}

function endCountdown() {
  state.counting = false;
  el.countdown.hidden = true;
  el.boothLights.classList.remove('is-active');
  el.shutter.classList.remove('is-counting');
  el.flash.classList.remove('is-flashing');
  updateCameraHeader();
}

async function takePhoto() {
  if (state.counting || state.screen !== 'camera') return;
  if (filledCount() >= state.poseCount && state.retakeIndex === null) return;
  if (!state.cameraReady) {
    toast('Kamera belum siap. Unggah foto atau tekan coba lagi.', 'error');
    return;
  }

  state.counting = true;
  state.countToken += 1;
  const token = state.countToken;
  el.shutter.disabled = true;
  el.shutter.classList.add('is-counting');
  el.boothLights.classList.add('is-active');
  sound.unlock();

  for (let number = 3; number >= 1; number -= 1) {
    if (token !== state.countToken) {
      endCountdown();
      return;
    }
    animateCountdown(number);
    sound.beep(number === 1);
    await wait(880);
  }

  if (token !== state.countToken) {
    endCountdown();
    return;
  }

  el.countdown.hidden = true;
  el.flash.classList.add('is-flashing');
  sound.shutter();
  await wait(90);

  let captured;
  try {
    captured = camera.capture();
  } catch (error) {
    toast(error.message, 'error');
    endCountdown();
    return;
  }

  const index = state.retakeIndex ?? nextEmptyIndex();
  if (index < 0) {
    endCountdown();
    return;
  }

  state.shots[index] = { canvas: captured, url: thumbDataUrl(captured) };
  state.retakeIndex = null;
  state.savedPhoto = null;

  await wait(220);
  el.flash.classList.remove('is-flashing');
  renderShots();
  endCountdown();

  if (filledCount() >= state.poseCount) {
    sound.cheer();
    toast('Semua pose siap! Mengarahkan ke hasil…', 'success');
    await wait(650);
    if (state.screen === 'camera' && token === state.countToken) go('result');
  }
}

async function handleUpload(files) {
  const list = [...files];
  if (!list.length) return;

  const empty = state.shots
    .map((shot, index) => (shot ? null : index))
    .filter((index) => index !== null);

  if (!empty.length) {
    toast('Semua slot sudah terisi. Tekan “Ulang” pada pose yang ingin diganti.', 'error');
    return;
  }

  const chosen = list.slice(0, empty.length);
  let added = 0;
  for (const [offset, file] of chosen.entries()) {
    try {
      const canvas = await Camera.canvasFromFile(file);
      state.shots[empty[offset]] = { canvas, url: thumbDataUrl(canvas) };
      added += 1;
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  state.retakeIndex = null;
  state.savedPhoto = null;
  renderShots();

  if (added > 0) {
    toast(`${added} foto dimasukkan.`, 'success');
    sound.click();
  }
  if (filledCount() >= state.poseCount) {
    await wait(400);
    if (state.screen === 'camera') go('result');
  }
}

function resetAllShots() {
  resetShots();
  renderShots();
  state.savedPhoto = null;
  if (!camera.ready) startCamera();
  toast('Semua pose dikosongkan.', 'info');
  sound.click();
}

/* ============================== hasil ============================== */

function buildFilterRow() {
  const firstShot = state.shots.find(Boolean)?.canvas;
  el.filterRow.replaceChildren();

  for (const filter of state.catalog.filters) {
    const card = element('button', 'filter-card');
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.dataset.id = filter.id;
    card.setAttribute('aria-checked', String(state.filter?.id === filter.id));
    card.setAttribute('aria-label', `Filter ${filter.nama}`);

    const swatch = element('span', 'filter-swatch');
    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = 144;
    if (firstShot) {
      const size = Math.min(firstShot.width, firstShot.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        firstShot,
        (firstShot.width - size) / 2,
        (firstShot.height - size) / 2,
        size, size,
        0, 0, 144, 144,
      );
    }
    canvas.style.filter = filter.params.css;
    swatch.append(canvas);
    card.append(swatch, element('span', 'filter-label', filter.nama));
    card.addEventListener('click', () => selectFilter(filter));
    el.filterRow.append(card);
  }
}

function selectFilter(filter) {
  state.filter = filter;
  state.savedPhoto = null;
  for (const card of $$('.filter-card', el.filterRow)) {
    card.setAttribute('aria-checked', String(card.dataset.id === filter.id));
  }
  el.filterName.textContent = filter.nama;
  const disabled = !filter.params.css || filter.params.css === 'none';
  el.intensity.disabled = disabled;
  if (disabled) {
    el.intensity.value = '100';
    state.intensity = 1;
    el.intensityValue.textContent = '100%';
  }
  updateSaveStatus();
  schedulePreview();
  sound.click();
}

function prepareResult() {
  if (state.editBase) {
    prepareResultFromSaved();
    return;
  }
  if (filledCount() < state.poseCount) {
    toast('Lengkapi semua pose dulu ya.', 'error');
    go('camera', { push: false });
    return;
  }

  el.dpiChip.textContent = `${state.paper.dpi} DPI`;
  const mode = currentMode();
  const multi = mode.copies > 1 ? ` · ${mode.nama}` : '';
  el.resultMeta.textContent =
    `${state.paper.nama}${multi} · ${state.poseCount} pose · ${state.border.nama} · ` +
    `${state.paper.lebarPx} × ${state.paper.tinggiPx} px · ${state.paper.dpi} DPI`;

  if (!state.filter) state.filter = state.catalog.filters[0];
  buildFilterRow();
  el.filterName.textContent = state.filter.nama;
  el.intensity.value = String(Math.round(state.intensity * 100));
  el.intensityValue.textContent = `${Math.round(state.intensity * 100)}%`;
  el.intensity.disabled = !state.filter.params.css || state.filter.params.css === 'none';
  updateDecorateHint();
  renderOverlayList();
  syncOverlayControls();
  updateSaveStatus();
  renderPreview();
}

/* ------------------------------ mode edit ------------------------------ */

/** Menyerahkan tampilan layar hasil sesuai apakah sedang mode edit atau bukan. */
function syncEditModeUi() {
  const editing = Boolean(state.editBase);
  el.filterCard.hidden = editing;
  el.editNote.hidden = !editing;
  if (editing) {
    el.editNote.textContent =
      'Mode edit: filter dan border sudah terbawa dari foto tersimpan. ' +
      'Ubah atau geser hiasan, lalu simpan sebagai foto baru.';
    el.resultBack.setAttribute('aria-label', 'Kembali ke galeri');
  } else {
    el.resultBack.setAttribute('aria-label', 'Kembali ke kamera');
  }
}

function prepareResultFromSaved() {
  const photo = state.editBase.photo;
  el.dpiChip.textContent = `${state.paper.dpi} DPI`;
  el.resultMeta.textContent =
    `Edit ulang · ${state.border?.nama ?? photo.borderId} · ${state.paper.nama} · ` +
    `${photo.lebarPx} × ${photo.tinggiPx} px · ${state.paper.dpi} DPI`;
  el.filterName.textContent = state.filter?.nama ?? '';
  renderOverlayList();
  syncOverlayControls();
  updateSaveStatus();
  renderPreview();
}

/** Memecah URL gambar menjadi bitmap/gambar siap digambar ke kanvas. */
async function loadSavedImage(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Berkas foto tidak dapat dibuka.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

async function enterEditMode(photo) {
  if (!photo.lapisan?.length) {
    toast('Foto ini tidak menyimpan data hiasan.', 'error');
    return;
  }
  const paper = paperById(photo.paperSizeId);
  if (!paper) {
    toast('Kertas foto tidak dikenal.', 'error');
    return;
  }

  el.lightbox.close();
  try {
    await withBusy('Membuka editor…', async () => {
      const blob = await api.fetchPhotoBlob(photo);
      const image = await loadSavedImage(blob);
      const seqs = photo.lapisan
        .map((layer) => Number(String(layer.id).match(/(\d+)$/)?.[1] ?? 0))
        .filter(Number.isFinite);

      state.editBase = { photo, blob, image };
      state.paper = paper;
      state.multiId = modeFor(paper.id, photo.mode ?? 'single').id;
      state.activeTile = 0;
      state.border = borderById(photo.borderId);
      state.filter = state.catalog.filters.find((item) => item.id === photo.filterId)
        ?? state.catalog.filters[0];
      state.intensity = photo.intensitas ?? 1;
      const design = designPaper();
      state.poseCount = Math.min(design.posesMax, Math.max(design.posesMin, photo.jumlahPose || 1));
      state.shots = new Array(state.poseCount).fill(null);
      state.overlays = photo.lapisan.map((layer) => ({ ...layer }));
      state.overlaySeq = seqs.length ? Math.max(...seqs) : 0;
      state.selectedOverlayId = null;
      state.textColor = 'putih';
      state.savedPhoto = null;
      if (el.overlayText) el.overlayText.value = '';
    });
    syncEditModeUi();
    go('result');
    announceOverlay('Hiasan dimuat dari galeri.');
  } catch (error) {
    toast(error.message, 'error');
    sound.error();
  }
}

/** Keluar dari mode edit dan kembali ke galeri. */
function exitEditMode() {
  state.editBase = null;
  resetOverlays();
  state.savedPhoto = null;
  state.shots = [];
  syncEditModeUi();
  go('gallery');
}

/** Render ulang lembar tersimpan dengan hiasan dari data lapisan. */
async function savedCanvasFor(photo) {
  const blob = await api.fetchPhotoBlob(photo);
  const image = await loadSavedImage(blob);
  const paper = paperById(photo.paperSizeId);
  const mode = modeFor(photo.paperSizeId, photo.mode ?? 'single');
  try {
    return renderFromSaved({
      paper,
      designPaper: paperById(mode.designId) ?? paper,
      cols: mode.cols,
      rows: mode.rows,
      baseImage: image,
      border: borderById(photo.borderId),
      poseCount: photo.jumlahPose,
      scale: 1,
      overlays: photo.lapisan ?? [],
    }).canvas;
  } finally {
    if (typeof image.close === 'function') image.close();
  }
}

function previewShots() {
  return state.shots.map((shot) => shot?.canvas ?? null);
}

const RESULT_SCALE = (paper) => Math.min(1, 900 / Math.max(paper.lebarPx, paper.tinggiPx));

function renderPreview() {
  const paper = state.paper;
  const mode = currentMode();
  const design = designPaper();
  const scale = RESULT_SCALE(paper);

  let result;
  if (state.editBase) {
    result = renderFromSaved({
      paper,
      designPaper: design,
      cols: mode.cols,
      rows: mode.rows,
      baseImage: state.editBase.image,
      border: state.border,
      poseCount: state.poseCount,
      scale,
      canvas: el.previewCanvas,
      overlays: state.overlays,
      selectedOverlayId: state.selectedOverlayId,
      selectionTile: state.activeTile,
    });
  } else {
    result = renderMultiSheet({
      paper,
      designPaper: design,
      cols: mode.cols,
      rows: mode.rows,
      copies: mode.copies,
      border: state.border,
      filter: state.filter,
      intensity: state.intensity,
      shots: previewShots(),
      poseCount: state.poseCount,
      scale,
      canvas: el.previewCanvas,
      overlays: state.overlays,
      selectedOverlayId: state.selectedOverlayId,
      selectionTile: state.activeTile,
    });
  }
  state.previewLayout = result.layout;
  state.previewTiles = result.tiles ?? [];
}

function schedulePreview() {
  if (previewFrame) cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(() => {
    previewFrame = null;
    renderPreview();
  });
}

/* ------------------------------ hiasan ------------------------------ */

const OVERLAY_LIMIT = 12;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function currentOverlay() {
  return state.overlays.find((overlay) => overlay.id === state.selectedOverlayId) ?? null;
}

function overlayLabel(overlay) {
  if (overlay.type === 'text') return `Teks “${overlay.text}”`;
  return `Stiker ${stickerById(overlay.stickerId).nama}`;
}

function announceOverlay(message) {
  el.overlayStatus.textContent = message;
}

function markOverlayDirty() {
  if (!state.savedPhoto) return;
  state.savedPhoto = null;
  updateSaveStatus();
}

function overlaySpot(type) {
  const index = state.overlays.filter((overlay) => overlay.type === type).length;
  if (type === 'text') {
    // Teks tetap di tengah agar tidak terpotong, dengan variasi vertikal.
    return { x: 0.5, y: clamp(0.46 + (index % 3) * 0.11, 0.24, 0.8) };
  }
  // Stiker disebar pada grid 4 × 3 supaya hiasan baru tidak saling menutup.
  return {
    x: 0.24 + (index % 4) * 0.17,
    y: 0.3 + (Math.floor(index / 4) % 3) * 0.2,
  };
}

function addOverlay(overlay) {
  if (state.overlays.length >= OVERLAY_LIMIT) {
    toast(`Maksimal ${OVERLAY_LIMIT} hiasan per foto.`, 'error');
    sound.error();
    return false;
  }
  state.overlays.push(overlay);
  state.selectedOverlayId = overlay.id;
  markOverlayDirty();
  renderOverlayList();
  syncOverlayControls();
  schedulePreview();
  return true;
}

function addSticker(stickerId) {
  const sticker = stickerById(stickerId);
  const spot = overlaySpot('sticker');
  const added = addOverlay({
    id: `hiasan-${++state.overlaySeq}`,
    type: 'sticker',
    stickerId: sticker.id,
    x: spot.x,
    y: spot.y,
    size: 0.14,
    rotation: 0,
  });
  if (added) {
    announceOverlay(`Stiker ${sticker.nama} ditambahkan.`);
    sound.click();
  }
}

function submitText() {
  const text = el.overlayText.value.trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!text) {
    toast('Tulis teks dulu ya.', 'error');
    el.overlayText.focus();
    return;
  }

  const selected = currentOverlay();
  if (selected?.type === 'text') {
    selected.text = text;
    selected.color = state.textColor;
    markOverlayDirty();
    renderOverlayList();
    syncOverlayControls();
    schedulePreview();
    announceOverlay('Teks diperbarui.');
    sound.click();
    return;
  }

  const spot = overlaySpot('text');
  const added = addOverlay({
    id: `hiasan-${++state.overlaySeq}`,
    type: 'text',
    text,
    color: state.textColor,
    x: spot.x,
    y: spot.y,
    size: 0.07,
    rotation: 0,
  });
  if (added) {
    announceOverlay('Teks ditambahkan.');
    sound.click();
  }
}

function selectOverlay(id) {
  state.selectedOverlayId = state.overlays.some((overlay) => overlay.id === id) ? id : null;
  const overlay = currentOverlay();
  if (overlay?.type === 'text') {
    el.overlayText.value = overlay.text;
    state.textColor = overlay.color;
  }
  renderOverlayList();
  syncOverlayControls();
  schedulePreview();
}

function chooseTextColor(colorId) {
  state.textColor = TEXT_COLORS.some((color) => color.id === colorId) ? colorId : 'putih';
  const overlay = currentOverlay();
  if (overlay?.type === 'text') {
    overlay.color = state.textColor;
    markOverlayDirty();
    schedulePreview();
  }
  syncOverlayControls();
}

function resizeSelected(value) {
  const overlay = currentOverlay();
  if (!overlay) return;
  overlay.size = clamp(Number(value) / 100, 0.04, 0.3);
  el.overlaySizeValue.textContent = `${Math.round(overlay.size * 100)}%`;
  markOverlayDirty();
  schedulePreview();
}

function rotateSelected(delta) {
  const overlay = currentOverlay();
  if (!overlay) return;
  overlay.rotation = (overlay.rotation + delta + 360) % 360;
  markOverlayDirty();
  schedulePreview();
}

function deleteSelected() {
  const overlay = currentOverlay();
  if (!overlay) return;
  state.overlays = state.overlays.filter((item) => item.id !== overlay.id);
  state.selectedOverlayId = null;
  markOverlayDirty();
  renderOverlayList();
  syncOverlayControls();
  schedulePreview();
  announceOverlay('Hiasan dihapus.');
  el.addText.focus();
}

function syncOverlayControls() {
  const overlay = currentOverlay();
  el.overlayTools.hidden = !overlay;
  el.addText.textContent = overlay?.type === 'text' ? 'Perbarui teks' : 'Tambah teks';
  el.overlayCount.textContent = state.overlays.length
    ? `${state.overlays.length} hiasan`
    : 'Belum ada';
  if (overlay) {
    el.overlaySelected.textContent = overlayLabel(overlay);
    el.overlaySize.value = String(Math.round(overlay.size * 100));
    el.overlaySizeValue.textContent = `${Math.round(overlay.size * 100)}%`;
  }
  el.previewCanvas.classList.toggle('is-editing', Boolean(overlay));
  if (!overlay) el.previewCanvas.classList.remove('is-dragging');
  const activeColor = overlay?.type === 'text' ? overlay.color : state.textColor;
  for (const button of el.textColors.querySelectorAll('.color-swatch')) {
    button.setAttribute('aria-pressed', String(button.dataset.color === activeColor));
  }
}

function renderOverlayList() {
  el.overlayList.replaceChildren();
  if (!state.overlays.length) {
    el.overlayList.append(element('p', 'hint', 'Belum ada hiasan.'));
    return;
  }
  for (const overlay of state.overlays) {
    const chip = element('button', 'overlay-chip');
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(overlay.id === state.selectedOverlayId));
    chip.append(element('span', null, overlayLabel(overlay)));
    chip.addEventListener('click', () => selectOverlay(overlay.id));
    el.overlayList.append(chip);
  }
}

function renderStickerGrid() {
  el.stickerGrid.replaceChildren();
  for (const sticker of STICKERS) {
    const button = element('button', 'sticker-btn');
    button.type = 'button';
    button.title = sticker.nama;
    button.setAttribute('aria-label', `Tambah stiker ${sticker.nama}`);
    const canvas = document.createElement('canvas');
    canvas.width = 72;
    canvas.height = 72;
    drawSticker(canvas.getContext('2d'), sticker.id, 4, 4, 64);
    button.append(canvas);
    button.addEventListener('click', () => addSticker(sticker.id));
    el.stickerGrid.append(button);
  }
}

function renderTextColors() {
  el.textColors.replaceChildren();
  for (const color of TEXT_COLORS) {
    const button = element('button', 'color-swatch');
    button.type = 'button';
    button.dataset.color = color.id;
    button.style.background = color.fill;
    button.setAttribute('aria-label', `Warna teks ${color.nama}`);
    button.setAttribute('aria-pressed', String(color.id === state.textColor));
    button.addEventListener('click', () => chooseTextColor(color.id));
    el.textColors.append(button);
  }
}

function resetOverlays() {
  state.overlays = [];
  state.selectedOverlayId = null;
  state.overlaySeq = 0;
  state.textColor = 'putih';
  state.drag = null;
  state.activeTile = 0;
  el.overlayText.value = '';
  renderOverlayList();
  syncOverlayControls();
}

function canvasPoint(event) {
  const rect = el.previewCanvas.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * el.previewCanvas.width;
  const py = ((event.clientY - rect.top) / rect.height) * el.previewCanvas.height;
  const tiles = state.previewTiles?.length
    ? state.previewTiles
    : [{ index: 0, x: 0, y: 0, w: el.previewCanvas.width, h: el.previewCanvas.height }];
  const tile = tiles.find(
    (item) => px >= item.x && px <= item.x + item.w && py >= item.y && py <= item.y + item.h,
  );
  if (!tile || !state.previewLayout) return { px, py, x: null, y: null, tile: null };

  const localX = px - tile.x;
  const localY = py - tile.y;
  return {
    px: localX,
    py: localY,
    x: localX / state.previewLayout.width,
    y: localY / state.previewLayout.height,
    tile,
  };
}

function overlayAt(point) {
  if (!state.previewLayout) return null;
  const ctx = el.previewCanvas.getContext('2d');
  for (let index = state.overlays.length - 1; index >= 0; index -= 1) {
    const overlay = state.overlays[index];
    if (hitTestOverlay(ctx, state.previewLayout, overlay, point.px, point.py)) return overlay;
  }
  return null;
}

function endOverlayDrag(event) {
  if (!state.drag) return;
  state.drag = null;
  el.previewCanvas.classList.remove('is-dragging');
  if (el.previewCanvas.hasPointerCapture?.(event.pointerId)) {
    el.previewCanvas.releasePointerCapture(event.pointerId);
  }
}

function updateSaveStatus() {
  const button = el.saveBtn;
  if (state.savedPhoto) {
    button.disabled = true;
    button.replaceChildren(icon('check'), document.createTextNode('Tersimpan di galeri'));
    el.saveStatus.textContent =
      `Tersimpan ${formatDate(state.savedPhoto.createdAt)} · otomatis dihapus ${formatDate(state.savedPhoto.expiresAt)}.`;
  } else {
    button.disabled = false;
    button.replaceChildren(icon('check'), document.createTextNode('Simpan ke galeri'));
    el.saveStatus.textContent = 'File 300 DPI sesuai ukuran kertas, margin aman 3 mm.';
  }
}

function fullSheet({ withOverlays = true } = {}) {
  const mode = currentMode();
  return renderMultiSheet({
    paper: state.paper,
    designPaper: designPaper(),
    cols: mode.cols,
    rows: mode.rows,
    copies: mode.copies,
    border: state.border,
    filter: state.filter,
    intensity: state.intensity,
    shots: previewShots(),
    poseCount: state.poseCount,
    scale: 1,
    canvas: document.createElement('canvas'),
    overlays: withOverlays ? state.overlays : [],
  }).canvas;
}

/** Lembar penuh dalam mode edit: basis tersimpan + hiasan aktif. */
function savedSheet() {
  const mode = currentMode();
  return renderFromSaved({
    paper: state.paper,
    designPaper: designPaper(),
    cols: mode.cols,
    rows: mode.rows,
    baseImage: state.editBase.image,
    border: state.border,
    poseCount: state.poseCount,
    scale: 1,
    canvas: document.createElement('canvas'),
    overlays: state.overlays,
  }).canvas;
}

async function saveToGallery() {
  if (state.savedPhoto || state.busy) return;
  sound.click();

  const mode = currentMode();
  try {
    await withBusy('Merender 300 DPI…', async () => {
      // Berkas tersimpan versi bersih (tanpa hiasan) agar bisa diedit ulang;
      // hiasan disimpan sebagai data lapisan dan digambar ulang saat dibuka.
      const clean = state.editBase ? state.editBase.blob : fullSheet({ withOverlays: false });
      const decorated = state.editBase ? savedSheet() : fullSheet();
      const blob = clean instanceof Blob ? clean : await imageBlobWithDpi(clean, 'image/png', state.paper.dpi);
      const thumbBlob = await makeThumbnail(decorated);

      const saved = await api.savePhoto({
        blob,
        thumbBlob,
        meta: {
          borderId: state.border.id,
          filterId: state.filter.id,
          paperSizeId: state.paper.id,
          jumlahPose: state.poseCount,
          lebarPx: decorated.width,
          tinggiPx: decorated.height,
          dpi: state.paper.dpi,
          intensitas: state.intensity,
          mode: mode.copies > 1 ? mode.id : 'single',
          lapisan: JSON.stringify(state.overlays),
        },
      });

      state.savedPhoto = saved;
      if (!state.photos.some((item) => item.id === saved.id)) {
        state.photos = [saved, ...state.photos];
      }
      updateGalleryCount();
      updateSaveStatus();
    });
    toast('Foto tersimpan di galeri.', 'success');
    sound.cheer();
  } catch (error) {
    toast(error.message, 'error');
    sound.error();
  }
}

async function downloadPhoto(format) {
  if (state.busy) return;
  sound.click();

  const label = format === 'pdf' ? 'Menyiapkan PDF siap cetak…' : 'Merender 300 DPI…';
  try {
    await withBusy(label, async () => {
      const canvas = state.editBase ? savedSheet() : fullSheet();
      const { blob, filename } = await buildExport(canvas, state.paper, format);
      downloadBlob(blob, filename);
    });
    toast(format === 'pdf' ? 'PDF siap dicetak.' : 'Foto berhasil diunduh.', 'success');
    sound.cheer();
  } catch (error) {
    toast(error.message, 'error');
    sound.error();
  }
}

/* ============================== galeri ============================== */

function paperById(id) {
  return state.catalog?.paperSizes.find((paper) => paper.id === id) ?? null;
}

function borderById(id) {
  return state.catalog.borders.find((border) => border.id === id);
}

/** Label mode multi-cetak dari data foto tersimpan; null bila mode tunggal. */
function savedModeLabel(photo) {
  if (!photo.mode || photo.mode === 'single') return null;
  return modesFor(photo.paperSizeId).find((mode) => mode.id === photo.mode)?.nama ?? photo.mode;
}

function updateGalleryCount() {
  el.galleryCount.textContent = String(state.photos.length);
  el.galleryCount.hidden = state.photos.length === 0;
}

async function refreshGalleryCount() {
  try {
    state.photos = await api.listPhotos();
  } catch {
    state.photos = [];
  }
  updateGalleryCount();
}

async function loadGallery() {
  for (const url of galleryUrls) URL.revokeObjectURL(url);
  galleryUrls = [];
  el.galleryGrid.replaceChildren();
  el.galleryEmpty.querySelector('h3').textContent = 'Belum ada foto tersimpan';
  el.galleryEmpty.querySelector('p').textContent =
    'Hasil fotomu akan muncul di sini, lengkap dengan border dan filter yang dipakai.';

  try {
    const photos = await api.listPhotos();
    state.photos = photos;
    updateGalleryCount();

    if (!photos.length) {
      el.galleryEmpty.hidden = false;
      return;
    }
    el.galleryEmpty.hidden = true;

    const thumbs = await Promise.all(
      photos.map((photo) => api.fetchThumbBlob(photo).catch(() => null)),
    );

    photos.forEach((photo, index) => {
      const paper = paperById(photo.paperSizeId);
      const border = borderById(photo.borderId);

      const card = element('article', 'gallery-card');
      const thumbButton = element('button', 'gallery-thumb');
      thumbButton.type = 'button';
      thumbButton.setAttribute('aria-label', 'Lihat foto');

      const img = document.createElement('img');
      if (thumbs[index]) {
        const url = URL.createObjectURL(thumbs[index]);
        galleryUrls.push(url);
        img.src = url;
      }
      img.alt = `Foto ${paper?.nama ?? ''} dengan border ${border?.nama ?? ''}`;
      img.loading = 'lazy';
      thumbButton.append(img);
      thumbButton.addEventListener('click', () => openLightbox(photo));

      const info = element('div', 'gallery-info');
      const label = savedModeLabel(photo);
      info.append(
        element('span', 'gallery-title', `${border?.nama ?? photo.borderId} · ${paper?.nama ?? photo.paperSizeId}`),
      );
      if (label) info.append(element('span', 'gallery-tag', label));
      info.append(
        element('span', 'gallery-sub', `${formatDate(photo.createdAt)} · ${photo.jumlahPose} pose · ${photo.dpi} DPI`),
      );

      const actions = element('div', 'gallery-actions');
      const download = element('button', 'btn btn-soft btn-sm');
      download.type = 'button';
      download.append(icon('download'), element('span', null, 'Unduh'));
      download.addEventListener('click', () => downloadSaved(photo));

      const remove = element('button', 'btn btn-danger btn-sm');
      remove.type = 'button';
      remove.append(icon('trash'), element('span', null, 'Hapus'));
      remove.addEventListener('click', () => deleteSaved(photo));

      actions.append(download, remove);
      card.append(thumbButton, info, actions);
      el.galleryGrid.append(card);
    });
  } catch (error) {
    el.galleryEmpty.hidden = false;
    el.galleryEmpty.querySelector('h3').textContent = 'Galeri gagal dimuat';
    el.galleryEmpty.querySelector('p').textContent = error.message;
    toast(error.message, 'error');
  }
}

async function downloadSaved(photo) {
  if (state.busy) return;
  sound.click();
  try {
    const paper = paperById(photo.paperSizeId);

    // Foto dengan data lapisan dirender ulang agar hiasan ikut di unduhan.
    if (paper && photo.lapisan?.length) {
      await withBusy('Merender 300 DPI…', async () => {
        const canvas = await savedCanvasFor(photo);
        const { blob, filename } = await buildExport(canvas, paper, 'png');
        downloadBlob(blob, filename);
      });
      toast('Foto berhasil diunduh.', 'success');
      sound.cheer();
      return;
    }

    const blob = await api.fetchPhotoBlob(photo);
    const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    downloadBlob(blob, paper ? fileName(paper, extension) : `photobox.${extension}`);
    toast('Unduhan dimulai.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteSaved(photo) {
  const confirmed = window.confirm('Hapus foto ini dari galeri? Tindakan ini tidak bisa dibatalkan.');
  if (!confirmed) return;

  try {
    await api.deletePhoto(photo.id);
    state.photos = state.photos.filter((item) => item.id !== photo.id);
    updateGalleryCount();
    el.lightbox.close();
    await loadGallery();
    toast('Foto dihapus.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function openLightbox(photo) {
  lightboxPhoto = photo;
  lightboxBlob = null;
  lightboxDecorated = null;
  if (lightboxUrl) {
    URL.revokeObjectURL(lightboxUrl);
    lightboxUrl = null;
  }

  el.lightboxImg.removeAttribute('src');
  delete el.lightboxImg.dataset.decorated;
  el.lightboxTitle.textContent =
    `${borderById(photo.borderId)?.nama ?? photo.borderId} · ${paperById(photo.paperSizeId)?.nama ?? photo.paperSizeId}`;
  const modeLabel = savedModeLabel(photo);
  el.lightboxSub.textContent =
    `${modeLabel ? `${modeLabel} · ` : ''}${formatDate(photo.createdAt)} · ${photo.jumlahPose} pose · ` +
    `${photo.dpi} DPI · ${photo.lebarPx} × ${photo.tinggiPx} px`;
  // Hiasan hanya bisa diedit ulang bila data lapisannya tersimpan.
  el.lightboxEdit.hidden = !photo.lapisan?.length;
  el.lightboxEdit.setAttribute('aria-label', `Edit hiasan ${el.lightboxTitle.textContent}`);
  el.lightbox.showModal();

  try {
    lightboxBlob = await api.fetchPhotoBlob(photo);
    lightboxUrl = URL.createObjectURL(lightboxBlob);
    el.lightboxImg.src = lightboxUrl;

    // Berkas tersimpan versi bersih; tampilkan pratinjau berhiasan dari data lapisan.
    if (photo.lapisan?.length) {
      lightboxDecorated = await savedCanvasFor(photo);
      const decoratedBlob = await canvasToBlob(lightboxDecorated, 'image/png');
      const decoratedUrl = URL.createObjectURL(decoratedBlob);
      el.lightboxImg.src = decoratedUrl;
      el.lightboxImg.dataset.decorated = '1';
      URL.revokeObjectURL(lightboxUrl);
      lightboxUrl = decoratedUrl;
      lightboxBlob = decoratedBlob;
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ============================== pengikatan ============================== */

function updateSoundButton() {
  const use = el.soundToggle.querySelector('use');
  use.setAttribute('href', sound.enabled ? '#i-sound' : '#i-mute');
  el.soundToggle.setAttribute('aria-pressed', String(sound.enabled));
  el.soundToggle.setAttribute('aria-label', sound.enabled ? 'Matikan suara' : 'Nyalakan suara');
}

function bindEvents() {
  for (const button of $$('[data-nav]')) {
    button.addEventListener('click', () => {
      sound.unlock();
      sound.click();
      go(button.dataset.nav);
    });
  }

  for (const button of $$('[data-close]')) {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  }

  for (const dialog of $$('dialog')) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  $('#start-btn').addEventListener('click', async () => {
    if (!state.catalog) {
      toast('Katalog belum siap. Muat ulang halaman sebentar lagi.', 'error');
      return;
    }
    sound.unlock();
    sound.click();
    el.mascot.classList.add('is-cheering');
    el.curtain.classList.add('is-open');
    resetShots();
    resetOverlays();
    state.editBase = null;
    syncEditModeUi();
    state.savedPhoto = null;
    state.filter = state.catalog.filters[0];
    state.intensity = 1;
    updateSummary();
    // Manfaatkan jeda animasi tirai untuk menyiapkan thumbnail border.
    await Promise.all([wait(720), ensureBorderCarousel()]);
    go('setup');
    el.curtain.classList.remove('is-open');
    el.mascot.classList.remove('is-cheering');
    warmupCamera();
  });

  el.soundToggle.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    updateSoundButton();
  });

  $('#privacy-btn').addEventListener('click', () => el.privacy.showModal());

  $('#to-camera').addEventListener('click', () => {
    sound.click();
    const design = designPaper();
    if (state.poseCount < design.posesMin) {
      state.poseCount = design.posesMin;
      renderPoseOptions();
      updateSummary();
    }
    renderShots();
    go('camera');
  });

  $('#camera-back').addEventListener('click', () => go('setup'));
  $('#result-back').addEventListener('click', () => {
    if (state.editBase) exitEditMode();
    else go('camera');
  });
  $('#retake-btn').addEventListener('click', () => go('camera'));

  el.shutter.addEventListener('click', takePhoto);
  $('#switch-camera').addEventListener('click', switchCamera);
  $('#camera-retry').addEventListener('click', startCamera);
  $('#retake-all').addEventListener('click', resetAllShots);

  $('#camera-upload').addEventListener('click', () => el.uploadInput.click());
  $('#upload-btn').addEventListener('click', () => el.uploadInput.click());
  el.uploadInput.addEventListener('change', async (event) => {
    await handleUpload(event.target.files ?? []);
    event.target.value = '';
  });

  // Unggah lewat seret-lepas di area kamera, alternatif saat kamera ditolak.
  const dropZone = $('.camera-stage');
  const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
  for (const type of ['dragenter', 'dragover']) {
    dropZone.addEventListener(type, (event) => {
      if (state.screen !== 'camera' || !hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('is-dragging');
    });
  }
  dropZone.addEventListener('dragleave', (event) => {
    if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('is-dragging');
  });
  dropZone.addEventListener('drop', async (event) => {
    if (state.screen !== 'camera' || !hasFiles(event)) return;
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    await handleUpload(event.dataTransfer.files ?? []);
  });

  el.toResult.addEventListener('click', () => {
    if (filledCount() < state.poseCount) {
      toast('Lengkapi semua pose dulu ya.', 'error');
      return;
    }
    go('result');
  });

  el.intensity.addEventListener('input', () => {
    state.intensity = Number(el.intensity.value) / 100;
    el.intensityValue.textContent = `${el.intensity.value}%`;
    state.savedPhoto = null;
    updateSaveStatus();
    schedulePreview();
  });

  el.overlayForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitText();
  });
  el.overlaySize.addEventListener('input', () => resizeSelected(el.overlaySize.value));
  el.rotateLeft.addEventListener('click', () => {
    rotateSelected(-15);
    sound.click();
  });
  el.rotateRight.addEventListener('click', () => {
    rotateSelected(15);
    sound.click();
  });
  el.deleteOverlay.addEventListener('click', () => {
    deleteSelected();
    sound.click();
  });

  el.previewCanvas.addEventListener('pointerdown', (event) => {
    if (state.screen !== 'result') return;
    const point = canvasPoint(event);
    if (!point.tile) {
      if (state.selectedOverlayId) selectOverlay(null);
      return;
    }
    state.activeTile = point.tile.index;
    const overlay = overlayAt(point);
    if (!overlay) {
      if (state.selectedOverlayId) selectOverlay(null);
      else schedulePreview();
      return;
    }
    if (overlay.id !== state.selectedOverlayId) selectOverlay(overlay.id);
    else schedulePreview();
    state.drag = {
      id: overlay.id,
      dx: overlay.x - point.x,
      dy: overlay.y - point.y,
    };
    el.previewCanvas.setPointerCapture(event.pointerId);
    el.previewCanvas.classList.add('is-dragging');
  });

  el.previewCanvas.addEventListener('pointermove', (event) => {
    if (!state.drag || state.screen !== 'result') return;
    const overlay = state.overlays.find((item) => item.id === state.drag.id);
    if (!overlay) return;
    const point = canvasPoint(event);
    let x = point.x;
    let y = point.y;
    if (!point.tile) {
      const tile = state.previewTiles[state.activeTile];
      if (!tile || !state.previewLayout) return;
      x = (point.px - tile.x) / state.previewLayout.width;
      y = (point.py - tile.y) / state.previewLayout.height;
    }
    overlay.x = clamp(x + state.drag.dx, 0.02, 0.98);
    overlay.y = clamp(y + state.drag.dy, 0.02, 0.98);
    markOverlayDirty();
    schedulePreview();
  });

  el.previewCanvas.addEventListener('pointerup', endOverlayDrag);
  el.previewCanvas.addEventListener('pointercancel', endOverlayDrag);

  el.previewCanvas.addEventListener('keydown', (event) => {
    const overlay = currentOverlay();
    if (!overlay) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected();
      return;
    }
    const step = event.shiftKey ? 0.02 : 0.005;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    if (event.key === 'ArrowRight') dx = step;
    if (event.key === 'ArrowUp') dy = -step;
    if (event.key === 'ArrowDown') dy = step;
    if (!dx && !dy) return;
    event.preventDefault();
    overlay.x = clamp(overlay.x + dx, 0.02, 0.98);
    overlay.y = clamp(overlay.y + dy, 0.02, 0.98);
    markOverlayDirty();
    schedulePreview();
  });

  el.saveBtn.addEventListener('click', saveToGallery);
  for (const button of $$('[data-download]')) {
    button.addEventListener('click', () => downloadPhoto(button.dataset.download));
  }

  $('#gallery-refresh').addEventListener('click', () => {
    loadGallery();
    toast('Galeri dimuat ulang.', 'info');
  });

  el.lightboxEdit.addEventListener('click', async () => {
    if (lightboxPhoto) await enterEditMode(lightboxPhoto);
  });

  el.lightboxDownload.addEventListener('click', async () => {
    const photo = lightboxPhoto;
    if (!photo) return;
    const paper = paperById(photo.paperSizeId);

    // Data lapisan tersimpan: render ulang berhiasan untuk unduhan.
    if (paper && photo.lapisan?.length) {
      sound.click();
      try {
        await withBusy('Merender 300 DPI…', async () => {
          const canvas = lightboxDecorated ?? await savedCanvasFor(photo);
          const { blob, filename } = await buildExport(canvas, paper, 'png');
          downloadBlob(blob, filename);
        });
        toast('Foto berhasil diunduh.', 'success');
        sound.cheer();
      } catch (error) {
        toast(error.message, 'error');
        sound.error();
      }
      return;
    }

    if (!lightboxBlob) {
      try {
        lightboxBlob = await api.fetchPhotoBlob(photo);
      } catch (error) {
        toast(error.message, 'error');
        return;
      }
    }
    const extension = lightboxBlob.type === 'image/jpeg' ? 'jpg' : 'png';
    downloadBlob(lightboxBlob, paper ? fileName(paper, extension) : `photobox.${extension}`);
  });

  el.lightboxDelete.addEventListener('click', () => {
    if (lightboxPhoto) deleteSaved(lightboxPhoto);
  });

  document.addEventListener('keydown', (event) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(event.target.tagName)
      || event.target.isContentEditable;
    const dialogOpen = Boolean(document.querySelector('dialog[open]'));
    if (event.code === 'Space' && state.screen === 'camera' && !typing && !dialogOpen) {
      event.preventDefault();
      takePhoto();
    }
  });

  window.addEventListener('popstate', (event) => {
    const screen = event.state?.screen;
    go(SCREENS.includes(screen) ? screen : 'home', { push: false });
  });
}

/* ============================== awal ============================== */

async function boot() {
  getSessionId();
  updateSoundButton();
  bindEvents();
  renderStickerGrid();
  renderTextColors();
  renderOverlayList();
  syncOverlayControls();
  history.replaceState({ screen: 'home' }, '', '#home');

  el.speech.textContent = [
    'Halo! Aku Kiko. Siap foto bareng?',
    'Cari cahaya bagus, lalu pose!',
    'Border mana yang kamu mau hari ini?',
  ][Math.floor(Math.random() * 3)];

  try {
    state.catalog = await api.catalog();
  } catch (error) {
    toast(`Katalog gagal dimuat: ${error.message}`, 'error');
    return;
  }

  state.paper = state.catalog.paperSizes.find((paper) => paper.id === DEFAULT_PAPER)
    ?? state.catalog.paperSizes[0];
  state.multiId = modesFor(state.paper.id)[0].id;
  state.poseCount = Math.min(4, designPaper().posesMax);
  state.border = state.catalog.borders.find((border) => border.id === DEFAULT_BORDER)
    ?? state.catalog.borders[0];
  state.filter = state.catalog.filters[0];
  resetShots();

  renderPaperOptions();
  renderMultiOptions();
  renderPoseOptions();
  updateDecorateHint();
  updateSummary();
  refreshGalleryCount();

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (state.screen === 'result' && filledCount() === state.poseCount) renderPreview();
    });
  }
}

boot();
