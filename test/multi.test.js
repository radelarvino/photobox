import test from 'node:test';
import assert from 'node:assert/strict';
import { MULTI_MODES, modesFor, modeFor, computeTiles } from '../public/js/multi.js';

/** Kertas uji sesuai katalog 300 DPI. */
const PAPERS = {
  '3r': { id: '3r', nama: '3R', lebarMm: 88.9, tinggiMm: 127, dpi: 300 },
  '4r': { id: '4r', nama: '4R', lebarMm: 101.6, tinggiMm: 152.4, dpi: 300 },
  a4: { id: 'a4', nama: 'A4', lebarMm: 210, tinggiMm: 297, dpi: 300 },
  strip: { id: 'strip', nama: 'Strip', lebarMm: 50.8, tinggiMm: 152.4, dpi: 300 },
};

test('4R punya mode satu foto dan dua strip', () => {
  const ids = modesFor('4r').map((mode) => mode.id);
  assert.deepEqual(ids, ['single', '2-strip']);
  const strip = modeFor('4r', '2-strip');
  assert.equal(strip.designId, 'strip');
  assert.equal(strip.copies, 2);
  assert.equal(strip.cols, 2);
  assert.equal(strip.rows, 1);
});

test('A4 punya tiga pilihan tata letak', () => {
  const ids = modesFor('a4').map((mode) => mode.id);
  assert.deepEqual(ids, ['single', '2-4r', '4-3r']);
  assert.equal(modeFor('a4', '2-4r').copies, 2);
  assert.equal(modeFor('a4', '4-3r').copies, 4);
  assert.equal(modeFor('a4', '4-3r').designId, '3r');
});

test('kertas lain hanya satu salinan', () => {
  for (const id of ['3r', '5r', 'strip']) {
    const list = modesFor(id);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'single');
    assert.equal(list[0].designId, id);
  }
});

test('mode tidak dikenal kembali ke mode pertama', () => {
  assert.equal(modeFor('4r', 'tidak-ada').id, 'single');
  assert.equal(modeFor('a4', null).id, 'single');
});

test('dua strip 4R mengisi penuh 1200 × 1800 px', () => {
  const tiling = computeTiles({
    outputPaper: PAPERS['4r'],
    designPaper: PAPERS.strip,
    cols: 2,
    rows: 1,
  });
  assert.ok(tiling);
  assert.equal(tiling.width, 1200);
  assert.equal(tiling.height, 1800);
  assert.equal(tiling.tileW, 600);
  assert.equal(tiling.tileH, 1800);
  assert.equal(tiling.offsetX, 0);
  assert.equal(tiling.offsetY, 0);
  assert.deepEqual(
    tiling.tiles.map(({ x, y, w, h }) => ({ x, y, w, h })),
    [
      { x: 0, y: 0, w: 600, h: 1800 },
      { x: 600, y: 0, w: 600, h: 1800 },
    ],
  );
});

test('A4 dua 4R diletakkan berdampingan dan terpusat', () => {
  const tiling = computeTiles({
    outputPaper: PAPERS.a4,
    designPaper: PAPERS['4r'],
    cols: 2,
    rows: 1,
  });
  assert.ok(tiling);
  assert.equal(tiling.offsetX, 40);
  assert.equal(tiling.offsetY, 854);
  assert.equal(tiling.tiles.length, 2);
  assert.deepEqual(
    tiling.tiles.map(({ x, y }) => ({ x, y })),
    [
      { x: 40, y: 854 },
      { x: 1240, y: 854 },
    ],
  );
});

test('A4 empat 3R membentuk grid 2 × 2 terpusat', () => {
  const tiling = computeTiles({
    outputPaper: PAPERS.a4,
    designPaper: PAPERS['3r'],
    cols: 2,
    rows: 2,
  });
  assert.ok(tiling);
  assert.equal(tiling.offsetX, 190);
  assert.equal(tiling.offsetY, 254);
  assert.equal(tiling.tiles.length, 4);
  assert.deepEqual(
    tiling.tiles.map(({ x, y }) => ({ x, y })),
    [
      { x: 190, y: 254 },
      { x: 1240, y: 254 },
      { x: 190, y: 1754 },
      { x: 1240, y: 1754 },
    ],
  );
});

test('skala pratinjau membulatkan geometri ke piksel utuh', () => {
  const tiling = computeTiles({
    outputPaper: PAPERS.a4,
    designPaper: PAPERS['3r'],
    cols: 2,
    rows: 2,
    scale: 0.25,
  });
  assert.ok(tiling);
  assert.deepEqual(
    { width: tiling.width, height: tiling.height, tileW: tiling.tileW, tileH: tiling.tileH },
    { width: 620, height: 877, tileW: 263, tileH: 375 },
  );
  for (const tile of tiling.tiles) {
    assert.ok(Number.isInteger(tile.x));
    assert.ok(Number.isInteger(tile.y));
    assert.ok(tile.x + tile.w <= tiling.width);
    assert.ok(tile.y + tile.h <= tiling.height);
  }
});

test('susunan yang tidak muat ditolak', () => {
  assert.equal(
    computeTiles({ outputPaper: PAPERS.strip, designPaper: PAPERS.a4, cols: 1, rows: 1 }),
    null,
  );
  assert.equal(
    computeTiles({ outputPaper: PAPERS['4r'], designPaper: PAPERS['4r'], cols: 2, rows: 1 }),
    null,
  );
});

test('semua mode bawaan muat di kertas keluarannya', () => {
  for (const [paperId, list] of Object.entries(MULTI_MODES)) {
    for (const mode of list) {
      const tiling = computeTiles({
        outputPaper: PAPERS[paperId],
        designPaper: PAPERS[mode.designId],
        cols: mode.cols,
        rows: mode.rows,
      });
      assert.ok(tiling, `${paperId}/${mode.id} harus muat`);
      assert.equal(
        tiling.tiles.length,
        mode.copies,
        `${paperId}/${mode.id} jumlah petak harus sama dengan salinan`,
      );
    }
  }
});
