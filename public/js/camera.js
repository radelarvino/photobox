/** Akses kamera, pemilihan perangkat, dan pengambilan bingkai. */

const MAX_UPLOAD_SIDE = 2200;

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.devices = [];
    this.facing = 'user';
    this.mirrored = true;
    this.label = '';
    this.deviceId = null;
  }

  get ready() {
    return Boolean(this.stream && this.video.videoWidth > 0);
  }

  async start({ facing = this.facing, deviceId = null } = {}) {
    await this.stop();
    this.facing = facing;
    this.deviceId = deviceId;

    const video = {
      width: { ideal: 1280 },
      height: { ideal: 960 },
      frameRate: { ideal: 30, max: 60 },
    };
    if (deviceId) video.deviceId = { exact: deviceId };
    else video.facingMode = { ideal: facing };

    this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    this.video.srcObject = this.stream;
    this.video.classList.remove('is-hidden');
    await this.video.play().catch(() => {});

    await this.videoReady();
    await this.refreshDevices();

    const track = this.stream.getVideoTracks()[0];
    this.label = track?.label ?? '';
    if (!deviceId) {
      this.mirrored = facing === 'user';
    } else {
      this.mirrored = /front|depan|user/i.test(this.label)
        ? true
        : /back|rear|belakang|environment/i.test(this.label)
          ? false
          : this.mirrored;
    }
    this.applyMirror();
    return this.stream;
  }

  videoReady() {
    if (this.video.videoWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        this.video.removeEventListener('loadedmetadata', done);
        resolve();
      };
      this.video.addEventListener('loadedmetadata', done, { once: true });
      setTimeout(done, 2200);
    });
  }

  async refreshDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter((device) => device.kind === 'videoinput');
    } catch {
      this.devices = [];
    }
  }

  applyMirror() {
    this.video.classList.toggle('is-not-mirrored', !this.mirrored);
  }

  async switchCamera() {
    const track = this.stream?.getVideoTracks()[0];
    const currentId = track?.getSettings().deviceId;

    if (this.devices.length > 1) {
      const index = this.devices.findIndex((device) => device.deviceId === currentId);
      const next = this.devices[(index + 1) % this.devices.length];
      await this.start({ facing: this.facing, deviceId: next.deviceId });
      return this.label;
    }

    const nextFacing = this.facing === 'user' ? 'environment' : 'user';
    await this.start({ facing: nextFacing });
    return this.label;
  }

  capture() {
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (!width || !height) throw new Error('Kamera belum siap. Coba lagi.');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (this.mirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, 0, 0, width, height);
    return canvas;
  }

  /** Foto dari galeri perangkat sebagai pengganti kamera (F9). */
  static async canvasFromFile(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Berkas harus berupa gambar.');
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error('Ukuran gambar maksimal 20 MB.');
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Gambar tidak bisa dibaca.'));
        };
        image.src = url;
      });
    }

    const width = bitmap.width;
    const height = bitmap.height;
    const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas;
  }

  async stop() {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    this.video.srcObject = null;
    this.video.classList.add('is-hidden');
  }
}

export function describeCameraError(error) {
  const name = error?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      title: 'Izin kamera ditolak',
      message: 'Beri izin kamera di pengaturan situs, lalu coba lagi. Kamu juga bisa memakai foto dari galeri perangkat.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      title: 'Kamera tidak ditemukan',
      message: 'Perangkat ini tidak punya kamera yang bisa dipakai. Unggah foto dari galeri sebagai gantinya.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      title: 'Kamera sedang dipakai',
      message: 'Tutup aplikasi lain yang memakai kamera (misalnya video call), lalu tekan coba lagi.',
    };
  }
  if (name === 'TypeError' || !navigator.mediaDevices) {
    return {
      title: 'Kamera tidak didukung',
      message: 'Peramban ini belum mendukung akses kamera, atau halaman dibuka tanpa HTTPS.',
    };
  }
  return {
    title: 'Kamera gagal dibuka',
    message: error?.message ?? 'Terjadi kendala saat menyalakan kamera. Coba lagi atau unggah foto.',
  };
}
