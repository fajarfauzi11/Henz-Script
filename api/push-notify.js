/* api/push-notify.js — Kirim notifikasi script baru ke semua pelanggan (topic FCM "all").
   Dipanggil workflow GitHub Actions (.github/workflows/push-notify.yml) setelah deploy, dengan header
   Authorization: Bearer <PUSH_ADMIN_SECRET>. Tanpa secret yang benar -> 401.

   Cara kerja: baca /js/posts.json situs live, bandingkan id terbaru dengan push:last_notified_id di Redis.
   - Belum ada push:last_notified_id (pemanggilan pertama): HANYA mencatat id terbaru sebagai patokan, tidak mengirim apa pun.
   - Ada post dengan id lebih besar: kirim notifikasi (maks 3 notifikasi satuan; lebih dari itu diringkas jadi 1), lalu
     simpan id terbaru. Post draft tidak ada di posts.json, jadi tidak pernah ikut terkirim.
   Opsi body JSON: {"test":true} kirim notifikasi uji (tidak mengubah patokan); {"dry":true} hitung saja, tidak kirim/ubah.

   Discord (opsional): bila env DISCORD_WEBHOOK_URL diisi, setiap post baru juga dikirim sebagai embed ke channel Discord
   lewat webhook (teks pesan berbahasa Inggris). DISCORD_PING_ROLE_ID (opsional) = ID role yang di-ping; kosong = tanpa ping.
   Pengiriman Discord bersifat best-effort: kegagalannya tidak pernah menggagalkan notifikasi push ataupun memajukan patokan.
   Tiap pesan Discord membawa tombol link ("Open Script"). Bila Discord menolak komponen untuk webhook ini (HTTP 400),
   pesan dikirim ulang tanpa tombol (embed biasa) supaya notifikasi tidak hilang.
   Opsi uji: {"test":true,"ping":true} mengirim pesan uji yang benar-benar mem-ping role (butuh DISCORD_PING_ROLE_ID).

   Telegram (opsional): bila env TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID diisi, setiap post baru juga dikirim ke grup/channel
   Telegram sebagai foto + caption + tombol "Open Script" (bahasa Inggris). TELEGRAM_THREAD_ID (opsional) mengarahkan pesan
   ke satu topik di grup berforum. Bila foto ditolak Telegram, pesan dikirim ulang sebagai teks + tombol. Best-effort,
   sama seperti Discord. Mode test ikut mengirim pesan uji ke Telegram.

   WhatsApp (semi-otomatis, sengaja TIDAK memakai otomatisasi WhatsApp): bila TELEGRAM_ADMIN_CHAT_ID diisi (ID akun Telegram
   admin, boleh beberapa dipisah koma; admin harus sudah menekan Start pada bot), setiap post baru juga dikirim ke chat PRIBADI
   admin lewat bot yang sama: teks bahasa Indonesia siap tempel + tombol "Bagikan ke WhatsApp" (tautan wa.me) + tombol buka
   post. Admin sendiri yang memilih grup dan menekan kirim di WhatsApp. Bisa dipakai tanpa grup Telegram. */
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const { sendToTopic } = require('./_lib/fcm');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SITE = 'https://www.henzscript.com';
const LAST_KEY = 'push:last_notified_id';
const LOCK_KEY = 'push:lock';
const MAX_INDIVIDUAL = 3;
const EMBED_COLOR = 0xe53232;
const CHAT_GAP_MS = 1100; // jeda antar pesan ke Discord/Telegram agar tidak kena batas laju (Telegram sekitar 1 pesan/detik per chat)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function discordConfig() {
  const url = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
  const urlOk = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/.test(url);
  const role = String(process.env.DISCORD_PING_ROLE_ID || '').trim();
  return { url: urlOk ? url : '', role: /^\d{17,20}$/.test(role) ? role : '' };
}

function clip(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
}

