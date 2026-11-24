/** Galeri hanya di memori browser. Reset sesi menghapus semuanya. */
import { el, icon } from './dom.js';

export const sessionGallery = {
  items: [],
  add(item) {
    this.items.unshift({
      id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date(),
      ...item,
    });
    return this.items[0];
  },
  remove(id) {
    this.items = this.items.filter((item) => item.id !== id);
  },
  clear() {
    this.items = [];
  },
  get count() {
    return this.items.length;
  },
};

const timeLabel = (date) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(date);

/** Render kartu galeri. onOpen menerima item; onDelete menerima id. */
export function renderGallery(container, onOpen, onDelete) {
  container.replaceChildren();
  for (const item of sessionGallery.items) {
    const card = el('article', 'gallery-card');
    const thumb = el('button', 'gallery-thumb');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `Buka foto ${timeLabel(item.createdAt)}`);
    const img = el('img');
    img.src = item.preview;
    img.alt = `Strip ${item.layoutNama} dengan bingkai ${item.frameNama}`;
    img.loading = 'lazy';
    thumb.append(img);
    thumb.addEventListener('click', () => onOpen(item));
    card.append(thumb);

    const meta = el('div', 'gallery-meta');
    meta.append(el('strong', null, item.layoutNama), el('small', null, timeLabel(item.createdAt)));
    card.append(meta);

    const actions = el('div', 'gallery-actions');
    const open = el('button', 'btn btn-soft btn-sm');
    open.type = 'button';
    open.append(icon('download'), document.createTextNode(' Buka'));
    open.addEventListener('click', () => onOpen(item));
    const remove = el('button', 'btn btn-danger btn-sm');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Hapus foto');
    remove.append(icon('trash'));
    remove.addEventListener('click', () => onDelete(item.id));
    actions.append(open, remove);
    card.append(actions);
    container.append(card);
  }
}
