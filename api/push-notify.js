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
   Pengiriman Discord bersifat best-effort: kegagalannya tidak pernah menggagalkan notifikasi push ataupun memajukan patokan. */
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
const DISCORD_GAP_MS = 600; // jeda antar pesan Discord agar tidak kena batas laju webhook

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
  };
}

// Kirim satu pesan ke webhook. Hasil: 'sent' | 'failed'. Tidak pernah melempar error.
async function sendDiscord(url, payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) return 'sent';
      if (r.status === 429 && attempt === 0) {
        let wait = 1;
        try { wait = Number((await r.json()).retry_after) || 1; } catch (e) { /* pakai default */ }
        if (wait > 4) return 'failed';
        await sleep(wait * 1000 + 100);
        continue;
      }
      console.error('discord webhook HTTP ' + r.status); // jangan pernah mencatat URL webhook
      return 'failed';
    } catch (e) {
      console.error('discord webhook:', e && e.message);
      return 'failed';
    }
  }
  return 'failed';
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
      let discord = 'skipped';
      if (dc.url) {
        // Uji tanpa ping role, supaya anggota tidak terganggu.
        discord = await sendDiscord(dc.url, {
          content: 'Webhook test: if you can see this, the Discord connection works.',
          allowed_mentions: discordAllowed(''),
        });
      }
      res.status(200).json({ ok: true, test: true, discord, ping_role_configured: !!dc.role });
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
      res.status(200).json({ ok: true, dry: true, last: lastId, discord_enabled: !!dc.url, would_send: fresh.map((p) => ({ id: p.id, title: p.title })) });
      return;
    }

    locked = !!(await redis.set(LOCK_KEY, '1', { nx: true, ex: 120 }));
    if (!locked) {
      res.status(409).json({ error: 'Pengiriman lain sedang berjalan' });
      return;
    }

    let sent = 0;
    let doneId = lastId;
    const discord = { enabled: !!dc.url, sent: 0, failed: 0 };
    const toDiscord = async (payload) => {
      if (!dc.url) return;
      if (discord.sent + discord.failed > 0) await sleep(DISCORD_GAP_MS);
      if ((await sendDiscord(dc.url, payload)) === 'sent') discord.sent += 1;
      else discord.failed += 1;
    };
    try {
      if (fresh.length <= MAX_INDIVIDUAL) {
        for (const p of fresh) {
          await sendToTopic(postMessage(p));
          sent += 1;
          doneId = p.id;
          await toDiscord(discordPostPayload(p, dc.role));
        }
      } else {
        await sendToTopic(summaryMessage(fresh));
        sent = 1;
        doneId = fresh[fresh.length - 1].id;
        await toDiscord(discordSummaryPayload(fresh, dc.role));
      }
    } finally {
      if (doneId > lastId) await redis.set(LAST_KEY, doneId); // simpan kemajuan walau gagal di tengah, supaya tidak terkirim dobel
    }
    res.status(200).json({ ok: true, sent, last: doneId, discord });
  } catch (err) {
    console.error('push-notify:', err && err.message);
    res.status(502).json({ error: 'Gagal: ' + (err && err.message ? err.message : 'unknown') });
  } finally {
    if (locked) {
      try { await redis.del(LOCK_KEY); } catch (e) { /* kunci kedaluwarsa sendiri dalam 120 dtk */ }
    }
  }
};
