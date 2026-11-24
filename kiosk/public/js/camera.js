/** Akses kamera dengan penanganan izin dan error yang jelas. */
import { drawCover } from './image.js';

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.facing = 'user';
    this.mirror = true;
    this.error = null;
  }

  get active() {
    return Boolean(this.stream && this.video.videoWidth);
  }

  async start(facing = this.facing) {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser ini tidak mendukung kamera. Gunakan perangkat lain atau unggah foto.');
    }
    if (!window.isSecureContext) {
      throw new Error('Kamera hanya bisa dipakai di HTTPS atau localhost.');
    }

    const constraints = {
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (raw) {
      // Beberapa perangkat menolak constraint ideal; coba tanpa facingMode.
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (fallbackError) {
        throw new Error(this.messageFor(fallbackError ?? raw));
      }
    }

    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch {
      // autoplay bisa ditunda; video tetap siap setelah interaksi pengguna.
    }
    this.facing = facing;
    this.mirror = facing === 'user';
    this.error = null;
    return this.active;
  }

  messageFor(error) {
    switch (error?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Izin kamera ditolak. Buka ikon gembok di address bar, izinkan kamera, lalu coba lagi.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'Kamera tidak ditemukan di perangkat ini. Kamu tetap bisa mengunggah foto.';
      case 'NotReadableError':
        return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
      default:
        return `Kamera gagal dibuka: ${error?.message ?? 'kesalahan tidak diketahui'}.`;
    }
  }

  async flip() {
    const next = this.facing === 'user' ? 'environment' : 'user';
    await this.start(next);
    return this.facing;
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
  }

  /**Jepret satu frame ke kanvas berukuran petak foto. */
  capture(width, height, filterCss = 'none') {
    if (!this.active) throw new Error('Kamera belum siap.');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ded8ce';
    ctx.fillRect(0, 0, width, height);
    ctx.filter = filterCss === 'none' ? 'none' : filterCss;
    drawCover(ctx, this.video, 0, 0, width, height, this.mirror);
    ctx.filter = 'none';
    return canvas;
  }
}
