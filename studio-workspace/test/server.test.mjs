import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createStudioServer, parseCSV } from '../server.mjs';

const actual = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const working = id => `EPISODES/PSY-A-01/${id}.md`;
const work = '# Complete episode draft\n\nThis complete draft records the causal story, documented sources, scene-level actions, the earned audience reward, uncertainties and editorial choices. A named reviewer must examine the actual work before acceptance.\n';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rabbit-hole-workspace-'));
  const paths = [...new Set([...manifest.shared, ...manifest.visuals, ...Object.values(manifest.episodes), ...manifest.accounts.map(a => a.path), 'TRACKING/pilots.csv'])];
  for (const file of paths) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), await readFile(path.join(actual, file))); }
  const server = await createStudioServer({ root }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });
  const state = await (await fetch(origin + '/api/workspace')).json();
  async function request(url, data, headers = {}) {
    const response = await fetch(origin + url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': state.csrf, ...headers }, body: JSON.stringify(data) });
    return { status: response.status, data: await response.json() };
  }
  async function approval(id, status = 'approved') {
    const current = (await request('/api/workspace')).data;
    const preview = (await request('/api/review-preview?id=' + encodeURIComponent(id))).data;
    return request('/api/approve', { id, status, reviewer: 'Fixture reviewer', confirmed: true, version: current.detail.state.versionHash, reviewToken: preview.token });
  }
  async function save(file, content) {
    const doc = (await request('/api/document?path=' + encodeURIComponent(file))).data;
    const preview = await request('/api/preview', { path: file, content, version: doc.version });
    assert.equal(preview.status, 200);
    return request('/api/save', { token: preview.data.token });
  }
  return { root, state, request, approval, save, origin };
}

