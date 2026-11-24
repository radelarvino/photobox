# Photobox Kiosk

Photobooth web-based untuk acara dan kiosk. **Semua foto diproses sepenuhnya di browser** — tidak ada upload, tidak ada server API, tidak ada database foto. Cocok untuk tablet, laptop, dan HP; bisa di-deploy statis ke Vercel, Netlify, atau GitHub Pages.

## Menjalankan

```bash
npm run dev
# buka http://localhost:4173
```

Tidak perlu `npm install` — aplikasi ini vanilla HTML/CSS/JS dan server dev hanya memakai modul bawaan Node.js (Node ≥ 22).

**Uji:** `npm test` (geometri layout, kontras frame, kelengkapan filter/stiker).

### Deploy ke Vercel

- Import repository, lalu set **Root Directory** ke `kiosk` (folder aplikasi ini).
- **Framework Preset:** Other
- **Build Command:** kosong
- **Output Directory:** `public`
- Tidak perlu environment variable. `vercel.json` sudah mengatur cache font/vendor dan header keamanan dasar.

Kamera browser mensyaratkan **HTTPS** (Vercel sudah menyediakannya) atau `localhost`.

## Struktur folder

```
photobox-kiosk/
├── public/
│   ├── index.html            # Lima layar + dialog admin/QR/cetak/galeri
│   ├── assets/favicon.svg
│   ├── css/
│   │   ├── fonts.css         # Bodoni Moda + DM Sans (lokal)
│   │   ├── base.css          # Token warna, grain, tombol, tipografi
│   │   ├── screens.css       # Layout per layar + responsif
│   │   └── print.css
│   ├── fonts/                # 2 berkas WOFF2
│   └── js/
│       ├── main.js           # Mesin state alur sesi
│       ├── config.js         # Pengaturan admin (localStorage)
│       ├── dom.js            # Pembantu DOM, toast, busy
│       ├── layouts.js        # 5 bentuk cetakan + geometri petak
│       ├── frames.js         # 8 bingkai vektor + uji kontras
│       ├── camera.js         # getUserMedia, ganti kamera, error
│       ├── render.js         # Komposisi kanvas 300 DPI
│       ├── image.js          # Cover crop, grain, unduh berkas
│       ├── overlays.js       # Geser/ubah ukuran/putar hiasan
│       ├── filters.js        # 7 filter
│       ├── stickers.js       # 6 stiker SVG
│       ├── gallery.js        # Galeri sesi (memori)
│       ├── export.js         # PNG/JPG, cetak, GIF, QR
│       ├── admin.js          # Panel PIN
│       ├── kiosk.js          # Fullscreen, keyboard, auto-reset idle
│       └── vendor/           # qrcode-generator + gifenc (lokal)
├── scripts/dev-server.mjs    # Server statis development
├── test/geometry.test.mjs
├── FRAMES.md                 # Konsep, palet, alasan, uji kontras
└── vercel.json
```

## Fitur yang berfungsi

- [x] Kamera depan/belakang, preview cermin, izin ditolak → pesan jelas + unggah foto (drag & drop tidak dipakai, input file biasa).
- [x] Alur: beranda → pilih layout/frame/filter → hitung mundur 1–9 detik → 1–6 jepret otomatis → ulang per foto → hasil.
- [x] 5 layout: strip 2×6 (3 foto), strip 4 foto, grid 2×2, kolase 1+3, postcard.
- [x] 8 bingkai romantis + 7 filter + 6 stiker vektor + teks kustom; hiasan bisa digeser, diubah ukuran, diputar (pointer + keyboard).
- [x] Komposisi Canvas 300 DPI: 1200×1800 px (4×6), 600×1800 px (2×6), 1800×1200 px (postcard).
- [x] Unduh PNG/JPG, cetak 4×6 / 2×6 / 6×4 lewat stylesheet `@page`, GIF animasi, QR code.
- [x] Galeri sesi di memori; reset otomatis saat idle (default 60 detik, diatur di admin).
- [x] Mode kiosk: layar penuh, tombol besar, spasi = jepret, Esc = tutup dialog, fokus keyboard dan label ARIA.
- [x] Panel admin PIN (default `2468`): jumlah foto, durasi hitung mundur, teks acara, dua warna aksen, logo/frame sendiri, durasi idle.

## Tiga keputusan desain utama

1. **Tanpa server sama sekali.** Permintaan menyebut data diproses lokal dan dihapus saat sesi direset. Menyimpan foto di memori (bukan localStorage/IndexedDB) membuat janji itu literal: tutup tab atau reset → foto hilang. Konsekuensinya, QR tidak bisa mengirim foto ke ponsel lewat server — QR mengenkode Data URL versi kecil (lihat catatan di bawah).
2. **Satu sistem koordinat untuk semua frame.** Setiap frame menerima geometri `tilesFor(layout)`, bukan posisi hard-coded. Delapan frame langsung kompatibel dengan lima layout, dan ornamen dijamin hanya berada di header/footer/margin sehingga tidak pernah menutup wajah.
3. **Dua font, satu aksen, nol kartu bulat.** Bodoni Moda (display serif kontras tinggi) + DM Sans (body), kertas hangat `#f3ede1`, merah tomat `#c1442b`, tinta `#1c1a18`. Bayangan fisik, perforasi, dan tekstur grain menggantikan glassmorphism dan gradien. Animasi hanya saat strip keluar, hitung mundur, dan flash — semuanya mati dengan `prefers-reduced-motion`.

## Catatan

- **QR:** karena tidak ada server, QR berisi Data URL JPEG versi kecil (sekitar 64 px). Beberapa pembaca QR hanya menampilkan teks; tombol **Unduh versi kecil saja** disediakan sebagai fallback. Ini adalah batasan sadar dari arsitektur tanpa-upload.
- **Cetak:** tombol Cetak membuka dialog cetak browser dari iframe. Pilih ukuran kertas sesuai layout; hasil sudah 300 DPI.
- **Logo admin:** file PNG/SVG maksimal 2 MB, disimpan sebagai Data URL di localStorage (pengaturan, bukan foto).
- **Penyimpanan penuh:** jika localStorage gagal ditulis, panel admin menampilkan pesan Kesalahan dan pengaturan tidak berubah.
