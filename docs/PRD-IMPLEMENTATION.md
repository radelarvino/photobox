# Implementasi PRD Photobox Web

Dokumen ini memetakan kebutuhan pada `PRD Website Photobox.docx` ke implementasi di repositori, termasuk keputusan teknis, penyimpangan yang disengaja, dan hal yang masih terbuka.

## 1. Ringkasan Cakupan

MVP yang dibangun mencakup **F1–F11**, termasuk fitur P2 multi-cetak.

Alur utama:

1. Beranda → buka tirai → pengaturan.
2. Pilih kertas, mode multi-cetak bila tersedia, jumlah pose, dan border.
3. Ambil foto dengan hitung mundur 3 detik, ulang per pose, atau unggah foto.
4. Pilih filter dan intensitas pada layar hasil.
5. Tambahkan stiker/teks bila diinginkan, lalu atur posisi, ukuran, rotasi, atau hapus.
6. Simpan ke galeri dan/atau unduh PNG, JPG, atau PDF.
7. Kelola foto tersimpan di galeri.

## 2. Matriks Kebutuhan Fungsional

| ID | Kebutuhan PRD | Implementasi | Status |
| --- | --- | --- | --- |
| F1 | Pratinjau kamera, pilih kamera depan/belakang, tangani izin ditolak | `public/js/camera.js`, `public/js/main.js`; `describeCameraError()` memberi pesan spesifik; tombol ulang, unggah, dan ganti kamera | Selesai |
| F2 | Hitung mundur 3 detik, 1–4 pose, ulang per pose | `takePhoto()`, `animateCountdown()`, `retakePose()`, `resetShots()`; batas pose mengikuti kertas | Selesai |
| F3 | Minimal 10 border, pratinjau langsung | 12 border vektor di `server/catalog.js` dan `public/js/borders.js`; thumbnail carousel dirender dari kanvas | Selesai (melebihi minimum) |
| F4 | Minimal 8 filter, intensitas diatur | 10 filter di `server/catalog.js`; slider 0–100% di layar hasil; filter yang sama dipakai untuk pratinjau dan render penuh | Selesai (melebihi minimum) |
| F5 | Pilih ukuran kertas, tata letak otomatis | 3R, 4R, 5R, A4, Strip 2×6 di `paperSizes`; `computeLayout()` menyesuaikan grid/strip, gap, margin, dan radius | Selesai |
| F6 | Simpan ke galeri dengan border, filter, ukuran | `POST /api/photos` menyimpan berkas + metadata; tabel `photos`; galeri membaca ulang dari server | Selesai |
| F7 | Unduh PNG/JPG 300 DPI, opsi PDF siap cetak | `public/js/export.js`: patch `pHYs` PNG, densitas JFIF JPEG, PDF satu halaman dengan `MediaBox` sesuai mm | Selesai |
| F8 | Galeri: lihat, unduh ulang, hapus | `GET /api/photos`, lightbox, `downloadSaved()`, `deleteSaved()`; konfirmasi sebelum hapus | Selesai |
| F9 | Unggah foto jika kamera tidak tersedia | Input berkas, seret-lepas ke area kamera, `Camera.canvasFromFile()`, validasi tipe/ukuran di klien dan server | Selesai |
| F10 | Stiker dan teks | `public/js/overlays.js` menyediakan 12 stiker vektor dan teks berwarna; editor di layar hasil mendukung tambah, geser, ukuran, rotasi, hapus, dan keyboard; `renderSheet()` merasterisasi hiasan ke pratinjau, galeri, dan semua ekspor | Selesai |
| F11 | Multi-cetak | `public/js/multi.js` mendefinisikan mode dan geometri; `renderMultiSheet()` merender desain sekali lalu menyalinnya ke grid terpusat. 4R: 2 strip 2×6; A4: 2 foto 4R atau 4 foto 3R; semua salinan identik termasuk border, filter, dan hiasan | Selesai |

## 3. Kebutuhan Non-Fungsional

