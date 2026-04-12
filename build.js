const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const WATCH = process.argv.includes('--watch');

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

    const commonOptions = {
      bundle: true,
      minify: !WATCH,
      format: 'iife',
      target: 'es2020',
      charset: 'utf8',
      define: { __DEV__: WATCH ? 'true' : 'false' },
      jsx: 'automatic',
      jsxImportSource: 'react',
    };

    if (WATCH) {
      const rebuildPlugin = {
        name: 'rebuild-log',
        setup(build) {
          build.onEnd((result) => {
            const time = new Date().toLocaleTimeString();
            if (result.errors.length > 0) {
              console.log(`[${time}] Build failed with ${result.errors.length} error(s)`);
            } else {
              console.log(`[${time}] Rebuilt ${browser.name} successfully`);
              fs.writeFileSync(
                path.join(outDir, 'dev-reload.json'),
                JSON.stringify({ timestamp: Date.now() })
              );
            }
          });
        },
      };

      const contentCtx = await esbuild.context({
        ...commonOptions,
        entryPoints: [path.join(SRC, 'content.ts')],
        outfile: path.join(outDir, 'content.js'),
        plugins: [sassPlugin(), rebuildPlugin],
      });

      const backgroundCtx = await esbuild.context({
        ...commonOptions,
        entryPoints: [path.join(SRC, 'background.ts')],
        outfile: path.join(outDir, 'background.js'),
        plugins: [rebuildPlugin],
      });

      await Promise.all([
        contentCtx.watch(),
        backgroundCtx.watch(),
      ]);

      console.log(`[WATCH] ${browser.name} -> dist/${browser.name}/`);
    } else {
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
    }

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

    // Copy .xpi for Firefox
    if (browser.name === 'firefox') {
      fs.copyFileSync(
        path.join(SRC, 'firefox_nmo_helper.xpi'),
        path.join(outDir, 'firefox_nmo_helper.xpi')
      );
    }
  }

  if (WATCH) {
    console.log('\nWatching for changes... (Ctrl+C to stop)');
    console.log('Reload the extension in chrome://extensions after each change.');
  } else {
    console.log('Build complete!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
