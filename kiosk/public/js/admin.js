/** Panel admin dengan PIN. Semua pengaturan disimpan lokal di browser. */
import { $, toast } from './dom.js';
import { saveSettings, applyTheme } from './config.js';

export function bindAdmin(getSettings, onSaved) {
  const dialog = $('#admin-dialog');
  const pinForm = $('#pin-form');
  const body = $('#admin-body');
  let unlocked = false;

  const fields = {
    shots: $('#admin-shots'), countdown: $('#admin-countdown'),
    name: $('#admin-name'), date: $('#admin-date'), quote: $('#admin-quote'),
    pin: $('#admin-pin'), accent: $('#admin-accent'),
    frameAccent: $('#admin-frame-accent'), idle: $('#admin-idle'),
  };

  function fill() {
    const s = getSettings();
    fields.shots.value = s.shots;
    fields.countdown.value = s.countdown;
    fields.name.value = s.eventName;
    fields.date.value = s.eventDate;
    fields.quote.value = s.quote;
    fields.pin.value = '';
    fields.accent.value = s.accent;
    fields.frameAccent.value = s.frameAccent;
    fields.idle.value = s.idleSeconds;
  }

  $('#admin-btn').addEventListener('click', () => {
    fill();
    pinForm.hidden = unlocked;
    body.hidden = !unlocked;
    dialog.showModal();
  });

  pinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('#pin-input').value.trim() !== getSettings().pin) {
      toast('PIN salah.', 'error');
      return;
    }
    unlocked = true;
    pinForm.hidden = true;
    body.hidden = false;
    $('#pin-input').value = '';
  });

  const logoInput = $('#admin-logo');
  let logoDataUrl = null;
  logoInput.addEventListener('change', () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Logo maksimal 2 MB.', 'error');
      logoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = String(reader.result);
      toast('Logo siap dipakai. Simpan pengaturan untuk menerapkannya.');
    };
    reader.onerror = () => toast('Logo gagal dibaca.', 'error');
    reader.readAsDataURL(file);
  });

  $('#admin-clear-logo').addEventListener('click', () => {
    logoDataUrl = '';
    toast('Logo dihapus setelah pengaturan disimpan.');
  });

  $('#admin-save').addEventListener('click', () => {
    const s = getSettings();
    const next = {
      ...s,
      shots: Math.min(6, Math.max(1, Number(fields.shots.value) || 4)),
      countdown: Math.min(9, Math.max(1, Number(fields.countdown.value) || 3)),
      eventName: fields.name.value.trim().slice(0, 28) || 'Malam Ini',
      eventDate: fields.date.value.trim().slice(0, 24),
      quote: fields.quote.value.trim().slice(0, 48),
      accent: fields.accent.value,
      frameAccent: fields.frameAccent.value,
      idleSeconds: Math.min(600, Math.max(15, Number(fields.idle.value) || 60)),
      pin: /^\d{1,8}$/.test(fields.pin.value.trim()) && fields.pin.value.trim()
        ? fields.pin.value.trim() : s.pin,
      logoDataUrl: logoDataUrl === null ? s.logoDataUrl : logoDataUrl,
    };
    if (!saveSettings(next)) {
      toast('Penyimpanan penuh, pengaturan tidak bisa disimpan.', 'error');
      return;
    }
    applyTheme(next);
    onSaved(next);
    toast('Pengaturan tersimpan.', 'success');
    dialog.close();
    unlocked = false;
  });

  for (const button of document.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  }
  for (const dialogEl of document.querySelectorAll('dialog')) {
    dialogEl.addEventListener('click', (event) => {
      if (event.target === dialogEl) dialogEl.close();
    });
  }
}