| Aspek | Target PRD | Implementasi |
| --- | --- | --- |
| Performa | Beranda ≤ 3 detik di 4G; filter pratinjau ≥ 24 fps | Aset tanpa CDN, font WOFF2 lokal (575 KB) dengan preload font kritis, respons HTML/CSS/JS dikompres gzip, thumbnail border dirender saat layar pengaturan pertama dibuka, pratinjau maksimal 900 px sisi terpanjang, filter memakai `CanvasRenderingContext2D.filter` native; render 300 DPI hanya saat simpan/unduh. Lighthouse 12 seluler: performa 98, LCP 2,3 dtk, TBT 30 ms |
| Kualitas cetak | 300 DPI, warna dan margin konsisten | Kanvas penuh sesuai piksel kertas; margin aman 3 mm; cover crop; filter yang sama untuk pratinjau/hasil; metadata DPI disisipkan ke PNG/JPG |
| Kompatibilitas | Chrome, Safari, Firefox, Edge; Android/iOS; 360 px–desktop | Layout responsif 360 px, 480 px, 720 px, 980 px; cadangan pemrosesan piksel bila `ctx.filter` tidak didukung; `crypto.randomUUID` memiliki fallback |
| Privasi | Foto diproses setelah izin; bisa dihapus | Kamera hanya aktif setelah izin; pratinjau tidak dikirim; foto hanya diunggah saat simpan; hapus manual + retensi otomatis |
| Keamanan | HTTPS, validasi tipe/ukuran, rate limit | Header CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; whitelist MIME PNG/JPG; batas 20 MB; rate limit baca 240/menit dan tulis 80/jam |
| Penyimpanan | Maksimal 30 hari | `expires_at` disimpan per foto; `purgeExpiredPhotos()` saat boot dan setiap 6 jam; `PHOTOBOX_RETENTION_DAYS` dapat mengubah durasi |
| Aksesibilitas | Tombol besar, kontras, sentuhan | Target sentuh besar, `aria-label`, `role="radiogroup"`, fokus dipindah ke judul layar, dukungan tombol spasi untuk rana, pratinjau hasil dapat difokuskan dengan panah/Delete untuk hiasan, pengumuman `aria-live`, `prefers-reduced-motion` |

Catatan HTTPS: akses kamera browser hanya tersedia di localhost atau origin HTTPS. Ini batasan browser, bukan bug aplikasi. Petunjuk ada di `README.md`.

## 4. Keputusan Teknis

### 4.1 SQLite, bukan MongoDB

PRD memberi ruang untuk SQLite atau MongoDB. SQLite dipilih karena MVP berjalan satu proses, tidak memerlukan layanan eksternal, dan dapat memakai `node:sqlite` bawaan Node.js 22.5+ sehingga tidak ada dependensi native. Data disimpan di `data/photobox.db`.

### 4.2 Border vektor, bukan PNG transparan

PRD menyebut border ditumpuk sebagai PNG transparan. Implementasi memilih **renderer vektor** di kanvas pada resolusi penuh agar:

- garis dan teks tetap tajam di semua ukuran kertas;
- tidak perlu mengunduh aset besar;
- parameter border dapat diubah dari katalog database.

Kolom `borders.file_gambar` tetap tersedia agar border berbasis gambar bisa ditambahkan kemudian tanpa migrasi skema.

### 4.3 Satu sumber kebenaran untuk filter

String CSS filter disimpan di database dan dipakai untuk preview (`ctx.filter`) maupun render penuh. Bila peramban tidak mendukung `ctx.filter`, `applyFilterPixels()` menerapkan transformasi yang setara pada data piksel. Intensitas dicampurkan dengan foto asli.

### 4.4 PDF tanpa dependensi

PDF ditulis manual: satu halaman, satu gambar JPEG `DCTDecode`, `MediaBox` dalam titik yang dihitung dari milimeter. Tidak ada pustaka PDF tambahan dan tidak ada penskalaan otomatis oleh pembaca PDF.

### 4.5 Sesi anonim

Frontend membuat UUID dan menyimpannya di `localStorage` (`photobox.session.v1`). Setiap permintaan API menyertakan `X-Session-Id`. Server memvalidasi format UUID dan mengikat setiap baris foto ke sesi tersebut. Tidak ada cookie, login, atau email.

### 4.6 Hiasan sebagai lapisan klien

Stiker dan teks disimpan di state klien sebagai koordinat ternormalisasi 0–1 terhadap lebar/tinggi kertas, sehingga pratinjau (maksimal 900 px) dan render 300 DPI memakai susunan yang sama. Tidak ada perubahan skema database: hiasan langsung dirasterisasi ke kanvas penuh saat pratinjau, simpan galeri, dan ekspor. Konsekuensinya, hiasan tidak dapat diedit ulang dari galeri karena gambar tersimpan sudah menjadi satu berkas datar. Batas 12 hiasan per foto menjaga keterbacaan dan performa.

### 4.7 Multi-cetak dengan tiling klien

