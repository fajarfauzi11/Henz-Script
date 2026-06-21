/* build.js — Henz MLBB static site build script
   Membaca semua file di public/, mengganti placeholder
   <!-- include:nama.html --> dengan isi public/partials/nama.html,
   lalu menulis hasilnya ke dist/. File non-HTML di-copy apa adanya.
*/
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'public');
const OUT_DIR = path.join(__dirname, 'dist');
const PARTIALS_DIR = path.join(SRC_DIR, 'partials');

const INCLUDE_RE = /<!--\s*include:([\w.-]+)\s*-->/g;

function readPartial(name) {
  const partialPath = path.join(PARTIALS_DIR, name);
  if (!fs.existsSync(partialPath)) {
    throw new Error('Partial tidak ditemukan: ' + partialPath);
  }
  return fs.readFileSync(partialPath, 'utf8');
}

function processHtml(content) {
  return content.replace(INCLUDE_RE, (match, partialName) => {
    return readPartial(partialName);
  });
}

function copyRecursive(srcDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'partials') continue; // partials tidak ikut di-deploy

    const srcPath = path.join(srcDir, entry.name);
    const outPath = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, outPath);
    } else if (entry.name.endsWith('.html')) {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const processed = processHtml(raw);
      fs.writeFileSync(outPath, processed, 'utf8');
      console.log('built:', path.relative(SRC_DIR, srcPath));
    } else {
      fs.copyFileSync(srcPath, outPath);
    }
  }
}

console.log('Building site...');
if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
copyRecursive(SRC_DIR, OUT_DIR);
console.log('Build selesai. Output di:', OUT_DIR);
