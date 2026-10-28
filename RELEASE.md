# Release checklist

This file records the project release flow so the next release does not depend
on memory.

## Version 5.1.0

Prepared on `main` after merging `dev`. Firefox publication and signing were
completed by the owner on October 28, 2026.

- Preview portal-loaded questions and answer variants before starting a quiz,
  with TXT download when the complete question list is available.
- Fall back to free AI in automatic mode when found answer sources return
  an empty result.
- Add Kilo to the free AI fallback chain.
- Prioritize exact question and variant matches over similar matches.
- Improve quiz state handling and close previews when leaving the start screen
  or switching topics.

Local validation:

- `npm test`: 848/848 tests, 56/56 files.
- `npx tsc --noEmit --pretty false`: clean.
- `npm run build`: all four browser targets built successfully.
- Package metadata, all four source and built manifests, and every popup use
  `5.1.0`.
- A clean build from the AMO source archive matches all four prepared browser
  targets byte-for-byte.

Prepared archives:

- `nmo-helper-chrome-5.1.0.zip`
- `nmo-helper-firefox-5.1.0.zip`
- `nmo-helper-firefox-store-5.1.0.zip`
- `nmo-helper-source-5.1.0.zip`, including updated `BUILD.md`.

The signed `firefox_nmo_helper.xpi` contains version `5.1.0` and uses the private
Firefox ID `nmo-helper@extension`. Its code and resources match `dist/firefox/`;
the manifest has identical settings and differs only in formatting. Public
manual assets remain only the signed XPI and Chrome ZIP.

Release title: `NMO Helper v5.1.0 — просмотр вопросов и улучшения бесплатного AI`.
The annotated tag is `v5.1.0`. README installation links point to this release.

## Version 5.0.2

This maintenance release fixes quiz topic detection that could prevent
automatic answer search from finding results on the NMO portal.

Other changes included from `dev`:

- Match answer highlights against the current variant texts and restore them
  after the page replaces DOM elements or reorders variants.
- Restore standard selection and clipboard commands on the quiz page.
- Add the Support link to the extension popup.

Local validation:

- `npm test`: 772/772 tests, 54/54 files.
- `npx tsc --noEmit --pretty false`: clean.
- `npm run build`: all four browser targets built successfully.
- Package metadata, all four source and built manifests, and every popup use
  `5.0.2`.
- A clean build from the AMO source archive matches all four prepared browser
  targets byte-for-byte.
- The signed Firefox package contains version `5.0.2`. Its code and resources
  match `dist/firefox/`; the manifest has identical settings and differs only
  in formatting.

Local archives:

- `nmo-helper-chrome-5.0.2.zip`
- `nmo-helper-firefox-5.0.2.zip`
- `nmo-helper-firefox-store-5.0.2.zip`
- `nmo-helper-source-5.0.2.zip`, including updated `BUILD.md`.

Public GitHub Release assets:

- `firefox_nmo_helper.xpi` — signed Firefox package, version `5.0.2`.
- `nmo-helper-chrome-5.0.2.zip` — Chromium build, version `5.0.2`.

Release title: `NMO Helper v5.0.2 — исправление поиска темы`.
The annotated tag is `v5.0.2`. README installation links point to this release.

## Branch flow

1. Finish and test changes on `dev`.
2. Switch to `main`.
3. Merge `dev` into `main`.
4. Resolve conflicts carefully without reverting unrelated user changes.
5. Run checks before version bump when the merge touched code:

```bash
npm test
npx tsc --noEmit --pretty false
npm run build
```

## Version bump

Use the release version, for example `4.1.0`:

```bash
npm version 4.1.0 --no-git-tag-version
```

Then make sure the same version is present in:

- `package.json`
- `package-lock.json`
- `src/manifest.chrome.json`
- `src/manifest.chrome-store.json`
- `src/manifest.firefox.json`
- `src/manifest.firefox-store.json`
- `src/popup.html`
- `README.md`

After the version bump, rebuild `dist/`:

