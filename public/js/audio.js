/** Efek suara disintesis dengan Web Audio — tanpa berkas audio eksternal. */

const MUTE_KEY = 'photobox.muted.v1';

export class Sound {
  constructor() {
    this.enabled = localStorage.getItem(MUTE_KEY) !== '1';
    this.ctx = null;
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    try {
      localStorage.setItem(MUTE_KEY, this.enabled ? '0' : '1');
    } catch {
      // abaikan
    }
    if (this.enabled) this.click();
  }

  tone({ frequency = 880, duration = 0.12, type = 'sine', volume = 0.12, delay = 0, sweep = null }) {
    if (!this.enabled) return;
    const ctx = this.unlock();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(sweep, start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  click() {
    this.tone({ frequency: 620, duration: 0.055, type: 'triangle', volume: 0.07 });
  }

  beep(final = false) {
    this.tone({
      frequency: final ? 1320 : 880,
      duration: final ? 0.18 : 0.1,
      type: 'sine',
      volume: 0.1,
    });
  }

  shutter() {
    if (!this.enabled) return;
    const ctx = this.unlock();
    if (!ctx) return;

    const length = Math.floor(ctx.sampleRate * 0.1);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;

    const gain = ctx.createGain();
    gain.gain.value = 0.22;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();

    this.tone({ frequency: 320, duration: 0.08, type: 'square', volume: 0.05 });
  }

  cheer() {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.22,
        type: 'triangle',
        volume: 0.09,
        delay: index * 0.08,
      });
    });
  }

  error() {
    this.tone({ frequency: 200, duration: 0.22, type: 'sawtooth', volume: 0.06, sweep: 140 });
  }
}