// Hindari karakter markdown dalam judul/nama hero agar tampil apa adanya di embed.
function esc(s) {
  return String(s).replace(/([\\*_~`|>\[\]()])/g, '\\$1');
}

function mentionPrefix(role) {
  return role ? '<@&' + role + '> ' : '';
}

function discordAllowed(role) {
  return { parse: [], roles: role ? [role] : [] }; // hanya role itu yang boleh di-ping
}

// Satu baris berisi satu tombol link (style 5). Tombol link bukan komponen interaktif, jadi boleh untuk webhook biasa
// asalkan request memakai ?with_components=true.
function linkButtonRow(label, url) {
  return [{ type: 1, components: [{ type: 2, style: 5, label: clip(label, 80), url }] }];
}

function discordPostPayload(p, role) {
  const bits = [p.hero, p.cat].filter(Boolean).map((x) => esc(clip(x, 100)));
  const embed = {
    title: clip('New script: ' + p.title, 256),
    url: SITE + p.url,
    description: (bits.length ? '**' + bits.join(' \u00b7 ') + '**\n' : '') + 'Open the post to view and download the script.',
    color: EMBED_COLOR,
    footer: { text: 'Henz Script' },
    timestamp: new Date().toISOString(),
  };
  if (typeof p.thumb === 'string' && /^https:\/\//i.test(p.thumb)) embed.image = { url: p.thumb };
  return {
    content: mentionPrefix(role) + 'A new script just dropped!',
    embeds: [embed],
    allowed_mentions: discordAllowed(role),
    components: linkButtonRow('Open Script', SITE + p.url),
  };
}

function discordSummaryPayload(list, role) {
  const shown = list.slice(-10).reverse();
  const lines = shown.map((p) => '\u2022 [' + esc(clip(p.title, 80)) + '](' + SITE + p.url + ')');
  if (list.length > shown.length) lines.push('\u2026and ' + (list.length - shown.length) + ' more');
  return {
    content: mentionPrefix(role) + 'New scripts just dropped!',
    embeds: [{
      title: clip(list.length + ' new scripts on Henz Script', 256),
      url: SITE + '/',
      description: clip(lines.join('\n'), 4000),
      color: EMBED_COLOR,
      footer: { text: 'Henz Script' },
      timestamp: new Date().toISOString(),
    }],
    allowed_mentions: discordAllowed(role),
    components: linkButtonRow('Open Henz Script', SITE + '/'),
  };
}

// Satu kali POST ke webhook (dengan satu percobaan ulang bila kena batas laju 429).
// Hasil: 'ok' | 'rejected' (HTTP 400: payload/komponen ditolak) | 'error' (lainnya). Tidak pernah melempar error.
async function postWebhook(target, payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) return 'ok';
      if (r.status === 429 && attempt === 0) {
        let wait = 1;
        try { wait = Number((await r.json()).retry_after) || 1; } catch (e) { /* pakai default */ }
        if (wait > 4) return 'error';
        await sleep(wait * 1000 + 100);
        continue;
      }
      let detail = '';
      try { detail = clip(await r.text(), 200); } catch (e) { /* abaikan */ }
      console.error('discord webhook HTTP ' + r.status + (detail ? ' ' + detail : '')); // jangan pernah mencatat URL webhook
      return r.status === 400 ? 'rejected' : 'error';
    } catch (e) {
      console.error('discord webhook:', e && e.message);
      return 'error';
    }
  }
  return 'error';
}

// Kirim satu pesan. Bila membawa tombol dan ditolak (400), kirim ulang tanpa tombol.
// Hasil: { status: 'sent' | 'failed', button: true bila pesan terkirim DENGAN tombol }.
async function sendDiscord(url, payload) {
  const hasButton = Array.isArray(payload.components) && payload.components.length > 0;
  if (!hasButton) {
    return { status: (await postWebhook(url, payload)) === 'ok' ? 'sent' : 'failed', button: false };
  }
  const first = await postWebhook(url + '?with_components=true', payload);
  if (first === 'ok') return { status: 'sent', button: true };
  if (first === 'rejected') {
    const plain = Object.assign({}, payload);
    delete plain.components;
    return { status: (await postWebhook(url, plain)) === 'ok' ? 'sent' : 'failed', button: false };
  }
  return { status: 'failed', button: false };
}

function authorized(req) {
  const secret = process.env.PUSH_ADMIN_SECRET || '';
  if (secret.length < 16) return false; // tidak diatur / terlalu pendek: tolak semua
  const h = String((req.headers && req.headers.authorization) || '');
  const given = h.indexOf('Bearer ') === 0 ? h.slice(7) : '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function postMessage(p) {
  const bits = [p.hero, p.cat].filter(Boolean).map(String);
  const data = {
    title: 'Script baru: ' + String(p.title),
    body: (bits.length ? bits.join(' \u00b7 ') + ' \u2014 ' : '') + 'ketuk untuk melihat.',
    url: p.url, // path relatif: service worker membukanya di origin tempat pelanggan mendaftar (www atau tanpa www)
    icon: SITE + '/icons/icon-192.png',
    tag: 'post-' + p.id,
  };
  if (typeof p.thumb === 'string' && /^https:\/\//i.test(p.thumb)) data.image = p.thumb;
  return data;
}

function summaryMessage(list) {
  const names = list.slice(-3).reverse().map((p) => String(p.title)).join(', ');
  return {
    title: list.length + ' script baru di Henz MLBB',
    body: names + (list.length > 3 ? ', dan lainnya' : ''),
    url: '/',
    icon: SITE + '/icons/icon-192.png',
    tag: 'post-batch',
  };
}

// ---- Telegram ----
function telegramConfig() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chat = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  const thread = String(process.env.TELEGRAM_THREAD_ID || '').trim();
  const tokenOk = /^\d{6,12}:[\w-]{30,}$/.test(token);
  const chatOk = tokenOk && /^(-?\d{5,20}|@\w{5,})$/.test(chat);
  const admins = tokenOk
    ? String(process.env.TELEGRAM_ADMIN_CHAT_ID || '').split(/[\s,;]+/).filter((x) => /^\d{5,15}$/.test(x)).slice(0, 5)
    : [];
  return {
    token: tokenOk ? token : '',
    chat: chatOk ? chat : '',
    thread: chatOk && /^\d{1,12}$/.test(thread) ? Number(thread) : 0,
    admins,
  };
}

function htmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function telegramPostMessage(p) {
  const url = SITE + p.url;
  const bits = [p.hero, p.cat].filter(Boolean).map((x) => htmlEsc(clip(x, 100)));
  const msg = {
    text: '\ud83c\udd95 <b><a href="' + htmlEsc(url) + '">' + htmlEsc(clip('New script: ' + p.title, 200)) + '</a></b>' +
      (bits.length ? '\n' + bits.join(' \u00b7 ') : '') +
      '\n\nOpen the post to view and download the script.',
    button: { text: 'Open Script', url },
  };
  if (typeof p.thumb === 'string' && /^https:\/\//i.test(p.thumb)) msg.photo = p.thumb;
  return msg;
}

function telegramSummaryMessage(list) {
  const shown = list.slice(-10).reverse();
  const lines = shown.map((p) => '\u2022 <a href="' + htmlEsc(SITE + p.url) + '">' + htmlEsc(clip(p.title, 80)) + '</a>');
  if (list.length > shown.length) lines.push('\u2026and ' + (list.length - shown.length) + ' more');
  return {
    text: '<b>' + list.length + ' new scripts on Henz Script</b>\n\n' + lines.join('\n'),
    button: { text: 'Open Henz Script', url: SITE + '/' },
  };
}

// Satu panggilan Bot API (dengan satu percobaan ulang bila kena 429).
// Hasil: 'ok' | 'rejected' (HTTP 400) | 'error'. Tidak pernah melempar error dan tidak pernah mencatat token.
async function tgCall(cfg, method, params) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://api.telegram.org/bot' + cfg.token + '/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(8000),
      });
      let j = null;
      try { j = await r.json(); } catch (e) { /* bukan JSON */ }
      if (r.ok && j && j.ok) return 'ok';
      const retry = j && j.parameters ? Number(j.parameters.retry_after) : 0;
      if (r.status === 429 && attempt === 0 && retry > 0 && retry <= 4) {
        await sleep(retry * 1000 + 100);
        continue;
      }
      console.error('telegram ' + method + ' HTTP ' + r.status + (j && j.description ? ' ' + clip(j.description, 200) : ''));
      return r.status === 400 ? 'rejected' : 'error';
    } catch (e) {
      console.error('telegram:', e && e.message);
      return 'error';
    }
  }
  return 'error';
}

// Kirim satu pesan ke Telegram (dengan bunyi notifikasi biasa). Foto dicoba dulu; bila ditolak, kirim teks + tombol.
// Hasil: { status: 'sent' | 'failed', photo: true bila terkirim sebagai foto }.
async function sendTelegram(cfg, msg) {
  const base = {
    chat_id: cfg.chat,
    disable_notification: false,
    reply_markup: { inline_keyboard: [[{ text: msg.button.text, url: msg.button.url }]] },
  };
  if (cfg.thread) base.message_thread_id = cfg.thread;
  if (msg.photo) {
    const r = await tgCall(cfg, 'sendPhoto', Object.assign({}, base, { photo: msg.photo, caption: msg.text, parse_mode: 'HTML' }));
    if (r === 'ok') return { status: 'sent', photo: true };
    if (r !== 'rejected') return { status: 'failed', photo: false };
  }
  const r2 = await tgCall(cfg, 'sendMessage', Object.assign({}, base, {
    text: msg.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }));
  return { status: r2 === 'ok' ? 'sent' : 'failed', photo: false };
}

// ---- WhatsApp (semi-otomatis: pesan siap tempel ke chat pribadi admin, dikirim manual oleh admin) ----
function waClean(s) {
  return String(s).replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim(); // buang karakter format WhatsApp dari judul
}

function waShareUrl(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

function waPostText(p) {
  const bits = [p.hero, p.cat].filter(Boolean).map((x) => waClean(clip(x, 100)));
  return '\ud83c\udd95 *Script baru: ' + waClean(clip(p.title, 150)) + '*' +
    (bits.length ? '\n' + bits.join(' \u00b7 ') : '') +
    '\n\nCek dan download di sini:\n' + SITE + p.url;
}

// Ringkasan untuk banyak post; dipangkas bila tautan wa.me akan terlalu panjang untuk tombol Telegram.
function waSummaryText(list) {
  const shown = list.slice(-10).reverse();
  let text = '';
  for (let n = shown.length; n >= 1; n--) {
    const lines = shown.slice(0, n).map((p) => '\u2022 ' + waClean(clip(p.title, 80)) + '\n' + SITE + p.url);
    const more = list.length - n;
    text = '\ud83c\udd95 *' + list.length + ' script baru di Henz Script*\n\n' + lines.join('\n\n') +
      (more > 0 ? '\n\n\u2026dan ' + more + ' lainnya' : '') + '\n\nLihat semua:\n' + SITE + '/';
    if (waShareUrl(text).length <= 1800) break;
  }
  return text;
}

function waAdminMessage(text, openUrl, openLabel) {
  const share = waShareUrl(text);
  const rows = [];
  if (share.length <= 2000) rows.push([{ text: 'Bagikan ke WhatsApp', url: share }]);
  rows.push([{ text: openLabel, url: openUrl }]);
  return {
    text: '\ud83d\udcf2 <b>Siap dibagikan ke WhatsApp</b>\nKetuk kotak di bawah untuk menyalin, atau tekan <b>Bagikan ke WhatsApp</b> lalu pilih grup.\n\n<pre>' + htmlEsc(text) + '</pre>',
    rows,
  };
}

// Kirim ke chat pribadi tiap admin. Hasil: { sent, failed }. Tidak pernah melempar error.
async function sendAdminDMs(cfg, msg) {
  const out = { sent: 0, failed: 0 };
  await Promise.all(cfg.admins.map(async (id) => {
    const r = await tgCall(cfg, 'sendMessage', {
      chat_id: id,
      text: msg.text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      disable_notification: false,
      reply_markup: { inline_keyboard: msg.rows },
    });
    if (r === 'ok') out.sent += 1;
    else out.failed += 1;
  }));
  return out;
}

async function fetchPosts() {
  const r = await fetch(SITE + '/js/posts.json?t=' + Date.now(), {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('posts.json HTTP ' + r.status);
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('posts.json bukan array');
  return d.filter((p) => p && Number.isInteger(p.id) && typeof p.url === 'string' && p.url.charAt(0) === '/' && p.title);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!authorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};
  const dry = body.dry === true;
  const dc = discordConfig();
  const tg = telegramConfig();

  let locked = false;
  try {
    if (body.test === true) {
      await sendToTopic({
        title: 'Tes notifikasi Henz MLBB',
        body: 'Kalau kamu melihat ini, notifikasi berfungsi dengan baik.',
        url: '/',
        icon: SITE + '/icons/icon-192.png',
        tag: 'test',
      });
      const wantPing = body.ping === true;
      let discord = { status: 'skipped', button: false };
      if (dc.url) {
        // Tanpa "ping": pesan uji biasa, tanpa mem-ping role. Dengan "ping": benar-benar mem-ping role (bila terkonfigurasi).
        const role = wantPing ? dc.role : '';
        const text = !wantPing
          ? 'Webhook test: if you can see this, the Discord connection works.'
          : (dc.role
            ? 'Ping test: this message should ping the role.'
            : 'Ping test: DISCORD_PING_ROLE_ID is missing or invalid, so no role was pinged.');
        discord = await sendDiscord(dc.url, {
          content: mentionPrefix(role) + text,
          allowed_mentions: discordAllowed(role),
          components: linkButtonRow('Open Henz Script', SITE + '/'),
        });
      }
      let telegram = { status: 'skipped', photo: false };
      if (tg.chat) {
        telegram = await sendTelegram(tg, {
          text: 'Telegram test: if you can see this, the bot works.',
          button: { text: 'Open Henz Script', url: SITE + '/' },
        });
      }
      let adminDm = 'skipped';
      if (tg.admins.length) {
        adminDm = await sendAdminDMs(tg, waAdminMessage(
          '*Tes bagikan ke WhatsApp*\nJika kamu melihat ini, bot bisa mengirim ke chat pribadimu.\n\n' + SITE + '/',
          SITE + '/',
          'Buka situs'
        ));
      }
      res.status(200).json({
        ok: true,
        test: true,
        ping_requested: wantPing,
        ping_role_configured: !!dc.role,
        discord: discord.status,
        button: discord.button,
        telegram: telegram.status,
        telegram_topic_configured: !!tg.thread,
        admin_dm: adminDm,
      });
      return;
    }

    const posts = await fetchPosts();
    if (!posts.length) {
      res.status(200).json({ ok: true, sent: 0, note: 'posts.json kosong' });
      return;
    }
    const newest = posts.reduce((m, p) => (p.id > m ? p.id : m), 0);

    const stored = await redis.get(LAST_KEY);
    if (stored === null || stored === undefined) {
      if (!dry) await redis.set(LAST_KEY, newest);
      res.status(200).json({ ok: true, baseline: newest, sent: 0, dry });
      return;
    }
    const lastId = Number(stored);
    const fresh = posts.filter((p) => p.id > lastId).sort((a, b) => a.id - b.id);
    if (!fresh.length) {
      res.status(200).json({ ok: true, sent: 0, last: lastId });
      return;
    }
    if (dry) {
      res.status(200).json({ ok: true, dry: true, last: lastId, discord_enabled: !!dc.url, ping_role_configured: !!dc.role, telegram_enabled: !!tg.chat, admin_dm_enabled: tg.admins.length > 0, would_send: fresh.map((p) => ({ id: p.id, title: p.title })) });
      return;
    }

    locked = !!(await redis.set(LOCK_KEY, '1', { nx: true, ex: 120 }));
    if (!locked) {
      res.status(409).json({ error: 'Pengiriman lain sedang berjalan' });
      return;
    }

    let sent = 0;
    let doneId = lastId;
    const discord = { enabled: !!dc.url, ping: !!dc.role, sent: 0, failed: 0, buttons: 0, without_button: 0 };
    const telegram = { enabled: !!tg.chat, topic: !!tg.thread, sent: 0, failed: 0, photos: 0, text_only: 0 };
    const whatsapp = { enabled: tg.admins.length > 0, admins: tg.admins.length, sent: 0, failed: 0 };
    const toDiscord = async (payload) => {
      const r = await sendDiscord(dc.url, payload);
      if (r.status === 'sent') {
        discord.sent += 1;
        if (r.button) discord.buttons += 1;
        else discord.without_button += 1;
      } else {
        discord.failed += 1;
      }
    };
    const toTelegram = async (msg) => {
      const r = await sendTelegram(tg, msg);
      if (r.status === 'sent') {
        telegram.sent += 1;
        if (r.photo) telegram.photos += 1;
        else telegram.text_only += 1;
      } else {
        telegram.failed += 1;
      }
    };
    const toAdmins = async (msg) => {
      const r = await sendAdminDMs(tg, msg);
      whatsapp.sent += r.sent;
      whatsapp.failed += r.failed;
    };
    // Kirim ke Discord, Telegram, dan chat pribadi admin (untuk WhatsApp) bersamaan (satu jeda per pesan, bukan per tujuan, agar fungsi tetap singkat).
    let announced = 0;
    const announce = async (discordPayload, telegramMsg, waMsg) => {
      if (!dc.url && !tg.chat && !tg.admins.length) return;
      if (announced > 0) await sleep(CHAT_GAP_MS);
      announced += 1;
      await Promise.all([
        dc.url ? toDiscord(discordPayload) : null,
        tg.chat ? toTelegram(telegramMsg) : null,
        tg.admins.length ? toAdmins(waMsg) : null,
      ]);
    };
    try {
      if (fresh.length <= MAX_INDIVIDUAL) {
        for (const p of fresh) {
          await sendToTopic(postMessage(p));
          sent += 1;
          doneId = p.id;
          await announce(discordPostPayload(p, dc.role), telegramPostMessage(p), waAdminMessage(waPostText(p), SITE + p.url, 'Buka post'));
        }
      } else {
        await sendToTopic(summaryMessage(fresh));
        sent = 1;
        doneId = fresh[fresh.length - 1].id;
        await announce(discordSummaryPayload(fresh, dc.role), telegramSummaryMessage(fresh), waAdminMessage(waSummaryText(fresh), SITE + '/', 'Buka situs'));
      }
    } finally {
      if (doneId > lastId) await redis.set(LAST_KEY, doneId); // simpan kemajuan walau gagal di tengah, supaya tidak terkirim dobel
    }
    res.status(200).json({ ok: true, sent, last: doneId, discord, telegram, whatsapp });
  } catch (err) {
    console.error('push-notify:', err && err.message);
    res.status(502).json({ error: 'Gagal: ' + (err && err.message ? err.message : 'unknown') });
  } finally {
    if (locked) {
      try { await redis.del(LOCK_KEY); } catch (e) { /* kunci kedaluwarsa sendiri dalam 120 dtk */ }
    }
  }
};