```bash
npm run build
```

Run final checks:

```bash
npm test
npx tsc --noEmit --pretty false
```

## Local artifacts

Create archives with Python `zipfile`, not PowerShell `Compress-Archive`.
The generated zip files are ignored by git.

Prepare all four zip archives for every release:

- `nmo-helper-chrome-<version>.zip`
  - Chromium build for Chrome / Yandex Browser / Edge / Brave / Opera.
- `nmo-helper-firefox-<version>.zip`
  - Firefox build for signing/private distribution.
- `nmo-helper-firefox-store-<version>.zip`
  - Firefox Add-ons / AMO store build.
  - `manifest.json` is at archive root.
- `nmo-helper-source-<version>.zip`
  - Source archive for Firefox Add-ons / AMO reviewers.
  - Include source files, configs, lock files, `README.md`, and `BUILD.md`.
  - Do not include `dist/`, `node_modules/`, `.git/`, zip files, or xpi files.

After AMO approval, also keep the signed package:

- `firefox_nmo_helper.xpi`
  - Signed Firefox package after AMO approval.
  - Public GitHub Release asset.

For AMO source review, keep `BUILD.md` updated to the current version before
creating `nmo-helper-source-<version>.zip`.

## AMO notes

The Firefox Add-ons submission may show warnings. For `4.1.0`, the known
warnings were:

- `data_collection_permissions` requires newer Firefox than
  `strict_min_version: 109.0`. This is a compatibility warning for Firefox's
  built-in consent UI, not a runtime blocker.
- `Function constructor`, dynamic `import()`, and some `innerHTML` warnings
  come from bundled PDF.js / React / parsing helpers. Explain in review notes
  that PDF.js is used for local browser-side PDF parsing.

Useful AMO review notes:

```text
PDF files are processed locally in the browser by the extension and are not
uploaded by the PDF feature.

Bug reports are optional and user-triggered. They may include diagnostic
context such as topic, question, answer variants, source URL, user comment,
extension version, browser user agent, and current panel mode/tab.

The bundled pdf.worker.min.mjs file is required by PDF.js for browser-side PDF
parsing.
```

## GitHub Release assets

Public GitHub Release must have only these manual assets:

- `firefox_nmo_helper.xpi`
- `nmo-helper-chrome-<version>.zip`

Do not attach these to the public GitHub Release:

- `nmo-helper-firefox-store-<version>.zip`
- `nmo-helper-firefox-<version>.zip`
- `nmo-helper-source-<version>.zip`

GitHub automatically adds:

- `Source code (zip)`
- `Source code (tar.gz)`

So the release UI should show four assets total: two manual assets plus the two
automatic source-code archives.

## Commit, tag, push

Commit the release after AMO approves and the signed xpi is updated:

```bash
git add -u
git commit -m "v<version>: <short release summary>"
```

Create an annotated tag with release notes:

```bash
git tag -a v<version> -F <release-notes-file>
```

Push main and the tag:

```bash
git push origin main
git push origin v<version>
```

Create the GitHub Release from the existing tag:

```bash
gh release create v<version> \
  --verify-tag \
  --title "v<version> - <release title>" \
  --notes-file <release-notes-file> \
  firefox_nmo_helper.xpi \
  nmo-helper-chrome-<version>.zip
```

Verify after publishing:

```bash
gh release view v<version> --json tagName,name,isDraft,isPrerelease,url,assets
git status --short --branch
```

## Version 4.1.0 example

Manual GitHub Release assets for `v4.1.0`:

- `firefox_nmo_helper.xpi`
- `nmo-helper-chrome-4.1.0.zip`

AMO/local-only artifacts:

- `nmo-helper-firefox-store-4.1.0.zip`
- `nmo-helper-firefox-4.1.0.zip`
- `nmo-helper-source-4.1.0.zip`

Final release checks used for `v4.1.0`:

- `npm test`: 312/312.
- `npx tsc --noEmit --pretty false`: clean.
- `npm run build`: successful.
