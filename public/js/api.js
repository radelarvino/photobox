const SESSION_KEY = 'photobox.session.v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** crypto.randomUUID butuh secure context; sediakan cadangan untuk uji LAN via HTTP. */
function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const digit = char === 'x' ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
}

/** ID anonim perangkat, dipakai untuk mengikat galeri tanpa login. */
export function getSessionId() {
  let id = null;
  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {
    // Mode privat ketat bisa memblokir localStorage.
  }
  if (!id || !UUID_RE.test(id)) {
    id = randomId();
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      // Abaikan: sesi tetap jalan sampai halaman ditutup.
    }
  }
  return id;
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      body,
      headers: {
        'X-Session-Id': getSessionId(),
        ...headers,
      },
    });
  } catch {
    throw new Error('Tidak bisa menghubungi server. Periksa koneksimu.');
  }

  if (!response.ok) {
    let message = `Permintaan gagal (${response.status}).`;
    let code = 'HTTP_ERROR';
    try {
      const payload = await response.json();
      message = payload.error ?? message;
      code = payload.code ?? code;
    } catch {
      // Respons bukan JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  catalog: () => request('/api/catalog'),

  health: () => request('/api/health'),

  listPhotos: () => request('/api/photos').then((payload) => payload.data),

  savePhoto: ({ blob, thumbBlob, meta }) => {
    const form = new FormData();
    const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    form.append('file', blob, `photo.${ext}`);
    if (thumbBlob) form.append('thumb', thumbBlob, 'thumb.jpg');
    for (const [key, value] of Object.entries(meta)) {
      form.append(key, String(value));
    }
    return request('/api/photos', { method: 'POST', body: form }).then((payload) => payload.data);
  },

  /** Unduh dengan header sesi, karena endpoint dilindungi. */
  async fetchPhotoBlob(photo) {
    const response = await fetch(photo.url, {
      headers: { 'X-Session-Id': getSessionId() },
    });
    if (!response.ok) throw new Error('Foto tidak bisa diunduh.');
    return response.blob();
  },

  async fetchThumbBlob(photo) {
    if (!photo.thumbUrl) return null;
    const response = await fetch(photo.thumbUrl, {
      headers: { 'X-Session-Id': getSessionId() },
    });
    if (!response.ok) return null;
    return response.blob();
  },

  deletePhoto: (id) => request(`/api/photos/${id}`, { method: 'DELETE' }),
};
