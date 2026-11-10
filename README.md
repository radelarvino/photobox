# Photobox Web

Photobooth di browser untuk mengambil 1–4 pose, memilih border dan filter, menambahkan stiker/teks, lalu menyimpan atau mengunduh hasil siap cetak 300 DPI. Semua antarmuka dan pesan memakai bahasa Indonesia.

![Photobox](public/assets/favicon.svg)

## Fitur

- **Kamera langsung** dengan pratinjau, pilihan kamera depan/belakang, dan penanganan izin ditolak.
- **Hitung mundur 3 detik**, mode 1–4 pose, ulang per pose, serta pintasan tombol spasi.
- **12 border** yang digambar sebagai vektor pada resolusi penuh: Polos, Polaroid, Hati, Bintang, Awan, Retro Film, Ulang Tahun, Pernikahan, Kampus, Konfeti, Retro 70an, dan Poskad.
- **10 filter** dengan pengatur intensitas: Normal, Hitam Putih, Sepia, Vintage, Cerah, Pastel, Hangat, Dingin, Film, dan Fade.
- **5 ukuran kertas**: 3R, 4R, 5R, A4, dan Strip 2×6 inci.
- **Multi-cetak** untuk mengisi satu lembar dengan beberapa salinan identik: 4R bisa berisi 2 strip 2×6, A4 bisa berisi 2 foto 4R atau 4 foto 3R dalam grid 2×2.
- **12 stiker vektor** (hati, bintang, kilau, senyum, bunga, balon, mahkota, matahari, pelangi, tapak, kamera, ceri) dan **teks berwarna** yang bisa digeser, diubah ukuran, diputar, dan dihapus langsung di pratinjau. Hiasan ikut ter-render di pratinjau, galeri, dan semua ekspor.
- **Galeri perangkat** untuk melihat ulang, mengunduh ulang, dan menghapus foto.
- **Unduhan PNG, JPG, dan PDF** dengan metadata 300 DPI; ukuran halaman PDF sama persis dengan kertas.
- **Unggah foto** dari galeri perangkat, termasuk seret-lepas ke area kamera, saat kamera tidak tersedia.
- **Sesi anonim** lewat UUID di `localStorage`; tidak perlu akun atau email.
- **Retensi 30 hari** dengan pembersihan otomatis di server.

### Di luar cakupan saat ini (P2)

Login/akun lintas perangkat belum termasuk. Struktur data dan UI sudah disiapkan agar fitur tersebut bisa ditambahkan tanpa membongkar alur utama.

### Mengatur multi-cetak

1. Di layar **Atur hasil cetakmu**, pilih kertas **4R** atau **A4**.
2. Kartu **Multi-cetak** muncul di bawah ukuran kertas. Pilih **2 strip 2×6** pada 4R, atau **2 foto 4R** / **4 foto 3R** pada A4.
3. Jumlah pose mengikuti desain yang dipakai: strip butuh 3–4 pose, desain 4R dan 3R mendukung 1–4 pose.
4. Semua salinan identik. Border, filter, dan hiasan yang sama diterapkan ke setiap salinan; menggeser hiasan di satu petak mengubah semua petak.
5. Hasil unduhan tetap satu lembar penuh sesuai kertas keluar, siap dipotong.

### Menambah hiasan

1. Di layar **Hasil fotomu**, tulis ucapan pada kolom teks lalu pilih **Tambah teks**, atau ketuk salah satu stiker.
2. Geser hiasan langsung pada pratinjau. Saat hiasan terpilih, gunakan pengatur **Ukuran**, tombol **Kiri/Kanan** untuk memutar, dan **Hapus**.
3. Pilih warna teks lewat empat swatch sebelum menambah atau saat teks terpilih.
4. Hiasan otomatis ikut tersimpan ke galeri dan ter-render pada unduhan PNG, JPG, dan PDF.

Maksimal 12 hiasan per foto. Untuk pengguna keyboard, fokuskan pratinjau lalu gunakan tombol panah (Shift untuk langkah lebih besar) dan Delete.

## Teknologi

| Lapisan | Pilihan |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript ES modules, Canvas 2D |
| Backend | Node.js + Express |
| Database | SQLite melalui `node:sqlite` bawaan Node.js (tanpa dependensi native) |
| Unggahan | Multer, maksimal 20 MB per berkas |
| Kompresi | `compression` (gzip) untuk HTML/CSS/JS |
| Font | Baloo 2 dan Nunito, di-host sendiri |
| Build produksi | `scripts/build.js`: hash SHA-256 nama aset, manifest, dan cache immutable |

Tidak ada framework frontend, CDN, atau layanan gambar eksternal. Seluruh render foto dilakukan di browser; server hanya menyimpan hasil dan metadata.

