import test from 'node:test';
import assert from 'node:assert/strict';

import { LAYOUTS, layoutById, tilesFor, printSizeForLayout } from '../public/js/layouts.js';
import { FRAMES, contrastRatio } from '../public/js/frames.js';
import { FILTERS } from '../public/js/filters.js';
import { STICKERS } from '../public/js/stickers.js';

test('lima layout dengan jumlah pose dan ukuran cetak yang benar', () => {
  assert.equal(LAYOUTS.length, 5);
  assert.equal(layoutById('strip-2x6').size.width, 600);
  assert.equal(layoutById('strip-2x6').size.height, 1800);
  assert.equal(layoutById('grid-2x2').size.width, 1200);
  assert.equal(layoutById('postcard').size.height, 1200);
  assert.equal(printSizeForLayout(layoutById('strip-4')).id, '2x6');
  assert.equal(printSizeForLayout(layoutById('postcard')).id, '6x4');
});

test('semua petak berada di dalam area foto dan tidak bertabrakan', () => {
  for (const layout of LAYOUTS) {
    const geo = tilesFor(layout);
    assert.equal(geo.tiles.length, layout.poses, layout.id);
    for (const tile of geo.tiles) {
      assert.ok(tile.x >= geo.area.x - 1, `${layout.id}: x`);
      assert.ok(tile.y >= geo.area.y - 1, `${layout.id}: y`);
      assert.ok(tile.x + tile.w <= geo.area.x + geo.area.w + 1, `${layout.id}: kanan`);
      assert.ok(tile.y + tile.h <= geo.area.y + geo.area.h + 1, `${layout.id}: bawah`);
      assert.ok(tile.w > 20 && tile.h > 20, `${layout.id}: ukuran`);
    }
    for (let i = 0; i < geo.tiles.length; i += 1) {
      for (let j = i + 1; j < geo.tiles.length; j += 1) {
        const a = geo.tiles[i];
        const b = geo.tiles[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.equal(overlap, false, `${layout.id}: petak ${i} dan ${j} bertabrakan`);
      }
    }
  }
});

test('delapan frame dengan palet terbaca dan warna aksen yang bisa diganti', () => {
  assert.equal(FRAMES.length, 8);
  for (const frame of FRAMES) {
    assert.ok(frame.nama && frame.deskripsi && frame.alasan, frame.id);
    const ratio = contrastRatio(frame.palet.kertas, frame.palet.tinta);
    assert.ok(ratio >= 4.5, `${frame.id}: kontras ${ratio.toFixed(2)}`);
    assert.match(frame.palet.aksen, /^#[0-9a-f]{6}$/i);
    assert.equal(typeof frame.draw, 'function');
  }
});

test('filter dan stiker lengkap', () => {
  assert.ok(FILTERS.length >= 6);
  assert.ok(STICKERS.length >= 6);
  for (const sticker of STICKERS) {
    assert.match(sticker.path, /^M/);
  }
});
