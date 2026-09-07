const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

const BROWSERS = [
  { name: 'chrome', manifest: 'manifest.chrome.json' },
  { name: 'chrome-store', manifest: 'manifest.chrome-store.json' },
  { name: 'firefox', manifest: 'manifest.firefox.json' },             // приватный .xpi (NMO Helper, id=nmo-helper@extension)
  { name: 'firefox-store', manifest: 'manifest.firefox-store.json' }, // для Firefox Add-ons (NMO-Helper, id=nmo-helper-amo@extension)
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }

  for (const browser of BROWSERS) {
    const outDir = path.join(DIST, browser.name);
    fs.mkdirSync(outDir, { recursive: true });

    const commonOptions = {
      bundle: true,
      minify: true,
      format: 'iife',
      target: 'es2020',
      charset: 'utf8',
      define: {
        __BUILD_TARGET__: JSON.stringify(browser.name),
      },
      jsx: 'automatic',
      jsxImportSource: 'react',
    };

    await esbuild.build({
      ...commonOptions,
      entryPoints: [path.join(SRC, 'content.ts')],
      outfile: path.join(outDir, 'content.js'),
      plugins: [sassPlugin()],
    });

    await esbuild.build({
      ...commonOptions,
      entryPoints: [path.join(SRC, 'background.ts')],
      outfile: path.join(outDir, 'background.js'),
    });

    console.log(`[OK] ${browser.name} -> dist/${browser.name}/`);

    // Copy manifest
    fs.copyFileSync(
      path.join(SRC, browser.manifest),
      path.join(outDir, 'manifest.json')
    );

    // Copy icons
    copyDir(path.join(SRC, 'icons'), path.join(outDir, 'icons'));

    // Copy popup
    fs.copyFileSync(path.join(SRC, 'popup.html'), path.join(outDir, 'popup.html'));
    fs.copyFileSync(path.join(SRC, 'popup.css'), path.join(outDir, 'popup.css'));
    fs.copyFileSync(path.join(SRC, 'popup.js'), path.join(outDir, 'popup.js'));

    // Copy pdfjs worker for med-pdf-nmo browser runtime.
    fs.copyFileSync(
      path.join(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
      path.join(outDir, 'pdf.worker.min.mjs')
    );

    // Подписанный .xpi (firefox_nmo_helper.xpi) лежит в корне репо и
    // распространяется как отдельный артефакт релиза. В dist/ не копируем —
    // иначе при упаковке firefox-зипа он попадает внутрь и раздувает его.
  }

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
