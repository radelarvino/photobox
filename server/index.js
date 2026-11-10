import { createApp, purgeExpiredPhotos } from './app.js';
import { loadConfig } from './config.js';
import { networkInterfaces } from 'node:os';
import { RETENTION_DAYS } from './storage.js';
import db from './db.js';

const config = loadConfig();
const app = createApp(config);

function localAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const server = app.listen(config.port, config.host, () => {
  const lan = localAddress();
  console.log('');
  console.log('  📸  Photobox Web siap dipakai');
  if (config.production) {
    console.log(`      Mode    : produksi (${config.host}:${config.port})`);
    if (config.publicOrigin) console.log(`      Publik  : ${config.publicOrigin}`);
  } else {
    console.log(`      Lokal   : http://localhost:${config.port}`);
    if (lan) console.log(`      Jaringan: http://${lan}:${config.port}  (uji di ponsel)`);
  }
  console.log('');
  console.log('  Catatan: kamera browser hanya aktif di localhost atau HTTPS.');
  console.log(`  Retensi foto: ${RETENTION_DAYS} hari (otomatis dibersihkan).`);
  console.log('');
  purgeExpiredPhotos();
});

const timer = setInterval(purgeExpiredPhotos, 6 * 60 * 60_000);
timer.unref();

/** Tutup koneksi dan database dengan rapi agar deploy tidak memutus foto aktif. */
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[photobox] ${signal} diterima, menutup server…`);
  clearInterval(timer);
  server.close(() => {
    try {
      db.close();
    } catch {
      // Database mungkin sudah tertutup.
    }
    process.exit(0);
  });
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