## Menjalankan

Prasyarat: **Node.js 22.5 atau lebih baru** (dibutuhkan untuk `node:sqlite`).

```bash
npm install
npm start
```

Buka <http://localhost:3000>. Saat dijalankan, server juga menampilkan alamat jaringan lokal untuk pengujian di ponsel.

Untuk pengembangan dengan muat ulang otomatis, gunakan `npm run dev`.

### Build dan menjalankan produksi

```bash
npm run build       # public/ → dist/ dengan nama aset ber-hash
npm run start:prod  # menjalankan NODE_ENV=production
```

Build menyalin `public/` ke `dist/`, mengganti nama CSS, JS, font, dan ikon dengan hash konten, lalu menulis ulang referensi di HTML/CSS/JS. Hasilnya juga mencatat pemetaan di `dist/asset-manifest.json`. Produksi **wajib** memakai hasil build; bila `dist/index.html` tidak ada, server berhenti dengan pesan yang jelas agar tidak menyajikan aset basi.

- Berkas ber-hash dikirim dengan `Cache-Control: public, max-age=31536000, immutable`.
- `index.html` dan berkas non-hash memakai `no-cache` agar versi baru langsung terlihat.
- Respons API memakai `no-store` dan `Vary: X-Session-Id` karena data foto bersifat privat per sesi.
- Server menutup koneksi HTTP dan SQLite dengan rapi saat menerima `SIGTERM`/`SIGINT` (misalnya saat deploy atau restart container).

Contoh menjalankan langsung di server:

```bash
npm ci
npm run build
PORT=8080 PUBLIC_ORIGIN=https://photobox.example.com TRUST_PROXY=1 npm run start:prod
```

### HTTPS di belakang reverse proxy

Kamera browser membutuhkan HTTPS. Letakkan Photobox di belakang reverse proxy (Caddy, nginx, atau load balancer) yang menangani TLS, lalu aktifkan:

```bash
FORCE_HTTPS=1
PUBLIC_ORIGIN=https://photobox.example.com
TRUST_PROXY=1
```

Proxy harus meneruskan header `X-Forwarded-Proto`. Dengan konfigurasi ini, permintaan HTTP dialihkan permanen (308) ke origin publik, dan HSTS hanya dikirim pada permintaan yang sudah HTTPS. `TRUST_PROXY` juga menerima jumlah hop (misalnya `2`) atau subnet Express (misalnya `loopback`) bila topologi proxy berbeda.

### Catatan kamera dan HTTPS

Browser hanya mengizinkan `getUserMedia` pada **localhost** atau **HTTPS**. Membuka `http://<IP-LAN>:3000` dari ponsel akan menampilkan pesan izin kamera ditolak; gunakan salah satu opsi berikut:

1. Uji di komputer melalui `http://localhost:3000`.
2. Jalankan reverse proxy HTTPS dengan sertifikat tepercaya (misalnya `mkcert` atau Caddy).
3. Gunakan tunnel HTTPS sementara (misalnya `ngrok` atau `cloudflared`) untuk demo di perangkat lain.

Tombol **Unggah foto** tetap bisa dipakai tanpa kamera.

## Konfigurasi

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP server (1–65535) |
| `HOST` | `0.0.0.0` | Alamat bind server |
| `NODE_ENV` | `development` | Set `production` untuk menyajikan `dist` dan mengaktifkan HSTS serta log otomatis |
| `PHOTOBOX_DB` | `data/photobox.db` | Lokasi berkas SQLite |
| `PHOTOBOX_UPLOAD_DIR` | `uploads/` | Folder penyimpanan foto |
| `PHOTOBOX_RETENTION_DAYS` | `30` | Masa simpan foto (hari) |
| `FORCE_HTTPS` | `false` | Alihkan semua permintaan HTTP ke HTTPS dengan 308 |
| `PUBLIC_ORIGIN` | — | URL HTTPS publik, misalnya `https://photobox.example.com`; wajib HTTPS |
| `TRUST_PROXY` | `false` | `1`/`true`, jumlah hop, atau subnet Express untuk membaca `X-Forwarded-*` |
| `HSTS` | `true` di produksi | Kirim `Strict-Transport-Security` pada permintaan HTTPS |
| `HSTS_MAX_AGE` | `31536000` | Masa berlaku HSTS dalam detik |
| `LOG_REQUESTS` | `errors` (dev), `auto` (prod) | `off`, `errors`, `auto`, atau `all` |

Nilai yang tidak valid (misalnya `PORT=abc`, `PUBLIC_ORIGIN` non-HTTPS, atau `LOG_REQUESTS` tak dikenal) membuat server gagal saat startup, bukan saat melayani pengguna.