test('CSV preserves quoted commas, quotes and multiline values', () => {
  assert.deepEqual(parseCSV('id,title\na,"A, B"\nb,"He said ""yes"""\nc,"Line one\nLine two"\n'), [{ id: 'a', title: 'A, B' }, { id: 'b', title: 'He said "yes"' }, { id: 'c', title: 'Line one\nLine two' }]);
});
test('the real slate and source-backed candidate states load without fabrication', async t => {
  const f = await fixture(t);
  assert.equal(f.state.accounts.length, 3);
  assert.equal(f.state.accounts.flatMap(a => a.episodes).length, 6);
  assert.equal(f.state.detail.currentStage, 'Audience alignment');
  assert.equal(f.state.detail.references.length, 6);
  assert.equal(f.state.detail.references.find(r => r.kind === 'character').status, 'candidate');
  assert.equal(f.state.detail.references.find(r => r.kind === 'character').model, 'seedream_v5_lite');
  assert.equal(f.state.detail.storyboardReady, false);
  for (const file of [...manifest.shared, ...manifest.visuals, ...Object.values(manifest.episodes)]) assert.equal((await f.request('/api/document?path=' + encodeURIComponent(file))).data.exists, true, file);
  const packet = (await f.request('/api/packet?stage=research')).data.content;
  assert.match(packet, /RESEARCH\/source-register.md/); assert.match(packet, /Do not create a worktree/);
});
test('paths, symlink escapes and foreign-origin writes are rejected', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/document?path=..%2F..%2Fetc%2Fpasswd')).status, 404);
  assert.equal((await f.request('/api/preview', { path: 'README.md', content: 'replace source', version: null })).status, 400);
  assert.equal((await f.request('/api/preview', {}, { 'X-Studio-Token': 'wrong' })).status, 403);
  assert.equal((await f.request('/api/preview', {}, { Origin: 'https://elsewhere.example' })).status, 403);
  await mkdir(path.join(f.root, 'EPISODES/PSY-A-01'), { recursive: true });
  await symlink('/etc/passwd', path.join(f.root, working('research')));
  assert.equal((await f.request('/api/document?path=' + encodeURIComponent(working('research')))).status, 400);
});
test('editing requires a reviewed diff, refuses lost updates and persists actual Markdown', async t => {
  const f = await fixture(t); const file = working('research');
  assert.equal((await f.request('/api/save', { token: 'unreviewed' })).status, 409);
  const preview = await f.request('/api/preview', { path: file, content: work, version: null });
  assert.match(preview.data.diff, /\+This complete draft/);
  assert.equal((await f.request('/api/save', { token: preview.data.token })).status, 200);
  assert.equal(await readFile(path.join(f.root, file), 'utf8'), work);
  assert.equal((await f.request('/api/save', { token: preview.data.token })).status, 409);
  const doc = (await f.request('/api/document?path=' + encodeURIComponent(file))).data;
  const second = await f.request('/api/preview', { path: file, content: work + '\nA new line.\n', version: doc.version });
  await writeFile(path.join(f.root, file), 'Edited in another application.');
  assert.equal((await f.request('/api/save', { token: second.data.token })).status, 409);
  assert.equal(await readFile(path.join(f.root, file), 'utf8'), 'Edited in another application.');
});
test('raw HTML and unsafe links cannot execute in rendered Markdown', async t => {
  const f = await fixture(t);
  await f.save(working('research'), '# Sources\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n![remote](https://example.invalid/private.png)');
  const html = (await f.request('/api/document?path=' + encodeURIComponent(working('research')))).data.html;
  assert.doesNotMatch(html, /<script>|href="javascript:|<img /); assert.match(html, /&lt;script&gt;/);
});
test('script and production stay blocked until explicit, complete human review', async t => {
  const f = await fixture(t);
  assert.equal((await f.approval('script')).status, 409);
  assert.equal((await f.request('/api/preview', { path: working('script'), content: work, version: null })).status, 409);
  assert.equal((await f.request('/api/packet?stage=script')).status, 409);
  assert.equal((await f.request('/api/preview', { path: working('storyboard'), content: work, version: null })).status, 409);
  assert.equal((await f.approval('audience')).status, 200);
  await f.save(working('research'), work); await f.save(working('treatment'), work);
  const seed = (await f.request('/api/template?stage=script')).data;
  await f.save(seed.path, seed.content);
  assert.equal((await f.approval('script')).status, 409);
  for (const id of ['research', 'treatment', 'script', 'editorial-review', 'source-audit']) await f.save(working(id), work);
  const candidate = (await f.request('/api/workspace')).data;
  assert.equal(candidate.detail.scriptReady, true); assert.equal(candidate.detail.storyboardReady, false);
  assert.equal((await f.approval('script')).status, 200);
  assert.equal((await f.save(working('storyboard'), work)).status, 200);
  await f.save(working('script'), work + '\nThe ending has changed.\n');
  const changed = (await f.request('/api/workspace')).data;
  assert.equal(changed.detail.state.records.script.status, 'needs-review'); assert.equal(changed.detail.storyboardReady, false);
});
test('revoking and reaccepting an audience gate invalidates earlier script acceptance', async t => {
  const f = await fixture(t); await f.approval('audience');
  for (const id of ['research', 'treatment', 'script', 'editorial-review', 'source-audit']) await f.save(working(id), work);
  await f.approval('script'); await f.approval('audience', 'pending');
  assert.equal((await f.request('/api/workspace')).data.detail.storyboardReady, false);
  await f.approval('audience');
  assert.equal((await f.request('/api/workspace')).data.detail.state.records.script.status, 'needs-review');
});
test('human reviews require confirmation, reject stale records and persist across restarts', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/approve', { id: 'audience', status: 'approved', reviewer: 'Owner', confirmed: false, version: null })).status, 400);
  await f.approval('audience');
  assert.equal((await f.request('/api/approve', { id: 'premise', status: 'approved', reviewer: 'Owner', confirmed: true, version: null })).status, 409);
  const second = await createStudioServer({ root: f.root }); second.listen(0, '127.0.0.1'); await once(second, 'listening');
  try {
    const current = await (await fetch(`http://127.0.0.1:${second.address().port}/api/workspace`)).json();
    assert.equal(current.detail.state.records.audience.status, 'approved'); assert.equal(current.detail.state.history.length, 1);
  } finally { second.closeAllConnections(); await new Promise(resolve => second.close(resolve)); }
});
test('approval cannot accept source changes made while the human review is open', async t => {
  const f = await fixture(t);
  const preview = (await f.request('/api/review-preview?id=audience')).data;
  const file = manifest.episodes['PSY-A-01']; const text = await readFile(path.join(f.root, file), 'utf8');
  await f.save(file, text + '\nA material change made after the review opened.\n');
  const result = await f.request('/api/approve', { id: 'audience', status: 'approved', reviewer: 'Fixture reviewer', confirmed: true, version: preview.version, reviewToken: preview.token });
  assert.equal(result.status, 409); assert.match(result.data.error, /Source files changed/);
  assert.equal((await f.request('/api/workspace')).data.detail.state.records.audience, undefined);
});
test('a revoked premise blocks production and a revoked audience blocks an already-reviewed script save', async t => {
  const f = await fixture(t); await f.approval('audience');
  for (const id of ['research', 'treatment', 'script', 'editorial-review', 'source-audit']) await f.save(working(id), work);
  await f.approval('script'); await f.approval('premise', 'rejected');
  const rejected = (await f.request('/api/workspace')).data;
  assert.equal(rejected.detail.premiseStatus, 'rejected'); assert.equal(rejected.detail.currentStage, 'Premise review'); assert.equal(rejected.detail.storyboardReady, false);
  await f.approval('premise');
  const doc = (await f.request('/api/document?path=' + encodeURIComponent(working('script')))).data;
  const preview = await f.request('/api/preview', { path: doc.path, content: work + '\nAn alternate ending.\n', version: doc.version });
  assert.equal(preview.status, 200);
  await f.approval('audience', 'pending');
  assert.equal((await f.request('/api/save', { token: preview.data.token })).status, 409);
  assert.equal(await readFile(path.join(f.root, doc.path), 'utf8'), work);
  assert.equal((await f.approval('script', 'rejected')).status, 200);
});
test('final approval requires an actual output and becomes stale when that output changes', async t => {
  const f = await fixture(t); await f.approval('audience');
  for (const id of ['research', 'treatment', 'script', 'editorial-review', 'source-audit']) await f.save(working(id), work);
  await f.approval('script'); await f.save(working('storyboard'), work);
  await f.save(working('final-review'), work + '\nOutput file: exports/episode.mp4\n');
  assert.equal((await f.approval('final')).status, 409);
  await mkdir(path.join(f.root, 'exports')); await writeFile(path.join(f.root, 'exports/episode.mp4'), Buffer.from([0, 1, 2, 255]));
  assert.equal((await f.approval('final')).status, 200);
  await writeFile(path.join(f.root, 'exports/episode.mp4'), Buffer.from([0, 1, 3, 255]));
  assert.equal((await f.request('/api/workspace')).data.detail.state.records.final.status, 'needs-review');
});
test('Git review includes new drafts and edited sources without committing anything', async t => {
  const f = await fixture(t); const git = promisify(execFile);
  await git('git', ['init', '-q'], { cwd: f.root }); await git('git', ['add', '.'], { cwd: f.root });
  await git('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Fixture sources'], { cwd: f.root });
  const head = (await git('git', ['rev-parse', 'HEAD'], { cwd: f.root })).stdout;
  await f.save(working('research'), work);
  const file = manifest.episodes['PSY-A-01']; const original = await readFile(path.join(f.root, file), 'utf8'); await f.save(file, original + '\nA reviewed local note.\n');
  const changes = (await f.request('/api/changes')).data;
  assert.ok(changes.files.find(c => c.path === working('research') && c.status === '??'));
  assert.match(changes.files.find(c => c.path === file).diff, /\+A reviewed local note/);
  assert.equal((await git('git', ['rev-parse', 'HEAD'], { cwd: f.root })).stdout, head);
});
