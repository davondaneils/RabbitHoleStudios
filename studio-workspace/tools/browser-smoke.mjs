// Browser checks use a disposable repository copy. They never approve or edit
// the real episode. Run after installing design-kb/tools with npm ci.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createStudioServer } from '../server.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const repo = path.resolve(app, '..');
const tools = process.env.DESIGN_KB_TOOLS || path.resolve(repo, '../design-kb/tools');
const { chromium } = await import(pathToFileURL(path.join(tools, 'node_modules/playwright-core/index.mjs')));
const axe = await readFile(path.join(tools, 'node_modules/axe-core/axe.min.js'), 'utf8');
const root = await mkdtemp(path.join(os.tmpdir(), 'rabbit-hole-browser-'));
const artifacts = process.env.DEMO_ARTIFACTS || path.join(os.tmpdir(), 'rabbit-hole-demo');
const manifest = JSON.parse(await readFile(path.join(app, 'manifest.json'), 'utf8'));
const files = [...new Set([...manifest.shared, ...manifest.visuals, ...Object.values(manifest.episodes), ...manifest.accounts.map(a => a.path), 'TRACKING/pilots.csv'])];
for (const file of files) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), await readFile(path.join(repo, file))); }
await mkdir(artifacts, { recursive: true });
const git = promisify(execFile);
await git('git', ['init', '-q'], { cwd: root }); await git('git', ['add', '.'], { cwd: root });
await git('git', ['-c', 'user.name=Browser fixture', '-c', 'user.email=browser@example.invalid', 'commit', '-qm', 'Fixture'], { cwd: root });
const server = await createStudioServer({ root }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
let assertions = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await page.waitForSelector('.account-panel');
  assert.equal(await page.locator('.account-panel').count(), 3); assertions++;
  assert.equal(await page.locator('.episode-row').count(), 6); assertions++;
  await page.screenshot({ path: path.join(artifacts, 'overview.png'), fullPage: true });
  await page.locator('#navigation').getByRole('link', { name: 'Psychology', exact: true }).click();
  await page.getByRole('heading', { name: 'Psychology', exact: true, level: 1 }).waitFor();
  await page.locator('.episode-row').filter({ hasText: 'PSY-A-01' }).click();
  await page.getByRole('heading', { name: 'The Shed at Dulwich', level: 1 }).waitFor();
  assert.match(await page.locator('.context-banner').innerText(), /working hypothesis/); assertions++;
  await page.screenshot({ path: path.join(artifacts, 'episode.png'), fullPage: true });
  await page.getByRole('link', { name: 'Approvals', exact: true }).click();
  await page.locator('.approval-row').filter({ hasText: 'Full episode script' }).getByRole('button').click();
  assert.equal(await page.locator('#decision option[value=approved]').isDisabled(), true); assertions++;
  assert.equal(await page.locator('#decision option[value=rejected]').isDisabled(), false); assertions++;
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'References', exact: true }).click();
  await page.locator('#reference-kind').selectOption('identity'); assert.equal(await page.locator('.reference-card').count(), 2); assertions++;
  await page.locator('#reference-search').fill('no matching source'); await page.getByRole('heading', { name: 'No matching references' }).waitFor(); assertions++;
  await page.getByRole('button', { name: 'Clear filters' }).click(); assert.equal(await page.locator('.reference-card').count(), 6); assertions++;
  await page.screenshot({ path: path.join(artifacts, 'references.png'), fullPage: true });

  const routes = ['', '?episode=PSY-A-01', '?episode=PSY-A-01&view=research', '?episode=PSY-A-01&view=script', '?episode=PSY-A-01&view=references', '?episode=PSY-A-01&view=approvals'];
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(origin + '/' + route); await page.waitForSelector(route ? '#episode-body > *' : '.account-panel');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, `${scheme} ${width}px ${route} overflows`); assertions++;
        if ([390, 1440].includes(width)) {
          await page.evaluate(axe);
          const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
          assert.deepEqual(violations, [], `${scheme} ${width}px ${route} accessibility`); assertions++;
        }
      }
    }
  }
  await page.emulateMedia({ colorScheme: 'light' }); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin); await page.waitForSelector('.account-panel');
  await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/?episode=PSY-A-01&view=research'); await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  const draft = '# Browser smoke test draft\n\nThis disposable note verifies that explicit file editing, diff review and save actions work correctly. It does not establish research findings or approve any studio material in the real repository.\n';
  await page.locator('#markdown-input').fill(draft);
  await page.getByRole('button', { name: 'Review diff', exact: true }).click();
  await page.getByRole('heading', { name: 'Review document changes' }).waitFor();
  assert.match(await page.locator('.diff').innerText(), /\+This disposable note/); assertions++;
  await page.getByRole('button', { name: 'Save reviewed changes' }).click();
  await page.waitForFunction(() => !document.querySelector('#dialog').open);
  assert.equal(await readFile(path.join(root, 'EPISODES/PSY-A-01/research.md'), 'utf8'), draft); assertions++;
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByRole('heading', { name: 'Review repository changes' }).waitFor();
  assert.match(await page.locator('#dialog').innerText(), /EPISODES\/PSY-A-01\/research.md/); assertions++;
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Edit document', exact: true }).click();
  await page.locator('#markdown-input').fill(draft + '\nUnsaved browser test change.\n');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  assert.equal(await readFile(path.join(root, 'EPISODES/PSY-A-01/research.md'), 'utf8'), draft); assertions++;
  await page.getByRole('link', { name: 'Approvals', exact: true }).click();
  await page.locator('.approval-row').filter({ hasText: 'Audience-value gate' }).getByRole('button').click();
  await page.locator('#reviewer').fill('Browser fixture reviewer'); await page.locator('#decision').selectOption('rejected');
  await page.locator('input[name=confirmed]').check(); await page.getByRole('button', { name: 'Record decision' }).click();
  await page.waitForFunction(() => !document.querySelector('#dialog').open);
  const saved = JSON.parse(await readFile(path.join(root, 'EPISODES/PSY-A-01/approvals.json'), 'utf8'));
  assert.equal(saved.records.audience.status, 'rejected'); assertions++;
  await page.reload(); await page.waitForSelector('.approval-row');
  assert.match(await page.locator('.approval-row').filter({ hasText: 'Audience-value gate' }).innerText(), /rejected/); assertions++;
  await page.goto(origin + '/?episode=PSY-A-01'); await page.getByRole('button', { name: 'Prepare audience task' }).click();
  assert.match(await page.locator('#task-packet').inputValue(), /STUDIO\/audience-research.md/); assertions++;
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto(origin); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip'); assertions++;
  await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'main'); assertions++;
  assert.deepEqual(errors, []); assertions++;
  console.log(`Browser smoke: ${assertions} assertions passed, all six views at five widths in both themes; no WCAG A/AA violations at 390 and 1440px.`);
  console.log(`Demo screenshots saved to ${artifacts}`);
  await context.close();
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true });
}
