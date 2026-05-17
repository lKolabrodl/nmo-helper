# Release checklist

This file records the project release flow so the next release does not depend
on memory.

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
- `src/manifest.firefox.json`
- `src/manifest.firefox-store.json`
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

Expected local artifacts for a release:

- `nmo-helper-chrome-<version>.zip`
  - Public GitHub Release asset.
  - Contains a top-level folder like `nmo-helper-chrome-4.1.0/`.
- `nmo-helper-firefox-store-<version>.zip`
  - Upload to Firefox Add-ons / AMO.
  - `manifest.json` is at archive root.
- `nmo-helper-source-<version>.zip`
  - Source archive for AMO reviewers.
  - Include source files, configs, lock files, `README.md`, and `BUILD.md`.
  - Do not include `dist/`, `node_modules/`, `.git/`, zip files, or xpi files.
- `nmo-helper-firefox-<version>.zip`
  - Local/private Firefox build artifact if needed.
  - Do not attach this to the public GitHub Release by default.
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
