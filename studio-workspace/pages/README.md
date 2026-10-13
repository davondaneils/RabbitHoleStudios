# GitHub Pages client — live read-only repository viewer

**Deployed URL:** https://davondaneils.github.io/RabbitHoleStudios/

Unlike the *local* studio server, the GitHub Pages site is static and **cannot authenticate GitHub writes or record official approvals**. Its purpose is to let the founder inspect current research, scripts, references and workflow stages on a phone.

## How live content works
- On page load, `site/app.js` imports `browser-api.js`, which requests the latest public `main` branch Git tree and directly fetches current Markdown documents. Each refresh or **Sync GitHub** action checks live GitHub again, so new episode artifacts are discoverable even if the build snapshot predates them.
- The UI explicitly distinguishes **live GitHub content** from an **offline/failed-fetch snapshot**. GitHub API rate limits or network failures can trigger the fallback. It does **not** silently claim the snapshot is current.
- A generated `snapshot.json` remains as an offline fallback, repository navigation/metadata, source manifest, and task-packet/template store. It is not the canonical live content.
- Existing browser-only drafts remain in localStorage and may temporarily display in place of a current GitHub version; they carry a clear unsynced label. **Export drafts** before clearing browser data.
- A file that exists on GitHub offers an **Edit on GitHub** link. GitHub authenticates the owner in its own UI; the Pages app never stores GitHub credentials. Press **Sync GitHub** after making an external GitHub edit.
- The Oobah script and its research are visible when present in `main` but remain **unapproved**. File existence never advances founder approval states.

## Source/build architecture
`pages/site/` contains the Pages-specific HTML/CSS/app UI, while `pages/browser-api.js` implements the live-read/browser-draft adapter. The local app UI remains in `public/` and its write-capable backend in `server.mjs`. These targets have different security and data capabilities; don't overwrite the Pages client with the local UI build.

Build from a checkout that contains `studio-workspace`:

```sh
npm ci --prefix studio-workspace
node studio-workspace/pages/build.mjs /tmp/studio-pages
node studio-workspace/pages/smoke.mjs /tmp/studio-pages
```

Deploy the generated output to the `gh-pages` root. GitHub Settings → Pages should target that branch. The snapshot is regenerated on rebuild, but new **public** main-branch files are already visible live without a redeploy.

**Security caveat:** The repository is currently public. Any files under GitHub main must be treated as publicly readable. If it becomes private, unauthenticated GitHub reads will stop working; migrate to an authenticated backend before relying on it for private material. Do not expose GitHub personal access tokens in the Pages JavaScript.

**Future two-way sync:** A secure authenticated GitHub service or OAuth-based backend is required for edits/approvals directly inside the app. Static GitHub Pages alone is intentionally read-only with respect to repository state.
