# Konsep bingkai — Photobox Kiosk

Delapan bingkai dirancang setelah meninjau idiom strip photobooth analog, stasioneri pernikahan *letterpress*, dan layout editorial. Semua ornamen adalah **path vektor** yang digambar dengan Canvas API (bukan emoji, bukan gambar stok), sehingga tetap tajam pada cetakan 300 DPI.

## Delapan konsep

| # | Nama | Kertas · Tinta · Aksen | Mengapa terasa romantis tanpa berlebihan |
|---|---|---|---|
| 1 | **Ivory Letterpress** (default) | `#f7f2e8` · `#1c1a18` · `#a9885b` | Garis ganda, tanda sudut cetak, dan nama dengan spasi huruf — mengingatkan pada undangan cetak timbul. Tidak ada ornamen figural. |
| 2 | **Botanical Line** | `#f6f3e9` · `#2f3a31` · `#6d7d6a` | Satu ranting *line art* di pojok bawah. Ruang kosong dominan, foto tetap pusat perhatian. |
| 3 | **Film Noir Romance** | `#171614` · `#f2ece1` · `#c1442b` | Perforasi film di tepi dan cap tanggal merah. Romantik lewat nostalgia, bukan hati bertebaran. |
| 4 | **Soft Blush** | `#f5e9e5` · `#3a2c2b` · `#b98b82` | Tepi dusty rose, sudut melengkung halus, dan monogram kecil. Manis tapi tertahan. |
| 5 | **Gold Foil Minimal** | `#f8f3e9` · `#26231f` · `#a9885b` | Garis champagne tipis dan tipografi serif nama/tanggal seperti footer undangan formal. |
| 6 | **Polaroid Love Letter** | `#fffdf8` · `#1c1a18` · `#c1442b` | Bingkai Polaroid dengan area catatan miring di bawah; akrab dan personal. |
| 7 | **Ink & Vow** | `#171614` · `#f3ede1` · `#c1442b` | Latar gelap, hairline terang, satu segel merah. Dramatis tanpa berisik. |
| 8 | **Paper & Thread** | `#e8dcc4` · `#2b2620` · `#6d7d6a` | Garis jahitan putus-putus dan segel lilin kecil di kertas kraft — kehangatan barang buatan tangan. |

## Ketersediaan untuk semua layout

Fungsi `draw(ctx, info)` setiap frame menerima geometri hasil `tilesFor(layout)`, sehingga **delapan frame otomatis bekerja di kelima layout**: strip 2×6 (3 foto), strip 4 foto, grid 2×2, kolase 1+3, dan postcard. Ornamen hanya mengisi `header`, `footer`, atau margin luar — tidak pernah area `geo.area` tempat wajah berada.

## Slot teks yang bisa diubah

- **Nama acara / pasangan** — header (maks. 28 karakter)
- **Tanggal** — header (maks. 24 karakter)
- **Kalimat pendek** — footer (maks. 48 karakter)

Nilai awal diatur di **Panel admin** (PIN default `2468`) dan bisa diubah per sesi di layar **Pilih bentuk & rasanya**.

## Warna aksen yang bisa diganti

`settings.frameAccent` (Panel admin → *Warna aksen bingkai*) diterapkan ke semua frame lewat `info.settings.frameAccent`. Jika kosong, frame memakai aksen bawaan di tabel di atas. Warna aksen utama antarmuka (`--accent`) diatur terpisah.

## Uji kontras

Rasio kontras teks terhadap kertas frame dihitung dengan rumus WCAG relative luminance (fungsi `contrastRatio` di `frames.js`) dan diuji otomatis di `test/geometry.test.mjs`:

| Frame | Rasio |
|---|---|
| Ivory Letterpress | 15,55:1 |
| Botanical Line | 10,68:1 |
| Film Noir Romance | 15,38:1 |
| Soft Blush | 11,22:1 |
| Gold Foil Minimal | 14,14:1 |
| Polaroid Love Letter | 17,07:1 |
| Ink & Vow | 15,51:1 |
| Paper & Thread | 11,04:1 |

Semua melebihi ambang AA 4,5:1. Fungsi `readableInk()` juga mengganti tinta ke hitam/putih otomatis bila warna aksen yang dipilih admin menghasilkan kontras di bawah 4,5:1.

## Menambah frame baru

1. Tambah objek ke array `FRAMES` di `public/js/frames.js` dengan `id`, `nama`, `deskripsi`, `alasan`, `palet`, dan `draw(ctx, info)`.
2. Gambar hanya di area `info.geo` di luar `info.geo.area`.
3. Tambah asserting kontras di `test/geometry.test.mjs` jika palet baru.

Kartu pratinjau di layar pengaturan dibuat otomatis oleh `renderFrameThumb()` — tidak perlu aset pratinjau terpisah.