Lembar keluaran tetap mengikuti kertas yang dipilih agar validasi server dan metadata DPI tidak berubah. Desain kecil (Strip, 3R, atau 4R) dirender sekali pada resolusi 300 DPI, lalu disalin ke petak yang dihitung `computeTiles()` dan dipusatkan pada lembar keluaran dengan latar putih. Koordinat hiasan tetap ternormalisasi terhadap desain, sehingga satu hiasan otomatis muncul identik di semua salinan; klik dan geser dipetakan ke petak yang disentuh, sedangkan kotak seleksi hanya digambar pada petak aktif. Tidak ada kolom database baru karena `paper_size_id`, `lebar_px`, `tinggi_px`, dan `dpi` tetap menggambarkan lembar fisik.

## 5. Penyimpangan dan Batasan yang Disengaja

| Hal | Keputusan |
| --- | --- |
| Salinan multi-cetak | Salinan identik; tidak ada opsi mencampur pose berbeda dalam satu lembar. Mode tersedia hanya untuk 4R dan A4 sesuai PRD. |
| Aturan jumlah pose | PRD menulis 1–4 untuk 3R/4R/5R, 1–4 untuk A4, dan 3–4 untuk strip. Pada multi-cetak, batas pose mengikuti desain kecil: strip 3–4, 4R/3R 1–4. Server memakai batas kertas keluaran. |
| Border PNG transparan | Diganti vektor; kolom database tetap disiapkan untuk gambar. |
| Warna cetak | Aplikasi tidak menyertakan profil ICC. Warna mengikuti ruang sRGB browser; hasil cetak bergantung pada printer dan kertas. |
| Penyimpanan | Berkas disimpan di disk lokal. Untuk produksi multi-instans, gunakan object storage dan database terpusat. |
| Format unggahan | Klien menerima `image/*`, tetapi server hanya menerima PNG/JPG untuk hasil simpan. Format seperti HEIC dapat gagal dibaca di browser tertentu. |
| Retensi | Default 30 hari; dapat dikonfigurasi. Penghapusan berjalan saat boot dan setiap 6 jam, bukan tepat pada detik kedaluwarsa. |

## 6. Struktur Data

Tabel utama:

- `sessions`: `id`, `created_at`, `last_seen`
- `borders`: `id`, `nama`, `kategori`, `file_gambar`, `aktif`, `style`, `params`, `urutan`
- `filters`: `id`, `nama`, `params`, `aktif`, `urutan`
- `paper_sizes`: `id`, `nama`, `lebar_mm`, `tinggi_mm`, `dpi`, `layout`, `poses_min`, `poses_max`
- `photos`: `id`, `session_id`, `border_id`, `filter_id`, `paper_size_id`, `file_path`, `thumb_path`, `lebar_px`, `tinggi_px`, `dpi`, `jumlah_pose`, `intensitas`, `created_at`, `expires_at`

Relasi `photos.session_id` memakai `ON DELETE CASCADE`; `photos` juga memiliki indeks untuk sesi dan waktu kedaluwarsa.

## 7. Validasi Server

`POST /api/photos` menolak:

- sesi tanpa UUID valid (`400 INVALID_SESSION`);
- berkas yang hilang (`400 FILE_REQUIRED`);
- MIME selain PNG/JPG (`415 UNSUPPORTED_MEDIA_TYPE`);
- berkas > 20 MB (`413 FILE_TOO_LARGE`);
- border, filter, atau kertas yang tidak dikenal (`422`);
- DPI yang tidak sesuai kertas (`422 INVALID_DPI`);
- dimensi yang tidak sesuai kertas (`422 INVALID_DIMENSIONS`);
- dimensi berkas yang tidak cocok dengan metadata (`422 DIMENSION_MISMATCH`);
- jumlah pose di luar rentang (`422 INVALID_POSE_COUNT`);
- intensitas di luar 0–1 (`422 INVALID_INTENSITY`).

Berkas yang sudah ditulis tetapi gagal validasi dihapus kembali.

## 8. Pengujian

Tes otomatis:

```bash
npm test
```

Mencakup:

- health dan katalog (12 border, 10 filter, 5 kertas);
- validasi sesi;
- seluruh aturan validasi unggahan;
- batas 20 MB;
- simpan, daftar, unduh, isolasi antarsesi, dan hapus;
- mode multi-cetak (daftar mode, fallback, geometri 4R dua strip, A4 dua 4R, A4 empat 3R, pembulatan skala pratinjau, dan penolakan susunan yang tidak muat);
- header keamanan, request ID, cache API/aset, 404 JSON ber-requestId, redirect 308 ke HTTPS, dan HSTS di belakang proxy;
- validasi environment (`PORT`, `PUBLIC_ORIGIN`, `HSTS_MAX_AGE`, `LOG_REQUESTS`, `TRUST_PROXY`, boolean);
- build aset: hash deterministik, penulisan ulang referensi HTML/CSS/JS, manifest, dan penolakan folder tujuan yang salah;
- kebersihan direktori sementara setelah tes.

