# Mode Hemat CDN

Switch untuk menghemat kuota **Edge Requests** Vercel saat kuota bulanan hampir habis. Prioritas tunggal: pengunjung bisa membuka
post, menekan link download, melewati gate Adsterra, dan sampai ke link asli. Tidak ada kode yang dihapus; saat dimatikan, situs
kembali persis seperti biasa.

## Menyalakan / mematikan

1. Vercel > Project `henz-script` > Settings > Environment Variables.
2. **Nyalakan:** tambah `HZ_SAVER` = `1` (Production). **Matikan:** hapus variabel itu.
3. Deployments > deployment terbaru > Redeploy (opsional: matikan "Use existing Build Cache"). Selesai dalam sekitar 1-2 menit.

Tidak perlu mengubah kode atau commit. Cek Build Logs: mode hemat mencetak `mode hemat: HZ_POST ditanam di N halaman post` dan
`built: sw.js (MODE HEMAT: kill-switch ...)`. Pagar pengaman build memastikan HTML, sw.js, dan tag CSS/JS sesuai mode.

Variabel lain (hanya dipakai saat `HZ_SAVER=1`):

| Variabel | Fungsi |
|---|---|
| `HZ_VIEW_ENDPOINT` | URL Cloudflare Worker pencatat view, mis. `https://henz-view.<akun>.workers.dev`. Kosong = view tidak dicatat sama sekali selama mode hemat. |

## Yang berubah saat mode hemat aktif

| Fitur | Perilaku |
|---|---|
| Catat view | Tidak ada `POST /api/view`. View dikirim ke Worker Cloudflare (bukan Vercel) bila `HZ_VIEW_ENDPOINT` diisi, satu kali per post per sesi. |
| Angka view di web | Tetap snapshot saat build (tidak bergerak sampai redeploy), sama seperti mode normal. Tanpa snapshot, angka tampil "-" (tidak ada fallback `/api/view`). |
| `posts.json` | Tidak diunduh di halaman post (id+slug ditanam di HTML), saat membuka riwayat/favorit, atau membuka lonceng. Tetap dipakai beranda dan pencarian. |
| Saran pencarian | Dropdown hanya menampilkan pencarian terakhir (localStorage). Tanpa saran hero/kategori/populer. Halaman hasil pencarian tetap berfungsi. |
| Manifest PWA | `<link rel="manifest">` tidak disisipkan (baris "Install Aplikasi" di Chrome/Android hilang). Penambahan ke layar utama iPhone tetap ada. |
| Service worker | Dilepas total: tidak ada pendaftaran dan tidak ada pemeriksaan `sw.js`. Cache offline dihapus. |
| Notifikasi push | Dijeda (modal lonceng menjelaskan). Data langganan di perangkat tetap tersimpan. Telegram/WhatsApp/Discord tidak terpengaruh. |
| CSS dan JS | Disajikan dari jsDelivr (tag git), dengan **fallback otomatis** ke salinan Vercel bila jsDelivr gagal/diblokir/404. |

Tidak berubah: halaman post, tombol download, gate Adsterra, link asli (semuanya tidak memakai request ke Vercel selain HTML post).

## Pemulihan saat mode hemat dimatikan

- Service worker terdaftar lagi otomatis di kunjungan berikutnya (penanda `hz_sw_want`).
- Pelanggan notifikasi: begitu SW terdaftar lagi, token push diperbarui langsung (tanpa dialog izin) dan penanda `hz_sw_killed`
  dihapus. Bila gagal (mis. offline), diulang di kunjungan berikutnya.
- Cache offline terisi lagi pelan-pelan seiring kunjungan.
- Pengunjung yang punya SW lama melepasnya di kunjungan pertama setelah mode hemat aktif (langsung dari halaman, tanpa menunggu
  pemeriksaan `sw.js`).

## Persiapan satu kali

### A. Aset CSS/JS di jsDelivr (workflow `cdn-assets.yml`)

1. Push kode ini ke `main`. Workflow **Aset CDN (jsDelivr)** berjalan otomatis (atau tombol Run workflow) dan membuat tag `a<hashcss>-<hashjs>`.
2. Cek tab Actions: langkah "Pemanasan dan pengecekan jsDelivr" harus menampilkan `OK` untuk kedua berkas.
3. Baru setelah itu nyalakan `HZ_SAVER=1`. Setiap kali CSS/JS berubah, workflow membuat tag baru otomatis; selama tag itu belum
   tersedia di jsDelivr, pengunjung memakai salinan Vercel (aman, hanya tidak hemat).

### B. Worker pencatat view (Cloudflare)

1. dash.cloudflare.com > Workers & Pages > Create > Create Worker, beri nama (mis. `henz-view`), Deploy, lalu Edit code.
2. Tempel isi `worker/view-counter.js`, Deploy.
3. Worker > Settings > Variables and Secrets, tambah **Secret**: `UPSTASH_URL` (nilai `KV_REST_API_URL` dari Vercel) dan
   `UPSTASH_TOKEN` (nilai `KV_REST_API_TOKEN`). Opsional `MAX_ID` (id post terbesar, naikkan saat post bertambah).
4. Salin URL Worker (`https://henz-view.<akun>.workers.dev`) ke Vercel sebagai `HZ_VIEW_ENDPOINT`.
5. Uji: buka sebuah post saat mode hemat aktif, lalu cek angka kunci `view:<id>:<slug>` di Upstash bertambah 1.

Catatan: kunci yang ditulis Worker sama dengan yang ditulis `api/view.js`, jadi angka menyatu. Setiap view = 1 perintah `INCR` di Upstash;
pantau kuota perintah bulanan Upstash di dashboard-nya. Seperti `api/view.js`, Worker tidak membatasi per pengunjung (hanya cek Origin,
format id/slug, dan `MAX_ID`).

## Berkas yang terlibat

`build.js` (flag `HZ_SAVER`, tag CSS/JS, `sw.js` kill-switch, `--cdn-assets`), `public/js/main.js`, `public/js/floating-menu.js`,
`public/js/notify.js` (cabang `window.HZ_SAVER`), `worker/view-counter.js`, `.github/workflows/cdn-assets.yml`.

Perbaikan yang berlaku di semua mode: form pencarian langsung ke `/search`, bug request `/alt=` di halaman request-script,
`/search` dikeluarkan dari sitemap dan ditutup di `robots.txt`.
