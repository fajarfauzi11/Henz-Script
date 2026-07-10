# HenzScript Static Site

## Cara Tambah Post Baru

1. Buka GitHub → folder `public/post/`
2. Klik `Add file` → `Create new file`
3. Nama file: `nama-hero-skin.html` (contoh: `harith-starlight.html`)
4. Copy isi dari `post/template.html`
5. Edit bagian yang bertanda `✏️ EDIT:`
6. Commit/Save

7. Buka `public/js/posts.json`
8. Tambah baris baru di array:
```json
{
  "id": 2,
  "title": "Harith Starlight Script",
  "url": "/post/harith-starlight.html",
  "thumb": "https://url-gambar-kamu.jpg",
  "cat": "Mage",
  "date": "12 Jun 2026",
  "author": "Henz Official",
  "comments": 0
}
```
9. Commit — Vercel auto deploy ~1 menit