Pengujian manual yang sudah dilakukan:

- alur beranda → pengaturan → kamera → hasil;
- unggah 4 foto dan render Polaroid 4R;
- filter Sepia dengan intensitas 70%;
- unduh PNG 1200 × 1800 dengan `pHYs` 300 DPI;
- unduh JPG 1200 × 1800 dengan densitas JFIF 300 DPI;
- unduh PDF dengan `MediaBox` 288 × 432 pt (4 × 6 inci);
- simpan ke galeri, buka lightbox, unduh ulang, dan hapus;
- F10: tambah teks dan stiker, geser dengan pointer, ubah ukuran (14% → 26%), rotasi, ganti warna, perbarui teks, dan hapus;
- F10: hit-test setelah geser memastikan hiasan mengikuti posisi baru; tombol panah menggeser dan Delete menghapus saat pratinjau fokus;
- F10: batas 12 hiasan menampilkan pesan “Maksimal 12 hiasan per foto.”;
- F10: PNG/JPG 1200 × 1800 px tetap 300 DPI, PDF 288 × 432 pt, dan teks/stiker terlihat pada berkas ekspor maupun gambar galeri tanpa kotak pilihan;
- F10: axe-core 4.10.2 pada layar hasil desktop dan mobile: 0 pelanggaran WCAG 2.0/2.1 A/AA, tanpa error konsol;
- F11: 4R dua strip menghasilkan lembar 1200 × 1800 px berisi dua strip identik; A4 dua 4R dan A4 empat 3R menghasilkan 2480 × 3508 px dengan grid terpusat dan margin putih;
- F11: hiasan muncul identik di semua petak, hit-test dan geser bekerja pada petak yang disentuh, dan kotak seleksi hanya tampil di petak aktif;
- F11: PNG/JPG 300 DPI, PDF 4R 288 × 432 pt, PDF A4 595,28 × 841,89 pt, serta berkas galeri berisi lembar penuh;
- F11: tampilan pengaturan tetap rapi di 360 px (tanpa luapan horizontal), pemindaian axe-core 4.10.2 pada pengaturan 4R strip dan hasil A4 mobile: 0 pelanggaran, tanpa error konsol;
- tampilan kamera pada layar pendek dengan pesan izin ditolak;
- QA visual headless 360 × 800 dan 1366 × 900 dengan kamera palsu: tanpa luapan horizontal, Strip 2×6 menghasilkan 600 × 1800 px, A4 menghasilkan 2480 × 3508 px, bilah aksi pengaturan tidak lagi menutupi teks;
- pemindaian axe-core 4.10 pada beranda, pengaturan, dialog privasi, kamera, hasil, dan galeri: 0 pelanggaran WCAG 2.0/2.1 A/AA;
- Lighthouse 12 (emulasi seluler): performa 98, aksesibilitas 100, best practices 100, SEO 100; LCP 2,3 dtk, TBT 30 ms, CLS 0,005;
- `prefers-reduced-motion` mematikan animasi/transisi, tombol spasi memicu hitung mundur, fokus dialog kembali ke tombol pemicu setelah Escape, dan tidak ada error konsol.

## 9. Pertanyaan Terbuka dan Langkah Berikutnya

1. **Login/akun**: bila galeri perlu lintas perangkat, sesi anonim harus diganti autentikasi dan storage terpusat.
2. **Object storage**: untuk produksi, pindahkan berkas dari disk lokal ke S3/R2 dan gunakan URL bertanda tangan.
3. **Profil warna**: bila target cetak menuntut akurasi warna, tambahkan konversi ke profil printer dan uji cetak fisik.
4. **Pembersihan retensi**: saat ini berbasis interval; untuk jaminan lebih ketat, tambahkan job scheduler terpisah.
5. **Edit ulang hiasan dari galeri**: saat ini hiasan sudah dirasterisasi; bila perlu diedit ulang, simpan juga data lapisan terpisah di database.
6. **Label multi-cetak di galeri**: metadata foto belum menyimpan mode salinan; tambahkan kolom bila galeri perlu menampilkan “2 strip” atau “4 foto 3R”.

## 10. Pengerasan Produksi

### Build aset ber-hash

`npm run build` menjalankan `scripts/build.js`:

1. menyalin seluruh `public/` ke `dist/`;
2. menghitung hash SHA-256 8 karakter untuk CSS, JS, font, SVG, PNG, JPG, WebP, dan ICO;
3. menulis ulang `href`/`src` di HTML, `url(...)` di CSS, serta import relatif ES module di JS;
4. menulis `dist/asset-manifest.json` berisi pemetaan nama asli ke nama ber-hash.

