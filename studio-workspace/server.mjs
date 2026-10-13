import http from 'node:http';
import { readFile, writeFile, mkdir, rename, realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Marked } from 'marked';
import { createTwoFilesPatch } from 'diff';

const run = promisify(execFile);
const appRoot = path.dirname(fileURLToPath(import.meta.url));
export const stages = [
  { id: 'brief', name: 'Audience alignment', file: 'brief.md', inputs: ['STUDIO/audience-research.md', 'TEMPLATES/episode-brief.md'], instruction: 'Complete the audience-value gate. Separate viewer enjoyment, supported facts and buyer hypotheses.' },
  { id: 'research', name: 'Research', file: 'research.md', inputs: ['RESEARCH/source-register.md'], instruction: 'Read original sources and independent corroboration. Log claims, exact source statements, uncertainty, rights and concrete narrative details. Do not invent quotations.' },
  { id: 'treatment', name: 'Story treatment', file: 'treatment.md', inputs: ['STUDIO/creative-os.md'], instruction: 'Consider 2–3 distinct approaches and develop one complete causal beginning-to-ending treatment. Earn the viewer reward.' },
  { id: 'script', name: 'Full script', file: 'script.md', inputs: ['STUDIO/creative-os.md'], instruction: 'Write the entire episode, including what we see and hear. A short opening is not a complete script. Mark this SCRIPT_CANDIDATE.' },
  { id: 'editorial-review', name: 'Independent critique', file: 'editorial-review.md', inputs: ['STUDIO/creative-os.md'], instruction: 'Perform a separate skeptical editorial review. Identify specific problems and revisions. Do not approve the script yourself.' },
  { id: 'source-audit', name: 'Source check & approval', file: 'source-audit.md', inputs: ['RESEARCH/source-register.md'], instruction: 'Audit each script claim and quotation against sources; record confidence and unresolved issues. Founder approval is a separate explicit action.' },
  { id: 'storyboard', name: 'Storyboard', file: 'storyboard.md', inputs: ['STUDIO/production.md'], instruction: 'Only after founder script approval, create a shot table and asset list. Extract a 15–30-second production proof from the full episode.' },
  { id: 'final-review', name: 'Final output review', file: 'final-review.md', inputs: ['STUDIO/production.md'], instruction: 'Record the local output file and on-phone QA, sources, captions, rights and production limitations. Publication approval remains explicit.' }
];
const episodeDir = 'EPISODES/PSY-A-01';
const approvalPath = `${episodeDir}/approvals.json`;
const stagePath = (id) => `${episodeDir}/${stages.find(s => s.id === id)?.file || ''}`;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const esc = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const substantive = (text) => !!text && !/\bTODO\b/.test(text) && text.replace(/<!--[^]*?-->/g, '').replace(/^#{1,6}.*$/gm, '').replace(/[`*#|_-]/g, '').trim().split(/\s+/).length >= 20;
const reviewSignature = record => record ? sha(JSON.stringify({ status: record.status, reviewedAt: record.reviewedAt, versions: record.versions })) : null;

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quote && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quote = !quote;
    else if (c === ',' && !quote) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quote) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const [headers, ...data] = rows;
  return data.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

