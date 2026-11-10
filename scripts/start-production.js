/**
 * Titik masuk produksi lintas platform.
 *
 * `NODE_ENV=production npm start` tidak portable di PowerShell, jadi skrip ini
 * menetapkan environment sebelum memuat server. Jalankan setelah `npm run build`.
 */
process.env.NODE_ENV = 'production';
await import('../server/index.js');