Mode log:

- `off`: tanpa log permintaan.
- `errors`: hanya respons 5xx.
- `auto`: semua permintaan API, semua respons gagal, dan permintaan yang lebih lambat dari 1 detik.
- `all`: semua permintaan termasuk aset statis.

Setiap respons menyertakan `X-Request-Id`. ID dari klien diteruskan bila aman (8–64 karakter `A-Za-z0-9._-`), selain itu dibuat UUID baru. ID yang sama muncul di log JSON dan respons error agar insiden mudah ditelusuri.

Contoh:

```bash
PORT=8080 PHOTOBOX_RETENTION_DAYS=14 npm start
```

## API

Semua endpoint foto memerlukan header `X-Session-Id` berisi UUID v4. UUID dibuat otomatis oleh frontend dan disimpan di perangkat.

| Metode | Endpoint | Keterangan |
| --- | --- | --- |
| `GET` | `/api/health` | Status server, jumlah foto, masa retensi |
| `GET` | `/api/catalog` | Border, filter, dan ukuran kertas sekaligus |
| `GET` | `/api/borders` | Daftar border aktif |
| `GET` | `/api/filters` | Daftar filter aktif |
| `GET` | `/api/paper-sizes` | Daftar ukuran kertas dan resolusi piksel |
| `POST` | `/api/photos` | Simpan foto (multipart: `file`, `thumb`, metadata) |
| `GET` | `/api/photos` | Daftar foto milik sesi |
| `GET` | `/api/photos/:id/thumb` | Thumbnail milik sesi |
| `GET` | `/api/photos/:id/download` | Unduh berkas asli milik sesi |
| `DELETE` | `/api/photos/:id` | Hapus foto milik sesi |

Contoh menyimpan foto:

```bash
curl -X POST http://localhost:3000/api/photos \
  -H "X-Session-Id: 3f1c2c4e-8a4c-4f5e-9d4a-2b8f6c1d7e90" \
  -F "file=@foto.png;type=image/png" \
  -F "thumb=@thumb.jpg;type=image/jpeg" \
  -F "borderId=polaroid" \
  -F "filterId=normal" \
  -F "paperSizeId=4r" \
  -F "jumlahPose=4" \
  -F "lebarPx=1200" \
  -F "tinggiPx=1800" \
  -F "dpi=300" \
  -F "intensitas=1"
```

Server memvalidasi tipe berkas (PNG/JPG), ukuran maksimal 20 MB, dimensi piksel terhadap ukuran kertas, DPI, jumlah pose, border, filter, dan intensitas. Berkas yang gagal validasi langsung dihapus.

## Spesifikasi Cetak

| Kertas | Dimensi | Resolusi 300 DPI | Tata letak |
| --- | --- | --- | --- |
| 3R | 3,5 × 5 inci (88,9 × 127 mm) | 1050 × 1500 px | 1–4 pose |
| 4R | 4 × 6 inci (101,6 × 152,4 mm) | 1200 × 1800 px | 1–4 pose, atau 2 strip 2×6 |
| 5R | 5 × 7 inci (127 × 177,8 mm) | 1500 × 2100 px | 1–4 pose |
| A4 | 210 × 297 mm | 2480 × 3508 px | 1–4 pose, 2 foto 4R, atau 4 foto 3R |
| Strip 2×6 | 2 × 6 inci (50,8 × 152,4 mm) | 600 × 1800 px | 3–4 pose vertikal |

Aturan render:

- Kanvas dirender pada resolusi penuh, bukan diperbesar dari pratinjau.
- Margin aman minimal **3 mm** dari tepi.
- Foto memakai **cover crop** dengan fokus sedikit di atas tengah agar wajah tidak terpotong.
- Filter yang sama dipakai untuk pratinjau dan hasil akhir.
- Hiasan (teks dan stiker) dirasterisasi ke kanvas penuh sebelum ekspor, tanpa kotak pilihan pratinjau.
- Pada multi-cetak, desain dirender sekali pada ukuran kertas kecil lalu disalin ke setiap petak. Lembar keluaran tetap berukuran kertas yang dipilih (4R atau A4) dengan latar putih dan grid terpusat.
- PDF ditulis dengan ukuran halaman dalam milimeter asli, tanpa penskalaan otomatis.
- PNG menyertakan `pHYs` dan JPG menyertakan densitas JFIF 300 DPI.

## Privasi dan Retensi

- Pratinjau kamera diproses di browser dan tidak dikirim ke server.
- Foto hanya dikirim saat pengguna menekan **Simpan ke galeri**.
- Galeri terikat pada UUID anonim di perangkat, bukan akun.
- Foto otomatis dihapus setelah 30 hari (dapat diubah lewat environment variable) dan bisa dihapus manual kapan saja.
- Server tidak menyimpan email, nama, atau data identitas pengguna.