export async function createStudioServer({ root = path.resolve(appRoot, '..') } = {}) {
  root = await realpath(root);
  const manifest = JSON.parse(await readFile(path.join(appRoot, 'manifest.json'), 'utf8'));
  const indexed = new Set([...manifest.shared, ...manifest.visuals, ...Object.values(manifest.episodes), ...manifest.accounts.map(a => a.path), ...stages.map(s => stagePath(s.id))]);
  const editable = new Set([manifest.episodes['PSY-A-01'], ...stages.map(s => stagePath(s.id))]);
  const csrf = randomUUID();
  const previews = new Map();
  const reviewPreviews = new Map();
  let mutation = Promise.resolve();

  async function safePath(relative, missing = false) {
    if (typeof relative !== 'string' || !relative || relative.includes('\0') || path.isAbsolute(relative)) throw fail('Invalid repository path');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw fail('Path must stay inside this repository');
    let current = file;
    while (true) {
      try {
        const resolved = await realpath(current);
        if (resolved !== root && !resolved.startsWith(root + path.sep)) throw fail('Symlinks cannot leave this repository');
        break;
      } catch (e) {
        if (e.code !== 'ENOENT' || !missing || current === root) throw e;
        current = path.dirname(current);
      }
    }
    return file;
  }
  async function content(relative) {
    try { return await readFile(await safePath(relative, true), 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async function atomic(relative, value) {
    const file = await safePath(relative, true);
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    try { await writeFile(temp, value, { flag: 'wx' }); await rename(temp, file); }
    finally { await unlink(temp).catch(() => {}); }
  }
  async function versions(paths) {
    return Object.fromEntries(await Promise.all([...new Set(paths)].map(async p => {
      try { return [p, sha(await readFile(await safePath(p, true)))]; }
      catch (error) { if (error.code === 'ENOENT') return [p, null]; throw error; }
    })));
  }
  function markdown(text, file) {
    const engine = new Marked({ breaks: false, gfm: true });
    function target(href) {
      if (/^https?:\/\//i.test(href)) return { href, external: true };
      if (href.startsWith('#')) return { href };
      const clean = href.split('#')[0];
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
      const canonical = indexed.has(clean) ? clean : relative;
      return indexed.has(canonical) ? { href: '/?episode=PSY-A-01&document=' + encodeURIComponent(canonical) } : null;
    }
    engine.use({ renderer: {
      html({ text }) { return esc(text); },
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens); const link = target(href);
        return link ? `<a href="${esc(link.href)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>` : text;
      },
      image({ href, text }) {
        const link = target(href); return link ? `<a href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${esc(text || 'Image reference')} (open reference)</a>` : esc(text);
      }
    }});
    return engine.parse(text || '');
  }
  async function document(relative) {
    if (!indexed.has(relative)) throw fail('This document is not indexed', 404);
    const text = await content(relative);
    return { path: relative, exists: text !== null, content: text || '', version: text === null ? null : sha(text), html: markdown(text, relative), editable: editable.has(relative) };
  }
  async function approvals() {
    const text = await content(approvalPath);
    const data = text ? JSON.parse(text) : { version: 1, records: {}, history: [] };
    const records = {};
    for (const [id, record] of Object.entries(data.records)) {
      const current = await versions(Object.keys(record.versions));
      const stale = JSON.stringify(current) !== JSON.stringify(record.versions);
      records[id] = { ...record, status: stale && record.status === 'approved' ? 'needs-review' : record.status, stale };
    }
    if (records.script?.status === 'approved' && (records.audience?.status !== 'approved' || records.script.audienceReview !== reviewSignature(records.audience))) {
      records.script.status = 'needs-review'; records.script.stale = true;
    }
    if (records.script?.status === 'approved' && (records.premise?.status && records.premise.status !== 'approved' || records.script.premiseReview !== reviewSignature(records.premise))) {
      records.script.status = 'needs-review'; records.script.stale = true;
    }
    if (records.final?.status === 'approved' && (records.script?.status !== 'approved' || records.final.scriptReview !== reviewSignature(records.script))) {
      records.final.status = 'needs-review'; records.final.stale = true;
    }
    return { ...data, records, versionHash: text === null ? null : sha(text) };
  }
  async function referenceList() {
    const found = new Map();
    for (const file of [manifest.visuals[0], manifest.visuals[3]]) {
      const text = await content(file);
      for (const match of text?.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g) || []) {
        const [_, label, url] = match;
        const kind = /TV-style|style reference/i.test(label) ? 'style' : /Oobah.*(?:portrait|photograph)|Actual Oobah/i.test(label) ? 'identity' : /Seedream|turnaround|Higgsfield/i.test(label) ? 'character' : null;
        if (!kind) continue;
        const id = 'reference:' + sha(url).slice(0, 16);
        const prior = found.get(id);
        found.set(id, { id, label: prior?.label || label, url, kind, source: file, initialStatus: kind === 'character' ? 'candidate' : 'reference', model: kind === 'character' ? (text.match(/model:\s*`([^`]+)`/)?.[1] || null) : null, jobId: kind === 'character' ? (text.match(/Job ID:\s*`([^`]+)`/i)?.[1] || text.match(/job ID\s*`([^`]+)`/i)?.[1] || null) : null, credits: null });
      }
    }
    return [...found.values()];
  }
  async function slice() {
    const state = await approvals();
    const artifacts = await Promise.all(stages.map(async s => {
      const doc = await document(stagePath(s.id)); return { ...s, path: doc.path, exists: doc.exists, substantive: substantive(doc.content) };
    }));
    const refs = (await referenceList()).map(r => ({ ...r, status: state.records[r.id]?.status || r.initialStatus, approval: state.records[r.id] || null }));
    const approved = (key) => state.records[key]?.status === 'approved';
    const premiseStatus = state.records.premise?.status || (parseCSV(await content('TRACKING/pilots.csv')).find(r => r.video_id === 'PSY-A-01')?.status === 'premise-approved' ? 'approved' : 'pending');
    const audienceApproved = approved('audience');
    const scriptDraftReady = premiseStatus === 'approved' && audienceApproved && ['research', 'treatment'].every(id => artifacts.find(s => s.id === id).substantive);
    const scriptReady = scriptDraftReady && ['script', 'editorial-review', 'source-audit'].every(id => artifacts.find(s => s.id === id).substantive);
    const storyboardReady = premiseStatus === 'approved' && approved('script');
    const stage = premiseStatus !== 'approved' ? 'Premise review' : approved('script') ? (artifacts.find(s => s.id === 'storyboard').substantive ? 'Production proof' : 'Script approved') : !audienceApproved ? 'Audience alignment' : !artifacts.find(s => s.id === 'research').substantive ? 'Research' : !artifacts.find(s => s.id === 'treatment').substantive ? 'Story treatment' : !artifacts.find(s => s.id === 'script').substantive ? 'Full script' : 'Script review';
    let finalReady = storyboardReady && ['storyboard', 'final-review'].every(id => artifacts.find(s => s.id === id).substantive);
    if (finalReady) {
      const output = (await content(stagePath('final-review')))?.match(/^Output file:\s*`?([^`\n]+)`?\s*$/m)?.[1]?.trim();
      finalReady = !!output && !!(await safePath(output, true).then(file => stat(file)).catch(() => null))?.isFile();
    }
    return { state, artifacts, references: refs, currentStage: stage, premiseStatus, audienceApproved, scriptDraftReady, scriptReady, storyboardReady, finalReady };
  }
  async function requireDraftGate(id) {
    const detail = await slice();
    if (id === 'script' && !detail.scriptDraftReady) throw fail('Script drafting requires a current audience approval, research and a complete story treatment.', 409);
    if (['storyboard', 'final-review'].includes(id) && !detail.storyboardReady) throw fail('Current founder script approval is required before production work.', 409);
  }
  async function workspace() {
    const rows = parseCSV(await content('TRACKING/pilots.csv'));
    const detail = await slice();
    const accounts = await Promise.all(manifest.accounts.map(async a => ({ ...a, episodes: rows.filter(r => r.account === a.csvAccount).map(r => ({ id: r.video_id, show: r.show_format, story: r.story, documentedStatus: r.status, nextAction: r.next_action, path: manifest.episodes[r.video_id], stage: r.video_id === 'PSY-A-01' ? detail.currentStage : 'Premise development', implemented: r.video_id === 'PSY-A-01' })) })));
    return { app: 'rabbit-hole-studio-workspace', rootId: sha(root), accounts, detail, csrf, sources: manifest, rootName: path.basename(root) };
  }
  function template(id) {
    const sections = {
      brief: ['Viewer and desire: evidence vs hypothesis', 'Why this story belongs here', 'Entertainment and emotional reward', 'Insight, recognition or agency', 'Documented mechanism and limits', 'Buyer adjacency: hypothesis', 'One-sentence promise', 'Open questions'],
      research: ['Claim and source register', 'Original accounts and corroboration', 'Narrative details bank', 'Unknowns and disputed facts', 'Rights and portrayal notes'],
      treatment: ['Distinct narrative approaches', 'Recommended complete causal treatment', 'Beginning', 'Escalation and turning points', 'Ending and earned viewer reward', 'Open questions'],
      script: ['Version and intended complete episode length', 'One-sentence promise', 'Complete script: what we see and hear', 'Source notes and uncertainty', 'Read-through notes'],
      'editorial-review': ['Reviewer and script version', 'Hook and payoff', 'Causality and changing stakes', 'Specific corrections', 'Revised script notes', 'Unresolved issues'],
      'source-audit': ['Script version audited', 'Claim-by-claim source audit', 'Quotations and reenactments', 'Historical and psychological limits', 'Rights and unresolved issues'],
      storyboard: ['Approved script version', 'Shot table', 'Essential asset list', 'Style vs identity references', 'Extracted animation proof', 'Founder minutes and credit cost: actual vs assumed'],
      'final-review': ['Output file', 'Full episode and on-phone QA', 'Sources and captions audit', 'Rights and portrayal review', 'Remaining limitations']
    };
    return `# PSY-A-01: ${stages.find(s => s.id === id).name}\n\nStatus: DRAFT. Requires human review.\nSource brief: [The Setup](../../SHOWS/psychology/pilot-A-the-setup.md).\n\n` + sections[id].map(h => `## ${h}\n\nTODO: Add the episode-specific work here.\n`).join('\n');
  }
  async function packet(id) {
    const stage = stages.find(s => s.id === id); if (!stage) throw fail('Unknown stage');
    const detail = await slice();
    await requireDraftGate(id);
    const paths = [...new Set(['AGENTS.md', 'README.md', 'STUDIO/decisions.md', 'STUDIO/editorial-workflow.md', 'STUDIO/audience-research.md', 'STUDIO/creative-os.md', 'SHOWS/psychology/README.md', manifest.episodes['PSY-A-01'], ...stage.inputs, ...(id === 'storyboard' || id === 'final-review' ? manifest.visuals : []), ...detail.artifacts.filter(s => s.exists).map(s => s.path)])];
    return `# Codex task: PSY-A-01 / ${stage.name}\n\nCurrent stage: ${detail.currentStage}.\nWork in the existing RabbitHoleStudios checkout. Do not create a worktree.\n\nRead these files and name which ones you actually consulted:\n${paths.map(p => '- ' + p).join('\n')}\n\n${stage.instruction}\n\nOutput: ${stagePath(id)}\nPreserve existing content; review file diffs before committing. Do not fabricate research or quotations. No external publishing, purchases, generation jobs or integrations.\nHuman approvals are recorded separately; producing a file never grants approval. Do not start shot production without current founder script approval.\n`;
  }
  async function reviewInputs(id, detail) {
    const reference = detail.references.find(r => r.id === id);
    if (!['premise', 'audience', 'script', 'final'].includes(id) && !reference) throw fail('Unknown approval');
    const inputs = [manifest.episodes['PSY-A-01'], 'STUDIO/decisions.md'];
    if (id === 'audience') inputs.push('STUDIO/audience-research.md', 'SHOWS/psychology/README.md', stagePath('brief'));
    if (id === 'script' || id === 'final') inputs.push('STUDIO/audience-research.md', 'STUDIO/creative-os.md', 'STUDIO/editorial-workflow.md', 'SHOWS/psychology/README.md', ...stages.slice(0, 6).map(s => stagePath(s.id)));
    if (reference) inputs.push(...manifest.visuals);
    if (id === 'final') {
      inputs.push(stagePath('storyboard'), stagePath('final-review'));
      const output = (await content(stagePath('final-review')))?.match(/^Output file:\s*`?([^`\n]+)`?\s*$/m)?.[1]?.trim();
      if (output) inputs.push(output);
    }
    return inputs;
  }
  async function approve(body) {
    if (body.confirmed !== true || typeof body.reviewer !== 'string' || !body.reviewer.trim()) throw fail('Name the reviewer and explicitly confirm the review');
    if (!['approved', 'rejected', 'pending'].includes(body.status)) throw fail('Invalid approval status');
    const current = await approvals();
    if (body.version !== current.versionHash) throw fail('Approval records changed. Refresh before reviewing.', 409);
    const detail = await slice();
    const inputs = await reviewInputs(body.id, detail);
    const reviewed = reviewPreviews.get(body.reviewToken);
    const currentInputs = await versions(inputs);
    if (!reviewed || reviewed.id !== body.id || Date.now() - reviewed.createdAt > 15 * 60 * 1000) throw fail('Open the review again before recording a decision.', 409);
    if (JSON.stringify(currentInputs) !== JSON.stringify(reviewed.versions)) throw fail('Source files changed while this review was open. Reopen the review and inspect the new version.', 409);
    if (body.id === 'script' || body.id === 'final') {
      if (body.status === 'approved' && !detail.scriptReady) throw fail('Script approval requires a current audience approval and completed research, treatment, full script, separate critique and source audit.', 409);
    }
    if (body.id === 'final') {
      if (body.status === 'approved') {
        if (!detail.storyboardReady || !detail.artifacts.find(s => s.id === 'storyboard').substantive || !detail.artifacts.find(s => s.id === 'final-review').substantive) throw fail('Final approval requires a current approved script, storyboard and completed final review.', 409);
        const review = await content(stagePath('final-review'));
        const output = review.match(/^Output file:\s*`?([^`\n]+)`?\s*$/m)?.[1]?.trim();
        if (!output || !(await stat(await safePath(output, true)).catch(() => null))?.isFile()) throw fail('Final review must name an existing repository output with “Output file: relative/path”.', 409);
      }
    }
    const record = { status: body.status, reviewer: body.reviewer.trim().slice(0, 100), note: String(body.note || '').slice(0, 2000), reviewedAt: new Date().toISOString(), versions: currentInputs };
    if (body.id === 'script' || body.id === 'final') record.audienceReview = reviewSignature(current.records.audience);
    if (body.id === 'script' || body.id === 'final') record.premiseReview = reviewSignature(current.records.premise);
    if (body.id === 'final') record.scriptReview = reviewSignature(current.records.script);
    const data = { version: 1, records: { ...current.records, [body.id]: record }, history: [...current.history, { id: body.id, ...record }] };
    for (const entry of Object.values(data.records)) { delete entry.stale; }
    await atomic(approvalPath, JSON.stringify(data, null, 2) + '\n');
    reviewPreviews.delete(body.reviewToken);
    return slice();
  }
  async function changes() {
    let stdout;
    try {
      ({ stdout } = await run('git', ['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all'], { cwd: root, maxBuffer: 1024 * 1024 }));
    } catch (error) {
      if (error.code === 'ENOENT' || /not a git repository/i.test(error.stderr || '')) return { files: [], unshown: 0, gitAvailable: false };
      throw error;
    }
    const entries = stdout.split('\0').filter(Boolean).filter(s => !s.startsWith(' ') || s.length > 3).map(s => ({ status: s.slice(0, 2), path: s.slice(3) }));
    const visible = entries.filter(e => indexed.has(e.path) || e.path === approvalPath || (e.path.startsWith('studio-workspace/') && /\.(md|json|mjs|css|html)$/.test(e.path)));
    const files = await Promise.all(visible.map(async e => {
      if (e.status === '??') return { ...e, diff: createTwoFilesPatch('/dev/null', e.path, '', (await content(e.path)) || '') };
      const { stdout: diff } = await run('git', ['diff', '--no-ext-diff', 'HEAD', '--', e.path], { cwd: root, maxBuffer: 1024 * 1024 });
      return { ...e, diff };
    }));
    return { files, unshown: entries.length - visible.length, gitAvailable: true };
  }
  async function body(req) {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 512 * 1024) throw fail('Document is too large', 413); }
    try { return JSON.parse(raw); } catch { throw fail('Expected JSON'); }
  }
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
    const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      if (!hosts.includes(req.headers.host)) throw fail('Use the local workspace address', 403);
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (req.method === 'POST') {
        if (req.headers['x-studio-token'] !== csrf || (req.headers.origin && req.headers.origin !== url.origin)) throw fail('Refresh the local workspace before saving', 403);
        const data = await body(req);
        const action = async () => {
          if (url.pathname === '/api/preview') {
            if (!editable.has(data.path) || typeof data.content !== 'string') throw fail('This file cannot be edited');
            await requireDraftGate(stages.find(s => stagePath(s.id) === data.path)?.id);
            const old = await content(data.path); const current = old === null ? null : sha(old);
            if (data.version !== current) throw fail('This file changed on disk. Reload it before editing.', 409);
            for (const [key, value] of previews) if (Date.now() - value.createdAt > 15 * 60 * 1000) previews.delete(key);
            if (previews.size >= 50) previews.delete(previews.keys().next().value);
            const token = randomUUID(); previews.set(token, { path: data.path, content: data.content, version: current, createdAt: Date.now() });
            return { token, diff: createTwoFilesPatch(data.path, data.path, old || '', data.content) };
          }
          if (url.pathname === '/api/save') {
            const preview = previews.get(data.token);
            if (!preview || Date.now() - preview.createdAt > 15 * 60 * 1000) throw fail('Review the diff again before saving', 409);
            const old = await content(preview.path);
            if ((old === null ? null : sha(old)) !== preview.version) throw fail('This file changed after the diff was reviewed. Reload before saving.', 409);
            await requireDraftGate(stages.find(s => stagePath(s.id) === preview.path)?.id);
            await atomic(preview.path, preview.content); previews.delete(data.token);
            return { document: await document(preview.path), detail: await slice() };
          }
          if (url.pathname === '/api/approve') return approve(data);
          throw fail('Unknown action', 404);
        };
        const result = mutation.then(action); mutation = result.catch(() => {}); return json(await result);
      }
      if (req.method !== 'GET') throw fail('Method not supported', 405);
      if (url.pathname === '/api/workspace') return json(await workspace());
      if (url.pathname === '/api/document') return json(await document(url.searchParams.get('path')));
      if (url.pathname === '/api/template') { const id = url.searchParams.get('stage'); if (!stages.some(s => s.id === id)) throw fail('Unknown stage'); await requireDraftGate(id); return json({ path: stagePath(id), content: template(id) }); }
      if (url.pathname === '/api/packet') return json({ content: await packet(url.searchParams.get('stage')) });
      if (url.pathname === '/api/changes') return json(await changes());
      if (url.pathname === '/api/review-preview') {
        const id = url.searchParams.get('id'); const detail = await slice();
        const inputs = await versions(await reviewInputs(id, detail));
        for (const [key, value] of reviewPreviews) if (Date.now() - value.createdAt > 15 * 60 * 1000) reviewPreviews.delete(key);
        if (reviewPreviews.size >= 50) reviewPreviews.delete(reviewPreviews.keys().next().value);
        const token = randomUUID(); reviewPreviews.set(token, { id, versions: inputs, createdAt: Date.now() });
        return json({ token, paths: Object.keys(inputs), version: detail.state.versionHash });
      }
      const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
      if (!assets[url.pathname]) throw fail('Page not found', 404);
      const [name, type] = assets[url.pathname]; res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }); res.end(await readFile(path.join(appRoot, 'public', name)));
    } catch (error) { json({ error: error.code === 'ENOENT' ? 'Required source file is missing' : error.message }, error.status || 500); }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3210);
  const server = await createStudioServer();
  server.listen(port, '127.0.0.1', () => console.log(`Rabbit Hole Studios is running locally on port ${server.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