Build bersifat deterministik: sumber yang sama menghasilkan nama dan isi yang sama. Folder tujuan tidak boleh sama dengan atau berada di dalam folder sumber. Produksi menolak startup bila `dist/index.html` tidak ada.

### Penyajian dan cache

- Produksi menyajikan `dist`; pengembangan tetap menyajikan `public` agar tidak perlu build setiap perubahan.
- Berkas ber-hash: `Cache-Control: public, max-age=31536000, immutable`.
- `index.html` dan berkas non-hash: `no-cache`.
- API: `Cache-Control: no-store` dan `Vary: X-Session-Id`.
- Thumbnail dan unduhan tetap `private` karena hanya milik sesi terkait.
- Kompresi gzip tetap aktif untuk HTML/CSS/JS/JSON.

### Header keamanan

CSP sekarang menambahkan `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`, dan `manifest-src 'self'`. Header lain: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `X-Permitted-Cross-Domain-Policies: none`, `Cross-Origin-Resource-Policy: same-origin`, serta `Permissions-Policy` yang mematikan mikrofon, geolokasi, dan pembayaran.

HSTS hanya dikirim bila permintaan sudah HTTPS (`req.secure`), sehingga uji lokal HTTP tidak mengunci browser. Nilai default `max-age=31536000; includeSubDomains`.

### HTTPS dan reverse proxy

- `FORCE_HTTPS=1` mengalihkan permintaan non-HTTPS dengan status **308**.
- `PUBLIC_ORIGIN` harus URL HTTPS lengkap dan dipakai sebagai tujuan redirect.
- `TRUST_PROXY` menerima `1`/`true`, jumlah hop, `false`, atau subnet Express agar `req.secure` dan `req.ip` benar di belakang proxy.
- Proxy wajib meneruskan `X-Forwarded-Proto` (dan `X-Forwarded-For` bila memakai batas laju per IP).

### Logging, request ID, dan error

- Setiap respons memiliki `X-Request-Id`. ID klien dipakai hanya bila cocok `^[A-Za-z0-9._-]{8,64}$`; selain itu dibuat UUID.
- Log ditulis satu baris JSON berisi waktu, level, requestId, metode, path, status, dan durasi.
- Mode `off`, `errors`, `auto`, dan `all`; default `errors` di pengembangan dan `auto` di produksi.
- Error 5xx dicatat lengkap dengan stack, tetapi respons ke pengguna hanya berisi pesan umum dan `requestId`.
- Endpoint API tak dikenal menghasilkan JSON 404 ber-requestId; halaman non-API tetap teks biasa.

### Operasional

- Konfigurasi divalidasi saat startup melalui `server/config.js`; nilai salah membuat proses berhenti dengan pesan jelas.
- `SIGTERM`/`SIGINT` menutup server HTTP dan SQLite dengan rapi, menghapus interval retensi, lalu memaksa keluar setelah 10 detik bila perlu.
- Pembatas laju menyapu entri kedaluwarsa paling sering sekali per menit agar memori tidak tumbuh tanpa batas.
- `npm run start:prod` menetapkan `NODE_ENV=production` secara lintas platform.

### Hasil QA

- 33 tes otomatis lulus (`node --test`).
- Build: 33 berkas, 32 aset ber-hash, seluruh referensi manifest merespons 200.
- Uji asap Chrome headless pada build produksi: 18 aset ber-hash dimuat, tidak ada aset tanpa hash, font `loaded`, 12 border + 5 kertas tampil, tanpa error konsol.
- Header terverifikasi: aset ber-hash `immutable`, index `no-cache`, API `no-store`, redirect 308 dan HSTS sesuai konfigurasi proxy.
- Lighthouse 12.8.2 emulasi seluler: performa 97 (median 3 run), aksesibilitas 100, best practices 100, SEO 100; LCP 2,4 dtk, TBT 10–20 ms, CLS 0, transfer 220 KiB.
- Database QA tetap bersih (`photos: 0`).

### Batasan yang masih tersisa

- Pembatas laju masih per proses; deployment multi-instance memerlukan Redis atau penyimpanan bersama.
- Berkas foto masih di disk lokal; untuk skala produksi sebaiknya pindah ke object storage dengan URL bertanda tangan.
- Belum ada health check terpisah untuk load balancer selain `GET /api/health`.
- Rotasi log dan pengiriman ke agregator (misalnya Loki/CloudWatch) masih tanggung jawab platform.
