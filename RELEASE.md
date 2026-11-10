# Release checklist

This file records the project release flow so the next release does not depend
on memory.

## Version 5.1.2

Prepared on `main` on November 11, 2026. The ten commits from `dev`, through
`bfae2a5`, were squashed into the single-parent commit `56c8d05`.
Firefox signing was completed by the owner on the same day.

- Add JarvisClaw and BlockRun to the keyless free AI fallback chain and update
  route priority.
- Improve sequential fallback between answer sources and show search, loading
  and waiting-for-question states in automatic mode.
- Drive automatic answer selection and navigation with configured intervals;
  pause the cycle while the mouse is moving.
- Display site search results as sources finish and preserve a cleared search
  field instead of restoring the detected topic.
- Preserve selected answers when collecting a completed quiz for optional
  sharing, including when the portal replaces or reorders answer elements.
- Show automatic-answer state in the compact bug report preview.

Local validation:

- `npm test`: 981/981 tests, 59/59 files, both before and after the version bump.
- `npx tsc --noEmit --pretty false`: clean before and after the version bump.
- `npm run build`: all four browser targets built successfully.
- `npm run lint`: no errors, 6 existing warnings.
- Package metadata, all four source and built manifests, and every popup use
  `5.1.2`.
- Archive contents and checksums are recorded in
  `output/release-5.1.2/artifacts.json` and `output/release-5.1.2/SHA256SUMS.txt`.
- A clean build from the AMO source archive matches all four browser targets
  and all three browser ZIP archives byte-for-byte. Results are recorded in
  `output/release-5.1.2/source-validation-report.json`.
- The signed Firefox package uses `5.1.2` and `nmo-helper@extension`. Its PKCS7
  and COSE signatures, certificate chains to the Mozilla production root, and
  all signed file digests were verified. Code and resources match
  `dist/firefox/`; the manifest differs only in formatting. Details are in
  `output/release-5.1.2/signed-package-validation.json`.

Prepared archives in the repository root:

- `nmo-helper-chrome-5.1.2.zip`
- `nmo-helper-firefox-5.1.2.zip` — unlisted Firefox signing submission.
- `nmo-helper-firefox-store-5.1.2.zip` — listed AMO submission.
- `nmo-helper-source-5.1.2.zip`, including updated `BUILD.md`.

Release title:
`NMO Helper v5.1.2 — улучшения авторежима, поиска и бесплатного AI`.
Russian release notes and AMO reviewer notes are saved locally in
`output/release-5.1.2/release-notes.txt` and
`output/release-5.1.2/notes-to-reviewer.txt`.

README installation links point to `v5.1.2`; the previous versions
section includes `v5.1.1`. The VirusTotal badge still explicitly refers to
`5.1.0`; update it only after a confirmed scan of the new Chrome archive.

Release tag: `v5.1.2`. Public manual assets:

- `firefox_nmo_helper.xpi` — signed Firefox package, version `5.1.2`.
- `nmo-helper-chrome-5.1.2.zip` — Chromium build, version `5.1.2`.

The website mirror uses the exact same Chrome ZIP at
`https://nmo-helper.ru/assets/downloads/nmo-helper-chrome-5.1.2.zip`.
The site release card, current download links and `/api/version` use `5.1.2`.

The AMO source archive is retained as submitted, before signing. Its original
checksum and successful clean rebuild report remain in `output/release-5.1.2/`.

## Version 5.1.1

Prepared on `main` on November 5, 2026, after merging `dev`
in commit `c81efba`. Firefox signing was completed by the owner on the same day.

- Run free AI in automatic mode when answer lookup fails, returns no sources,
  or finds no matching answer. Attempt it once per visit to a question.
- Clear stale answer highlights when questions change, refresh highlights when
  variants are reordered, and match numbered variants by text.
- Scroll the AI model dropdown to the selected model when it opens.

Local validation:

- `npm test`: 879/879 tests, 56/56 files.
- `npx tsc --noEmit --pretty false`: clean.
- `npm run build`: all four browser targets built successfully.
- `npm run lint`: no errors, 6 existing warnings.
- Package metadata, all four source and built manifests, and every popup use
  `5.1.1`.
- The signed Firefox package uses `5.1.1` and `nmo-helper@extension`. Its
  cryptographic signature and all signed file digests were verified. Code and
  resources match `dist/firefox/`; the manifest differs only in formatting.
- Source rebuild details and archive checksums are recorded locally in
  `output/release-5.1.1/source-validation-report.json` and
  `output/release-5.1.1/SHA256SUMS.txt`.

Prepared archives in the repository root:

- `nmo-helper-chrome-5.1.1.zip`
- `nmo-helper-firefox-5.1.1.zip`
- `nmo-helper-firefox-store-5.1.1.zip`
- `nmo-helper-source-5.1.1.zip`, including updated `BUILD.md`.

Release title: `NMO Helper v5.1.1 — исправления AI и подсветки ответов`.
Russian release notes are saved locally in
`output/release-5.1.1/release-notes.txt`; AMO reviewer notes are in
`output/release-5.1.1/notes-to-reviewer.txt`.

Release tag: `v5.1.1`. Public manual assets:

- `firefox_nmo_helper.xpi` — signed Firefox package, version `5.1.1`.
- `nmo-helper-chrome-5.1.1.zip` — Chromium build, version `5.1.1`.

README installation links point to `v5.1.1`; the previous versions section
includes `v5.1.0`. The VirusTotal badge still explicitly refers to `5.1.0`;
refresh it once a confirmed scan of the `5.1.1` Chrome archive is available.

The AMO source archive is retained as submitted, before signing. Its original
checksum and successful clean rebuild report remain in `output/release-5.1.1/`.

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

## Required ZIP mirror on the website

Every release must also provide the public Chromium ZIP directly from
`nmo-helper.ru`, so users can download it when GitHub is unavailable.
The website must offer the latest published stable version. Upload its ZIP
and update all current-version download and mirror links in the same site
deployment before completing the release.

1. Copy the exact `nmo-helper-chrome-<version>.zip` prepared for the GitHub
   Release into `assets/downloads/` in the sibling `nmo-helper.ru` repository.
   Keep the version in the filename. Do not rebuild or repackage the mirror.
2. Compare SHA-256 checksums of the release ZIP and the website copy; they
   must match. Commit the mirrored ZIP with the website changes; this path is
   explicitly allowed by the website's `.gitignore`.
3. Update the current version and mirror links on `/install`,
   `/install/chrome`, `/install/yandex`, `/update`, and the current release
   card on `/releases`. Put “Скачать с сайта” below each ZIP download button
   or in parentheses next to a text link, pointing directly to
   `/assets/downloads/nmo-helper-chrome-<version>.zip` on the same site.
4. Follow the website's `AGENTS.md` and deploy the static site through
   `python scripts/deploy.py --component site`. The deploy script includes
   `assets/downloads/` automatically. Keep previously published mirrors.
5. Verify that the public mirror URL downloads a ZIP directly from
   `nmo-helper.ru` without redirecting to GitHub, returns HTTP 200, and has the
   same SHA-256 checksum and manifest version as the release ZIP.

The release is not complete until its website mirror is available and verified.

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
