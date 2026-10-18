// Validasi input publik. Pola slug sama dengan build (03_CONTENT_MODEL.md).
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 80 && SLUG_RE.test(slug);
}

// Heuristik bot sederhana: UA kosong atau mengandung kata kunci umum.
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|curl|wget|python|httpclient|preview|monitor/i;

export function isBot(userAgent) {
  return !userAgent || BOT_RE.test(userAgent);
}

// Endpoint publik same-origin: bila header Origin ada, hostnya harus sama dengan host permintaan.
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// ───── Komentar ─────
export const COMMENT_ID_RE = /^c_[a-z0-9]{6,16}$/;
export const NAME_MAX = 40;
export const TEXT_MIN = 2;
export const TEXT_MAX = 1000;

// Karakter kontrol (kecuali \n di teks), zero-width, dan kontrol arah (bidi) dibuang agar tidak bisa memalsukan tampilan.
const CTRL_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const LINK_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const len = (s) => Array.from(s).length;

export function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?|\n|\t/g, ' ').replace(CTRL_RE, '').replace(/\s+/g, ' ').trim();
}

export function cleanText(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(CTRL_RE, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function countLinks(text) {
  return (text.match(LINK_RE) || []).length;
}

/** Validasi komentar yang sudah dibersihkan. Mengembalikan pesan galat (untuk pembaca) atau null bila valid. */
export function commentProblem(name, text) {
  const n = len(name);
  if (n < 1 || n > NAME_MAX) return `Name must be 1–${NAME_MAX} characters.`;
  const t = len(text);
  if (t < TEXT_MIN || t > TEXT_MAX) return `Comment must be ${TEXT_MIN}–${TEXT_MAX} characters.`;
  if (countLinks(text) > 1) return 'Please include at most one link.';
  if (countLinks(text) === 1 && len(text.replace(LINK_RE, '').trim()) < TEXT_MIN) return 'Please write something besides the link.';
  return null;
}
