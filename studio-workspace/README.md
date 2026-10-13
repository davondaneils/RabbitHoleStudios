# Local studio workspace

A small single-user view and editor of RabbitHoleStudios. The three-account overview reads `TRACKING/pilots.csv`. The working vertical slice is Psychology → The Setup → PSY-A-01. Other pilots show their existing briefs.

To open the app on your computer, install [Node.js 22 or newer](https://nodejs.org/) if needed. Keep this directory inside RabbitHoleStudios alongside `SHOWS`, `STUDIO` and `TRACKING`.

From the repository root, run one command:

```sh
node studio-workspace/open.mjs
```

The launcher installs the two locked dependencies if needed and opens your default browser. Keep the terminal open while you use the studio; press Ctrl+C to stop. On Mac you can use `Open Studio.command`; on Windows use `Open Studio.bat`.

The app runs on your computer. The cloud onboarding chat cannot provide a live preview of its private local server. A screenshot link is a picture, not the running app.

The launcher reuses a server only when it belongs to this exact folder. If the usual port 3210 is occupied by another service, it uses a free port and opens the correct address. Set `PORT` to choose a port or `STUDIO_NO_BROWSER=1` for a headless launch.

From this directory, `npm start` also launches and opens the studio. `npm run serve` starts the server without opening a browser. Do not expose this local app publicly without adding access controls.

You can open a downloaded repository ZIP. Markdown edits and human reviews work there. Git commit review requires a Git clone; the app explains this when you choose Review changes in a downloaded copy.

```sh
npm test
```

Browser smoke checks use a disposable copy, including all save and approval actions, so the real studio content remains unchanged. With design-kb/tools installed and Chromium available:

```sh
node tools/browser-smoke.mjs
```

`DESIGN_KB_TOOLS` can select the installed design-kb tools directory and `CHROMIUM_PATH` the browser. Screenshots are written to a temporary demo folder, or to `DEMO_ARTIFACTS` when set.

The UI uses design-kb's foundations, dashboard navigation, form states and neutral theme guidance. It works with system fonts, keyboard navigation, light/dark preferences and narrow screens. It has no database, external services, analytics, automatic generation or publishing.

## Files and review

- `manifest.json` indexes existing repository paths. It holds no copied studio documents.
- Source material loads from the repository on each request. The workspace does not fetch remote reference images; links open only when you choose them.
- PSY-A-01 drafts live in `EPISODES/PSY-A-01/*.md`, created only when you save them. The existing pilot brief can also be edited explicitly. Shared playbooks remain read-only in the UI.
- Every document save requires a diff preview and checks for concurrent changes. Saves are atomic. Review changes with the UI and with `git diff` / `git status`; the app does not stage, commit or push.
- Human reviews live in `EPISODES/PSY-A-01/approvals.json`, with names, notes, timestamps, a history and content hashes. Editing reviewed inputs makes their approval stale. Reopening the app reads the same files and states.
- The documented premise approval is shown as existing evidence. The initial audience gate is a hypothesis, the script is absent, and the Oobah sheet remains a candidate.
- Script drafting opens only after the audience gate is approved and research and a complete treatment are present. Script acceptance additionally requires the full-script draft, separate critique and source audit. Replace template TODO prompts first. These checks establish artifact presence; a human must judge story quality and accuracy.
- A review dialog snapshots its input files. The app refuses a decision if any of those files change while the review is open. Request changes and return-to-pending decisions remain available when acceptance prerequisites are missing.
- Storyboard and final-review edits require current script approval. Final acceptance additionally requires a finished local file, named in final-review.md as `Output file: exports/example.mp4`, and a completed storyboard and final review. The app cannot judge the quality of the finished file.
- Reviewers can request changes or return a review to pending. Script and final approvals become invalid when prerequisite approvals change.

## Deliberate boundaries

This slice does not build the remaining episode workflows, upload assets, provide a video editor, verify external sources, measure audience response or submit generation jobs. Remote reference links are not proof of licensing or availability. Source documents retain their original history, including the dated MVP proposal; current implementation details live here.

The Node API restricts document paths, checks symlinks, limits request bodies, requires a local request token for writes and rejects foreign hosts/origins. This provides protection for a local single-user tool, not multi-user authentication. Do not run two instances that write to the same checkout.
