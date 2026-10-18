/* api/_lib/fcm.js — Pembantu Firebase Cloud Messaging tanpa dependensi tambahan (hanya modul bawaan Node).
   Awalan "_" membuat Vercel TIDAK menganggap file ini sebagai fungsi serverless sendiri (tidak menambah jumlah fungsi).

   Butuh environment variable FIREBASE_SERVICE_ACCOUNT = isi lengkap file JSON service account Firebase.
   - getAccessToken : tukar JWT bertanda tangan service account dengan access token OAuth2 (dicache selama masih berlaku).
   - sendToTopic    : kirim pesan "data-only" ke topic FCM (satu request menjangkau semua pelanggan).
   - topicSubscribe : daftarkan / batalkan token ke topic lewat API topic management (iid.googleapis.com). */
const crypto = require('crypto');

const TOPIC = 'all';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'https://www.googleapis.com/auth/firebase.messaging',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

let cachedSa = null;
let cachedToken = null; // { value, exp(ms) }

function loadServiceAccount() {
  if (cachedSa) return cachedSa;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT belum diatur');
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid');
  }
  if (!sa || !sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT tidak lengkap (butuh client_email, private_key, project_id)');
  }
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n'); // jaga-jaga kalau newline ter-escape ganda
  cachedSa = sa;
  return sa;
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(sa, nowSec) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  }));
  const unsigned = header + '.' + claims;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  return unsigned + '.' + b64url(signature);
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.exp - 60000 > now) return cachedToken.value;
  const sa = loadServiceAccount();
  const assertion = signJwt(sa, Math.floor(now / 1000));
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(assertion),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('OAuth gagal (' + res.status + '): ' + text.slice(0, 300));
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error('OAuth: respons bukan JSON'); }
  if (!json.access_token) throw new Error('OAuth: access_token kosong');
  cachedToken = { value: json.access_token, exp: now + (Number(json.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

/* FCM mewajibkan semua nilai di field data bertipe string */
function stringifyData(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    const v = data[k];
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  });
  return out;
}

async function sendToTopic(data) {
  const sa = loadServiceAccount();
  const accessToken = await getAccessToken();
  const res = await fetch('https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(sa.project_id) + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: TOPIC,
        data: stringifyData(data),
        webpush: { headers: { TTL: '86400', Urgency: 'normal' } },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('FCM send gagal (' + res.status + '): ' + text.slice(0, 300));
  return text;
}

async function topicSubscribe(token, subscribe) {
  const accessToken = await getAccessToken();
  const res = await fetch('https://iid.googleapis.com/iid/v1:' + (subscribe ? 'batchAdd' : 'batchRemove'), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      access_token_auth: 'true',
    },
    body: JSON.stringify({ to: '/topics/' + TOPIC, registration_tokens: [token] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Topic ' + (subscribe ? 'add' : 'remove') + ' gagal (' + res.status + '): ' + text.slice(0, 300));
  let json = {};
  try { json = JSON.parse(text); } catch (e) { /* respons kosong dianggap sukses */ }
  const r0 = json && Array.isArray(json.results) ? json.results[0] : null;
  if (r0 && r0.error) throw new Error('Topic ' + (subscribe ? 'add' : 'remove') + ' ditolak: ' + r0.error);
  return true;
}

module.exports = { TOPIC, signJwt, loadServiceAccount, getAccessToken, sendToTopic, topicSubscribe };
