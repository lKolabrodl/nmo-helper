const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

const BROWSERS = [
  { name: 'chrome', manifest: 'manifest.chrome.json' },
  { name: 'firefox', manifest: 'manifest.firefox.json' },
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

    // Bundle content scripts into one file
    await esbuild.build({
      entryPoints: [path.join(SRC, 'content.ts')],
      outfile: path.join(outDir, 'content.js'),
      bundle: true,
      minify: true,
      format: 'iife',
      target: 'es2020',
      charset: 'utf8',
    });

    // Bundle background script
    await esbuild.build({
      entryPoints: [path.join(SRC, 'background.ts')],
      outfile: path.join(outDir, 'background.js'),
      bundle: true,
      minify: true,
      format: 'iife',
      target: 'es2020',
      charset: 'utf8',
    });

    // Minify CSS
    await esbuild.build({
      entryPoints: [path.join(SRC, 'content.css')],
      outfile: path.join(outDir, 'content.css'),
      minify: true,
    });

    // Copy manifest
    fs.copyFileSync(
      path.join(SRC, browser.manifest),
      path.join(outDir, 'manifest.json')
    );

    // Copy icons
    copyDir(path.join(SRC, 'icons'), path.join(outDir, 'icons'));

    // Copy .xpi for Firefox
    if (browser.name === 'firefox') {
      fs.copyFileSync(
        path.join(SRC, 'firefox_nmo_helper.xpi'),
        path.join(outDir, 'firefox_nmo_helper.xpi')
      );
    }

    console.log(`[OK] ${browser.name} -> dist/${browser.name}/`);
  }

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