## Struktur Proyek

```
photobox/
├─ public/
│  ├─ index.html          # Semua layar, dialog, dan SVG sprite
│  ├─ css/                # Design system, font, responsif
│  ├─ js/
│  │  ├─ main.js          # Alur aplikasi dan event
│  │  ├─ camera.js        # getUserMedia, capture, unggah foto
│  │  ├─ layout.js        # Tata letak kertas dan cover crop
│  │  ├─ multi.js         # Mode dan geometri multi-cetak
│  │  ├─ borders.js       # 12 renderer border vektor
│  │  ├─ filters.js       # Filter CSS dan cadangan piksel
│  │  ├─ overlays.js      # Stiker vektor, teks, dan hit-test hiasan
│  │  ├─ render.js        # Render lembar foto penuh
│  │  ├─ export.js        # PNG/JPG 300 DPI dan PDF
│  │  └─ api.js           # Klien API + sesi anonim
│  └─ assets/             # Ikon dan font
├─ server/
│  ├─ index.js            # Entry point, pembersihan retensi, graceful shutdown
│  ├─ app.js              # Express, static, logging, header keamanan
│  ├─ config.js           # Pembacaan dan validasi environment
│  ├─ logger.js           # Request ID dan log JSON
│  ├─ security.js         # CSP, header keamanan, HSTS, redirect HTTPS
│  ├─ catalog.js          # Seed border/filter/kertas
│  ├─ db.js               # Skema dan query SQLite
│  ├─ storage.js          # Multer dan validasi tipe berkas
│  ├─ image-size.js       # Pembaca dimensi PNG/JPG
│  ├─ rate-limit.js       # Pembatas laju in-memory
│  └─ routes/             # Katalog dan foto
├─ scripts/
│  ├─ build.js            # Build aset ber-hash ke dist/
│  └─ start-production.js # Entry point NODE_ENV=production
├─ test/
│  ├─ api.test.js         # Tes API dan validasi unggahan
│  ├─ http.test.js        # Header, cache, request ID, HTTPS
│  ├─ config.test.js      # Validasi environment
│  ├─ build.test.js       # Hash, rewrite referensi, manifest
│  └─ multi.test.js       # Mode dan geometri multi-cetak
└─ docs/PRD-IMPLEMENTATION.md
```

## Pengujian

```bash
npm test
```

Tes mencakup katalog, validasi sesi, seluruh aturan validasi unggahan, batas 20 MB, simpan/daftar/unduh, isolasi antarsesi, hapus foto, mode dan geometri multi-cetak, header keamanan, request ID, cache API/aset, redirect HTTPS + HSTS, validasi environment, serta build ber-hash dan manifest. Total **33 tes** berjalan dengan `node --test`.

QA browser F10 memverifikasi tambah/geser/ubah ukuran/putar/hapus hiasan, batas 12 hiasan, pintasan keyboard, serta hiasan yang ikut ter-render pada PNG 1200 × 1800 px (300 DPI), JPG, PDF, dan gambar galeri. Pemindaian axe-core 4.10.2 pada layar hasil desktop dan mobile tidak menemukan pelanggaran WCAG 2.0/2.1 A/AA, dan tidak ada error konsol.

QA browser F11 memverifikasi 4R dua strip, A4 dua 4R, dan A4 empat 3R: semua salinan identik termasuk hiasan, pemilihan hiasan sadar petak, margin putih A4, serta ekspor PNG/JPG 300 DPI dan PDF sesuai ukuran kertas (4R 288 × 432 pt, A4 595,28 × 841,89 pt). Galeri menyimpan berkas lembar penuh; axe-core bersih di desktop dan mobile 360 px tanpa error konsol.

QA pengerasan produksi:

- Build `dist` berisi 33 berkas (32 aset ber-hash) dan seluruh 32 referensi manifest merespons 200.
- Halaman produksi memuat 18 aset ber-hash tanpa satu pun aset tanpa hash, font berstatus `loaded`, 12 border dan 5 kertas tampil, serta tidak ada error konsol.
- Aset ber-hash merespons `Cache-Control: public, max-age=31536000, immutable`; `index.html` merespons `no-cache`; API merespons `no-store` dengan `Vary: X-Session-Id`.
- Lighthouse 12.8.2 emulasi seluler pada build produksi: performa **97** (median 3 run; satu run awal yang bising 89), aksesibilitas 100, best practices 100, SEO 100; LCP 2,4 dtk, TBT 10–20 ms, CLS 0, transfer 220 KiB.

## Lisensi

Proyek privat untuk kebutuhan Photobox Web.
