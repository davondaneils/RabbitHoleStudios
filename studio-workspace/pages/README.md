# Browser demo on GitHub Pages

The browser build reads a generated snapshot of the repository, not a separate database. It exposes only manifest-indexed studio documents, not the archive or repository configuration. Linked images stay at their original hosts.

Edits are unreviewed drafts in this browser's localStorage. Export drafts downloads a JSON file with canonical repository paths and Markdown content; apply those files through the local workspace's diff review. The demo never updates GitHub or records official approvals. Research/script/production gates reflect the checked-in repository state and cannot be cleared by browser drafts. Clearing browser data removes drafts; export before doing so. New deployments update source documents while preserving browser drafts.

Build from the repository root:

```sh
npm ci --prefix studio-workspace
node studio-workspace/pages/build.mjs /tmp/studio-pages
node studio-workspace/pages/smoke.mjs /tmp/studio-pages
```

The smoke check uses the design-kb Playwright installation; set DESIGN_KB_TOOLS if it is elsewhere.

Deployment: the generated site is on the `gh-pages` branch. In GitHub repository Settings → Pages, choose **Deploy from a branch**, **gh-pages**, **/ (root)**, then Save. GitHub normally publishes at `https://davondaneils.github.io/RabbitHoleStudios/`. Repository plan/visibility must support Pages. Do not change repository visibility to enable it. Pages access controls depend on the repository's GitHub plan; this static demo has no application authentication.

Updates require rebuilding from the source branch and republishing `gh-pages`. The published files contain a source snapshot, not a live GitHub API integration.
