import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, cp, rm, chmod } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import http from 'node:http';

const sourceApp = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.resolve(sourceApp, '..');
const manifest = JSON.parse(await readFile(path.join(sourceApp, 'manifest.json'), 'utf8'));

async function fixture(t, withDependencies = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-launch-'));
  await cp(sourceApp, path.join(root, 'studio-workspace'), { recursive: true, filter: file => withDependencies || !file.includes(path.sep + 'node_modules') });
  const files = new Set([...manifest.shared, ...manifest.visuals, ...Object.values(manifest.episodes), ...manifest.accounts.map(a => a.path), 'TRACKING/pilots.csv']);
  for (const file of files) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), await readFile(path.join(sourceRoot, file))); }
  const children = [];
  t.after(async () => {
    for (const child of children) if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    await rm(root, { recursive: true, force: true });
  });
  function launch(extra = {}) {
    const child = spawn(process.execPath, ['studio-workspace/open.mjs'], { cwd: root, env: { ...process.env, PORT: '0', STUDIO_NO_BROWSER: '1', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    let output = '';
    const ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('Launcher timeout: ' + output)); child.kill('SIGTERM'); }, 30000);
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Your studio: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timeout); resolve({ url: match[1], output, child }); }
      });
      child.stderr.on('data', chunk => { output += chunk; });
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('exit', code => { clearTimeout(timeout); if (code) reject(new Error(output)); });
    });
    return ready;
  }
  return { root, launch };
}

test('one command installs the frozen dependencies and opens a usable downloaded copy', async t => {
  const f = await fixture(t, false);
  const result = await f.launch({ NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || '/tmp/studio-test-npm-cache' });
  assert.match(result.output, /Installing the studio dependencies/);
  const state = await (await fetch(result.url + '/api/workspace')).json();
  assert.equal(state.accounts.length, 3); assert.equal(state.detail.currentStage, 'Audience alignment');
  const changes = await (await fetch(result.url + '/api/changes')).json();
  assert.equal(changes.gitAvailable, false);
});
test('the launcher reuses this folder and uses a free port when another service is present', async t => {
  const other = http.createServer((req, res) => res.end('Another local service'));
  other.listen(0, '127.0.0.1'); await once(other, 'listening');
  t.after(() => new Promise(resolve => other.close(resolve)));
  const port = String(other.address().port);
  const f = await fixture(t);
  const first = await f.launch({ PORT: port });
  assert.match(first.output, /usual port is busy/);
  assert.notEqual(new URL(first.url).port, port);
  const reused = await f.launch({ PORT: new URL(first.url).port });
  assert.match(reused.output, /already running/); assert.equal(reused.url, first.url);
});
test('the default browser receives the address of the actual running studio', { skip: process.platform !== 'linux' }, async t => {
  const f = await fixture(t); const bin = path.join(f.root, 'bin'); await mkdir(bin);
  const marker = path.join(f.root, 'opened-url.txt');
  const opener = path.join(bin, 'xdg-open');
  await writeFile(opener, '#!' + process.execPath + '\nimport { writeFileSync } from "node:fs"; writeFileSync(process.env.STUDIO_BROWSER_TEST_FILE, process.argv[2]);\n');
  await chmod(opener, 0o755);
  const result = await f.launch({ STUDIO_NO_BROWSER: '0', STUDIO_BROWSER_TEST_FILE: marker, PATH: bin + path.delimiter + process.env.PATH });
  let opened;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { opened = await readFile(marker, 'utf8'); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.equal(opened, result.url);
});
