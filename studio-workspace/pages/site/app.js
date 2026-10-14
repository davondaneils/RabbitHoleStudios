import { browserAPI } from './browser-api.js?v=live3-20261014';
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
let workspace, editor = null, routeSequence = 0, noticeTimer;
let currentURL = location.href;
const draftVersions = new Set();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const href = params => './?' + new URLSearchParams(params);
const badge = (text, type = '') => `<span class="badge ${type}">${escape(text)}</span>`;
const docLink = (file, label) => `<a class="source-link" href="${href({ episode: 'PSY-A-01', document: file })}">${escape(label || file.split('/').pop().replace('.md', '').replaceAll('-', ' '))}<span aria-hidden="true">→</span></a>`;
const stamp = date => new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'America/Toronto' }).format(new Date(date));
async function api(url, data) { return browserAPI(url, data); }
async function readDocument(path) {
  return api('/api/document?path=' + encodeURIComponent(path) +
    (draftVersions.has(path) ? '&source=draft' : ''));
}
function updateSyncStatus() {
  const banner = document.querySelector('#repo-status');
  if (!banner || !workspace?.sync) return;
  const info = workspace.sync;
  const local = info.unsyncedDrafts ? ' · ' + info.unsyncedDrafts + ' unsynced browser draft(s)' : '';
  const revision = info.commit ? ' @ ' + info.commit.slice(0,7) : '';
  const checked = info.checkedAt ? ' · checked ' + new Date(info.checkedAt).toLocaleTimeString('en-CA',
    { timeZone:'America/Toronto', hour:'numeric', minute:'2-digit' }) + ' ET' : '';
  if (info.mode === 'live') {
    banner.textContent = 'LIVE GITHUB · main' + revision + checked + local +
      '. Drafts on this device do not save to GitHub.';
  } else if (info.mode === 'degraded') {
    banner.textContent = 'PARTIAL GITHUB · main' + revision + checked +
      ' · ' + (info.failedFiles?.length || 0) + ' document read(s) failed. Saved copies shown where available; press Sync GitHub to retry.' + local;
  } else {
    banner.textContent = 'OFFLINE SNAPSHOT · GitHub could not be checked. Files may be out of date.' +
      (info.error ? ' (' + info.error + ')' : '') + local;
  }
  banner.dataset.mode = info.mode;
}
function notify(text) {
  clearTimeout(noticeTimer); document.querySelector('#notice').textContent = text;
  if (text) noticeTimer = setTimeout(() => { document.querySelector('#notice').textContent = ''; }, 8000);
}
function showDialog(title, body, wide = false) {
  dialog.className = wide ? 'wide-dialog' : '';
  dialog.innerHTML = `<header class="dialog-header"><h2 id="dialog-title">${escape(title)}</h2><button class="button subtle" data-action="close-dialog">Close</button></header>${body}<div id="dialog-error" class="inline-error" role="alert"></div>`;
  if (!dialog.open) dialog.showModal();
  else dialog.querySelector('button')?.focus();
}
function closeDialog() {
  if (editor?.dirty && !confirm('Discard the unsaved changes to this document?')) return;
  editor = null; dialog.close();
}
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
window.addEventListener('beforeunload', event => { if (editor?.dirty) { event.preventDefault(); event.returnValue = ''; } });
function nav() {
  const params = new URLSearchParams(location.search);
  const selected = params.get('account') || (params.get('episode')?.startsWith('PSY') ? 'psychology' : null);
  document.querySelector('#navigation').innerHTML = `<a class="nav-item ${!selected && !params.get('episode') ? 'selected' : ''}" href="./"${!selected && !params.get('episode') ? ' aria-current="page"' : ''}>Pilot overview</a><span class="nav-label">Accounts</span>${workspace.accounts.map(a => `<a class="nav-item ${selected === a.id ? 'selected' : ''}" href="${href({ account: a.id })}"${selected === a.id ? ' aria-current="page"' : ''}>${escape(a.name)}</a>`).join('')}<span class="nav-label">Studio guides</span><a class="nav-item" href="${href({ document: 'STUDIO/editorial-workflow.md' })}">Editorial workflow</a><a class="nav-item" href="${href({ document: 'STUDIO/decisions.md' })}">Decisions & hypotheses</a>`;
}
function episodeRows(account, show) {
  return account.episodes.filter(e => !show || e.show === show).map(e => `<a class="episode-row" href="${href({ episode: e.id })}"><div class="episode-row-top"><span class="eyebrow">${escape(e.id)}</span><span class="row-arrow" aria-hidden="true">→</span></div><h3>${escape(e.show)}</h3><div class="episode-story">${escape(e.story)}</div><div class="row-state"><span class="state-dot" aria-hidden="true"></span>${escape(e.stage)}</div></a>`).join('');
}
function overview(params) {
  const account = workspace.accounts.find(a => a.id === params.get('account'));
  const accounts = account ? [account] : workspace.accounts;
  const show = params.get('show');
  const title = show || account?.name || 'The pilot slate';
  document.title = `${title} · Rabbit Hole Studios`;
  main.innerHTML = `<section class="page-header"><div><div class="eyebrow">${account ? 'Account / ' + escape(account.subtitle) : 'First test round'}</div><h1 tabindex="-1">${escape(title)}</h1><p class="lede">${account ? 'Two show hypotheses. Each begins with a real story.' : 'Three accounts. Six first stories. Develop the work before scaling it.'}</p></div>${account ? `<a class="button subtle" href="./">All accounts</a>` : ''}</section>${!account || account.id === 'psychology' ? `<section class="continue-strip"><div><span class="eyebrow">Continue PSY-A-01</span><h2>The Shed at Dulwich</h2><p>The Setup · ${escape(workspace.detail.currentStage)}</p></div><a class="button primary" href="${href({ episode: 'PSY-A-01' })}">Open episode <span aria-hidden="true">→</span></a></section>` : ''}<div class="section-heading"><h2>${account ? 'Show formats' : 'Your accounts'}</h2><span class="caption">${workspace.detail.premiseStatus === 'approved' ? 'Premises approved for development' : 'Pilot premises under review'}</span></div><div class="account-grid ${account ? 'single-account' : ''}">${accounts.map((a, index) => `<section class="account-panel account-${a.id}"><header class="account-header"><span class="account-index" aria-hidden="true">0${index + 1}</span><div><h2><a href="${href({ account: a.id })}">${escape(a.name)}</a></h2><span class="caption">${escape(a.subtitle)}</span></div></header>${episodeRows(a, show)}<footer>${docLink(a.path, 'Account mini-bible')}</footer></section>`).join('')}</div><section class="studio-note"><span class="eyebrow">The studio constraint</span><p>Eight founder-hours a week. Web design remains the primary business. Audience fit, production costs and buyer demand are still hypotheses.</p>${docLink('STUDIO/decisions.md', 'Read the locked decisions')}</section>`;
}
function reducedHeadings(html) { return html.replace(/<(\/?)(h[1-6])(?=[ >])/g, (_, slash, tag) => `<${slash}h${Math.min(6, Number(tag[1]) + 2)}`); }
function draftLocked(stage) { return stage?.id === 'script' ? !workspace.detail.scriptDraftReady : ['storyboard', 'final-review'].includes(stage?.id) && !workspace.detail.storyboardReady; }
function draftReason(stage) { return stage.id === 'script' ? 'Confirm the audience-value gate and complete research and story treatment before drafting the script.' : 'Founder approval of the full script is required before production work.'; }
function documentArticle(doc, title = 'Source document', edit = true) {
  const stage = workspace.detail.artifacts.find(s => s.path === doc.path);
  const locked = draftLocked(stage);
  const sourceLabel = doc.source === 'browser-draft'
    ? 'UNSYNCED BROWSER DRAFT — saved only on this device'
    : doc.source === 'github-main' ? 'LIVE GITHUB FILE — main'
    : 'SAVED SNAPSHOT — may be out of date';
  const draftWarning = doc.hasUnsyncedDraft && doc.repoFileExists
    ? doc.githubUpdatedSinceDraft
      ? 'GitHub changed since this browser draft was saved. Both versions are preserved; compare before copying changes.'
      : doc.draftBaseUnknown
        ? 'This draft has no verified GitHub baseline. Open the GitHub version to compare.'
        : 'Your browser draft and the GitHub file are separate copies. Both are available.'
    : '';
  const editURL = 'https://github.com/davondaneils/RabbitHoleStudios/edit/main/' +
    doc.path.split('/').map(encodeURIComponent).join('/');
  const sourceButton = doc.hasUnsyncedDraft && doc.repoFileExists && !doc.repoReadError
    ? `<button class="button subtle" data-action="toggle-document-source" data-path="${escape(doc.path)}">${doc.viewingDraft ? 'View GitHub version' : 'Show saved browser draft'}</button>` : '';
  const githubButton = doc.repoFileExists
    ? `<a class="button subtle" href="${escape(editURL)}" target="_blank" rel="noopener noreferrer">Edit on GitHub ↗</a>` : '';
  return `<section class="document-panel"><header class="document-header"><div><h2>${escape(title)}</h2><span class="file-path">${escape(doc.path)}</span><p class="caption">${escape(sourceLabel)}</p>${draftWarning ? `<p class="caption draft-warning">${escape(draftWarning)}</p>` : ''}${doc.repoReadError ? `<p class="caption draft-warning">GitHub file could not load: ${escape(doc.repoReadError)}. Showing saved copy if available.</p>` : ''}${locked && !doc.exists ? `<p class="caption">${draftReason(stage)}</p>` : ''}</div><div class="document-actions">${sourceButton}${githubButton}${edit && doc.editable ? `<button class="button subtle" data-action="edit-document" data-path="${escape(doc.path)}" ${locked ? 'disabled' : ''}>Edit browser draft</button>` : ''}</div></header><article class="prose">${reducedHeadings(doc.html)}</article></section>`;
}
function emptyStage(stage) {
  const locked = draftLocked(stage);
  return `<div class="empty-stage"><span class="empty-marker" aria-hidden="true">○</span><div><h3>${escape(stage.name)} ${stage.exists ? 'draft' : 'has not started'}</h3><p>${locked ? draftReason(stage) : stage.exists ? 'A draft exists. Replace the TODO prompts before requesting approval.' : 'Create a Markdown draft when you are ready. Saving a draft does not approve it.'}</p></div><button class="button subtle" data-action="${stage.exists ? 'edit-document' : 'create-stage'}" data-path="${stage.path}" data-stage="${stage.id}" ${locked ? 'disabled' : ''}>${stage.exists ? 'Open draft' : 'Create draft'}</button></div>`;
}
function packetButton(stage, label = 'Prepare Codex task') { return `<button class="button subtle" data-action="packet" data-stage="${stage}" ${draftLocked({ id: stage }) ? 'disabled' : ''}>${label}</button>`; }
async function episode(params, sequence) {
  const account = workspace.accounts.find(a => a.episodes.some(e => e.id === params.get('episode')));
  const episode = account?.episodes.find(e => e.id === params.get('episode'));
  if (!episode) throw new Error('Episode not found. Return to the pilot overview.');
  const doc = await readDocument(episode.path);
  if (sequence !== routeSequence) return;
  const view = params.get('view') || 'brief';
  document.title = `${episode.story} · Rabbit Hole Studios`;
  const tabs = [['brief', 'Brief & audience'], ['research', 'Research'], ['script', 'Story & script'], ['references', 'References'], ['approvals', 'Approvals']];
  main.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="./">Studio</a><span aria-hidden="true">/</span><a href="${href({ account: account.id })}">${escape(account.name)}</a><span aria-hidden="true">/</span><a href="${href({ account: account.id, show: episode.show })}">${escape(episode.show)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(episode.id)}</span></nav><section class="page-header episode-header"><div><div class="eyebrow">${escape(episode.show)} / ${escape(episode.id)}</div><h1 tabindex="-1">${escape(episode.story)}</h1><p class="lede">${episode.implemented ? 'An investigation into manufactured trust, reputation and the signals we believe.' : 'A first-story hypothesis, ready for premise development.'}</p></div>${badge(episode.stage, 'neutral')}</section>${episode.implemented ? `<nav class="route-tabs" aria-label="Episode sections">${tabs.map(([id, name]) => `<a href="${href({ episode: episode.id, view: id })}"${id === view ? ' aria-current="page"' : ''}>${name}</a>`).join('')}</nav><div id="episode-body"></div>` : `<div class="context-banner">The working tools are available for PSY-A-01. This episode currently shows its existing source brief.</div>${documentArticle(doc, 'Pilot brief', false)}`}`;
  if (!episode.implemented) return;
  const body = document.querySelector('#episode-body');
  if (view === 'brief') {
    const working = workspace.detail.artifacts.find(s => s.id === 'brief');
    const nextId = ({ 'Premise review': 'brief', 'Audience alignment': 'brief', Research: 'research', 'Story treatment': 'treatment', 'Full script': 'script', 'Script review': 'editorial-review', 'Script approved': 'storyboard', 'Production proof': 'final-review' })[workspace.detail.currentStage] || 'brief';
    const next = workspace.detail.artifacts.find(s => s.id === nextId);
    const nextTitle = ({ brief: 'Earn the viewer reward', research: 'Follow the original record', treatment: 'Build the complete story', script: 'Draft the whole episode', 'editorial-review': 'Review the complete script', storyboard: 'Plan the production proof', 'final-review': 'Review the finished work' })[nextId];
    const workingDoc = working.exists ? await readDocument(working.path) : null;
    if (sequence !== routeSequence) return;
    body.innerHTML = `<div class="context-banner"><span aria-hidden="true">◇</span><div><strong>Audience-value gate: ${workspace.detail.state.records.audience?.status === 'approved' ? 'approved for this version' : 'working hypothesis'}</strong><span>Premise: ${escape(workspace.detail.premiseStatus.replaceAll('-', ' '))}. The audience gate, script and individual visual assets are reviewed separately.</span></div><a href="${href({ episode: episode.id, view: 'approvals' })}">View approvals</a></div><div class="workspace-columns"><div>${documentArticle(doc, 'The source brief')}${workingDoc ? documentArticle(workingDoc, 'Working episode brief') : emptyStage(working)}</div><aside class="context-panel" aria-label="Episode workflow"><span class="eyebrow">Next useful action</span><h2>${workspace.detail.currentStage === 'Premise review' ? 'Revisit the story premise' : nextTitle}</h2><p>${escape(next.instruction)}</p>${packetButton(nextId, nextId === 'brief' ? 'Prepare audience task' : 'Prepare next task')}<div class="rule"></div><h3>Editorial path</h3><ol class="stage-list">${workspace.detail.artifacts.slice(0, 7).map((s, i) => `<li><span class="stage-number">${i + 1}</span><div>${escape(s.name)}<span class="caption">${s.substantive ? 'Draft present' : s.exists ? 'Draft started' : 'Not started'}</span></div></li>`).join('')}</ol><div class="rule"></div><h3>Read with this episode</h3>${['STUDIO/audience-research.md', 'STUDIO/creative-os.md', 'STUDIO/editorial-workflow.md', 'SHOWS/psychology/README.md'].map(p => docLink(p)).join('')}</aside></div>`;
  } else if (view === 'research') {
    const stage = workspace.detail.artifacts.find(s => s.id === 'research');
    const source = await readDocument('RESEARCH/source-register.md');
    const own = stage.exists ? await readDocument(stage.path) : null;
    if (sequence !== routeSequence) return;
    body.innerHTML = `<div class="view-heading"><div><h2>Evidence before interpretation</h2><p class="measure">The source register is a research queue. Listed sources have not all been verified against the script.</p></div>${packetButton('research')}</div>${own ? documentArticle(own, 'Episode research') : emptyStage(stage)}${documentArticle(source, 'Studio source register', false)}`;
  } else if (view === 'script') {
    const items = await Promise.all(workspace.detail.artifacts.slice(2).map(async s => ({ stage: s, doc: s.exists ? await readDocument(s.path) : null })));
    if (sequence !== routeSequence) return;
    body.innerHTML = `<div class="context-banner"><span aria-hidden="true">◇</span><div><strong>Full episode first</strong><span>A script draft remains a candidate. Storyboarding opens only after a current founder script approval.</span></div></div>${items.map(({ stage, doc }) => `<section class="stage-section"><div class="view-heading"><div><span class="eyebrow">${stage.id === 'script' ? 'Candidate work' : 'Editorial work'}</span><h2>${escape(stage.name)}</h2></div>${packetButton(stage.id)}</div>${doc ? documentArticle(doc, 'Working document', !['storyboard', 'final-review'].includes(stage.id) || workspace.detail.storyboardReady) : emptyStage(stage)}</section>`).join('')}`;
  } else if (view === 'references') {
    body.innerHTML = `<div class="view-heading"><div><h2>Keep style and identity separate</h2><p class="measure">Linked references remain at their original hosts. A link records a source; it does not establish rights or availability.</p></div>${docLink(workspace.sources.visuals[0], 'Style guide')}</div><div class="reference-filters"><label>Search references<input id="reference-search" type="search" placeholder="Name, model or job ID" value="${escape(params.get('q') || '')}"></label><label>Reference type<select id="reference-kind"><option value="all">All types</option>${[['style', 'Style only'], ['identity', 'Identity only'], ['character', 'Character candidate']].map(([id, label]) => `<option value="${id}"${params.get('kind') === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><span id="reference-count" class="caption" role="status"></span></div><div id="reference-results" class="reference-grid"></div><div class="source-pack"><h3>Reusable visual pack</h3>${workspace.sources.visuals.map(p => docLink(p)).join('')}</div>`;
    renderReferences();
  } else if (view === 'approvals') renderApprovals(body);
  else throw new Error('Episode section not found');
}
function renderReferences() {
  const query = document.querySelector('#reference-search').value.toLowerCase();
  const kind = document.querySelector('#reference-kind').value;
  const refs = workspace.detail.references.filter(r => (kind === 'all' || r.kind === kind) && [r.label, r.model, r.jobId].join(' ').toLowerCase().includes(query));
  document.querySelector('#reference-count').textContent = `${refs.length} ${refs.length === 1 ? 'reference' : 'references'}`;
  document.querySelector('#reference-results').innerHTML = refs.length ? refs.map(r => `<article class="reference-card"><div class="reference-top"><span class="reference-type">${escape(r.kind === 'character' ? 'Character design' : r.kind + ' only')}</span>${badge(r.status.replaceAll('-', ' '), r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : '')}</div><h3>${escape(r.label)}</h3><p class="caption">${r.kind === 'style' ? 'Defines drawing technique, proportions and shading.' : r.kind === 'identity' ? 'Defines the real person’s likeness. Verify the era.' : '“Much better” feedback is recorded. Final acceptance is separate.'}</p>${r.model ? `<dl class="reference-meta"><div><dt>Model</dt><dd>${escape(r.model)}</dd></div><div><dt>Job ID</dt><dd class="file-path">${escape(r.jobId || 'Not recorded')}</dd></div><div><dt>Credit cost</dt><dd>Not recorded</dd></div></dl>` : ''}<a class="external-reference" href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">Open linked reference <span aria-hidden="true">→</span></a>${r.kind === 'character' ? `<button class="button subtle" data-action="review-approval" data-id="${r.id}">Review character candidate</button>` : ''}${docLink(r.source, 'Source notes')}</article>`).join('') : `<div class="no-results"><h3>No matching references</h3><p>Try a different name or show all reference types.</p><button class="button subtle" data-action="clear-reference-filters">Clear filters</button></div>`;
}
function renderApprovals(body) {
  const state = workspace.detail.state;
  const rows = [
    ['premise', 'Story premise', workspace.detail.premiseStatus === 'approved' ? 'Approved for development in the existing pilot brief or latest human review.' : 'Review whether this story belongs on the pilot slate.', true],
    ['audience', 'Audience-value gate', 'Confirm the viewer desire, earned reward, evidence limits and buyer hypothesis.', true],
    ['script', 'Full episode script', 'Needs audience approval, research, a complete treatment and script, separate critique and source audit.', workspace.detail.scriptReady],
    ['final', 'Finished output', 'Needs a current approved script, storyboard, local finished output and final review.', workspace.detail.finalReady]
  ];
  body.innerHTML = `<div class="view-heading"><div><h2>Approval is a human decision</h2><p class="measure">Every acceptance records the reviewer and the exact file versions. Changed source material requires another review.</p></div></div><div class="approval-list">${rows.map(([id, name, reason, ready]) => {
    const record = state.records[id]; const status = record?.status || (id === 'premise' ? workspace.detail.premiseStatus : 'pending');
    return `<section class="approval-row"><div><h3>${name}</h3><p>${escape(reason)}</p>${record ? `<span class="caption">${escape(record.reviewer)} · ${stamp(record.reviewedAt)}${record.stale ? ' · Source material changed' : ''}</span>` : id === 'premise' ? `<span class="caption">Source: pilot brief and TRACKING/pilots.csv</span>` : ''}</div><div class="approval-actions">${badge(status.replaceAll('-', ' '), status === 'approved' ? 'approved' : '')}<button class="button subtle" data-action="review-approval" data-id="${id}">Record review</button></div></section>`;
  }).join('')}</div><div class="context-banner"><span aria-hidden="true">◇</span><div><strong>Visual references are approved separately</strong><span>The Oobah sheet is a candidate until a human accepts its likeness, style and continuity.</span></div><a href="${href({ episode: 'PSY-A-01', view: 'references' })}">Review references</a></div>${state.history.length ? `<details class="review-history"><summary>Review history (${state.history.length})</summary>${state.history.slice().reverse().map(r => `<div class="history-row"><strong>${escape(r.id.startsWith('reference:') ? 'Character reference' : r.id)}</strong><span>${escape(r.status)} · ${escape(r.reviewer)} · ${stamp(r.reviewedAt)}</span><p>${escape(r.note || 'No additional note')}</p></div>`).join('')}</details>` : ''}`;
}
async function render(focus = false) {
  const sequence = ++routeSequence;
  const params = new URLSearchParams(location.search);
  try {
    const current = await api('/api/workspace');
    if (sequence !== routeSequence) return;
    workspace = current; updateSyncStatus(); nav();
    if (params.has('document')) {
      const doc = await readDocument(params.get('document'));
      if (sequence !== routeSequence) return;
      const title = doc.content.match(/^# (.+)/m)?.[1] || 'Source document';
      document.title = `${title} · Rabbit Hole Studios`;
      main.innerHTML = `<div class="view-heading"><div><span class="eyebrow">Studio source</span><h1 tabindex="-1">${escape(title)}</h1></div><a class="button subtle" href="${params.get('episode') ? href({ episode: params.get('episode') }) : './'}">Back to ${params.get('episode') ? 'episode' : 'overview'}</a></div>${documentArticle(doc, 'Repository document')}`;
    } else if (params.has('episode')) await episode(params, sequence);
    else overview(params);
    if (focus && sequence === routeSequence) main.querySelector('h1')?.focus({ preventScroll: true });
  } catch (error) {
    if (sequence !== routeSequence) return;
    main.innerHTML = `<section class="error-panel"><h1 tabindex="-1">The workspace could not open</h1><p class="inline-error" role="alert">! ${escape(error.message)}</p><button class="button primary" data-action="retry">Retry</button><a class="button subtle" href="./">Pilot overview</a></section>`;
  } finally {
    if (sequence === routeSequence && workspace) {
      workspace.sync = await api('/api/status');
      updateSyncStatus();
    }
  }
}
async function refresh() { await render(); }
async function syncNow() {
  const button = document.querySelector('#refresh-button');
  if (button) { button.disabled = true; button.textContent = 'Syncing…'; }
  try {
    const result = await api('/api/refresh');
    draftVersions.clear();
    await refresh();
    notify(workspace?.sync?.mode === 'live' ? 'GitHub checked and documents refreshed.' :
      workspace?.sync?.mode === 'degraded' ? 'Some GitHub documents could not load; saved copies shown where possible.' :
      'GitHub unavailable. Showing saved snapshot; check the status message.');
  } finally {
    if (button) { button.disabled = false; button.textContent = '↻ Sync GitHub'; }
  }
}
async function openEditor(file, stage) {
  const doc = await api('/api/document?path=' + encodeURIComponent(file) + '&source=draft');
  if (!doc.editable) throw new Error('This source is read-only in the workspace');
  const seed = doc.exists ? doc.content : (await api('/api/template?stage=' + encodeURIComponent(stage))).content;
  editor = { path: file, version: doc.version, initial: seed, content: seed, dirty: !doc.exists, token: null };
  editForm();
}
function editForm() {
  showDialog('Edit Markdown', `<div class="dialog-body"><p class="file-path">${escape(editor.path)}</p><label for="markdown-input">Document content</label><textarea id="markdown-input" class="markdown-input" spellcheck="false">${escape(editor.content)}</textarea><div class="dialog-actions"><span id="edit-state" class="caption">${editor.dirty ? 'Unsaved changes' : 'No changes'}</span><button class="button subtle" data-action="discard-edit">Discard</button><button class="button primary" data-action="preview-edit">Review diff</button></div></div>`, true);
}
async function previewEdit() {
  editor.content = document.querySelector('#markdown-input').value;
  const preview = await api('/api/preview', { path: editor.path, content: editor.content, version: editor.version });
  editor.token = preview.token;
  showDialog('Review document changes', `<div class="dialog-body"><p class="file-path">${escape(editor.path)}</p><p class="measure">Saving keeps a private draft in this browser. Export drafts to bring them back into the GitHub repository.</p><pre class="diff">${diffHTML(preview.diff)}</pre><div class="dialog-actions"><button class="button subtle" data-action="back-to-edit">Back to edit</button><button class="button primary" data-action="save-edit">Save reviewed changes</button></div></div>`, true);
}
function diffHTML(diff) { return diff.split('\n').map(line => `<span class="${line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-remove' : ''}">${escape(line) || ' '}</span>`).join('\n'); }
async function reviewApproval(id) { showDialog('Repository approval states', '<div class="dialog-body"><p>This browser demo displays the repository’s approval states. Record official approvals in the local workspace after reviewing the source files. Browser drafts never grant approval.</p></div>'); return; 
  const preview = await api('/api/review-preview?id=' + encodeURIComponent(id));
  const canApprove = id === 'script' ? workspace.detail.scriptReady : id === 'final' ? workspace.detail.finalReady : true;
  const approvalHint = canApprove ? '' : id === 'script' ? 'Approval needs a current audience gate and completed research, treatment, full script, critique and source audit. You can still request changes or return this review to pending.' : 'Approval needs a current approved script, storyboard, finished output file and final QA. You can still request changes or return this review to pending.';
  const ref = workspace.detail.references.find(r => r.id === id);
  const name = ref?.label || ({ premise: 'Story premise', audience: 'Audience-value gate', script: 'Full episode script', final: 'Finished output' }[id]);
  showDialog('Record a human review', `<form id="approval-form" class="dialog-body" data-id="${escape(id)}" data-token="${escape(preview.token)}" data-version="${escape(preview.version || '')}"><h3>${escape(name)}</h3><p class="measure">Record your decision after reviewing the source material. Acceptance applies to these file versions.</p><details><summary>Source files in this review</summary>${preview.paths.map(p => `<div class="file-path">${escape(p)}</div>`).join('')}</details><label for="reviewer">Reviewer name <span class="caption">Required</span></label><input id="reviewer" name="reviewer" autocomplete="name" required maxlength="100"><label for="decision">Decision</label><select id="decision" name="decision" required><option value="" disabled selected>Choose a decision</option><option value="approved" ${!canApprove ? 'disabled' : ''}>Approve this version</option><option value="rejected">Request changes</option><option value="pending">Return to pending</option></select>${approvalHint ? `<p class="caption">${approvalHint}</p>` : ''}<label for="review-note">Review note <span class="caption">Optional</span></label><textarea id="review-note" name="note" rows="3"></textarea><label class="checkbox-label"><input name="confirmed" type="checkbox" required><span>I reviewed the material and am explicitly recording a human decision.</span></label><div class="dialog-actions"><button type="button" class="button subtle" data-action="close-dialog">Cancel</button><button class="button primary" type="submit">Record decision</button></div></form>`);
}
async function showPacket(stage) {
  const result = await api('/api/packet?stage=' + encodeURIComponent(stage));
  showDialog('A focused Codex task', `<div class="dialog-body"><p class="measure">Copy this into a Codex task. The packet lists the actual source files; it does not run a background agent.</p><label for="task-packet">Task instructions</label><textarea id="task-packet" class="markdown-input" readonly>${escape(result.content)}</textarea><div class="dialog-actions"><button class="button primary" data-action="copy-packet">Copy task</button></div></div>`, true);
}
async function showChanges() { await browserAPI('/api/export'); notify('Drafts exported. GitHub has not changed.'); }

document.addEventListener('click', async event => {
  const link = event.target.closest('a');
  if (link && !link.target && (link.getAttribute('href') === './' || link.getAttribute('href')?.startsWith('./?')) && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    if (editor?.dirty && !confirm('Discard your unsaved document changes before leaving?')) return;
    editor = null; if (dialog.open) dialog.close();
    history.pushState({}, '', link.href); currentURL = location.href; await render(true); window.scrollTo(0, 0); return;
  }
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action;
  try {
    if (action === 'close-dialog' || action === 'discard-edit') return closeDialog();
    if (action === 'edit-document' || action === 'create-stage') await openEditor(button.dataset.path, button.dataset.stage);
    if (action === 'toggle-document-source') {
      const path = button.dataset.path;
      if (draftVersions.has(path)) draftVersions.delete(path); else draftVersions.add(path);
      await refresh();
    }
    if (action === 'preview-edit') await previewEdit();
    if (action === 'back-to-edit') editForm();
    if (action === 'save-edit') {
      button.disabled = true;
      await api('/api/save', { token: editor.token }); draftVersions.add(editor.path); editor = null; dialog.close(); await refresh(); notify('Draft saved on this device only. Your current GitHub file was not changed.');
    }
    if (action === 'packet') await showPacket(button.dataset.stage);
    if (action === 'review-approval') await reviewApproval(button.dataset.id);
    if (action === 'copy-packet') {
      const field = document.querySelector('#task-packet');
      try { await navigator.clipboard.writeText(field.value); notify('Task copied.'); } catch { field.focus(); field.select(); notify('Task selected. Use your copy shortcut.'); }
    }
    if (action === 'clear-reference-filters') {
      document.querySelector('#reference-search').value = ''; document.querySelector('#reference-kind').value = 'all'; filterReferences();
    }
    if (action === 'retry') await refresh();
  } catch (error) {
    if (dialog.open) document.querySelector('#dialog-error').textContent = '! ' + error.message;
    else notify('! ' + error.message);
    button.disabled = false;
  }
});
document.querySelector('#changes-button').addEventListener('click', () => showChanges().catch(error => notify('! ' + error.message)));
document.querySelector('#refresh-button').addEventListener('click', () => syncNow().catch(error => notify('! ' + error.message)));
dialog.addEventListener('input', event => {
  if (event.target.id === 'markdown-input') {
    editor.content = event.target.value; editor.dirty = editor.content !== editor.initial || editor.version === null;
    document.querySelector('#edit-state').textContent = editor.dirty ? 'Unsaved changes' : 'No changes';
  }
});
dialog.addEventListener('submit', async event => {
  if (event.target.id !== 'approval-form') return;
  event.preventDefault();
  const fields = new FormData(event.target), button = event.submitter; button.disabled = true;
  try {
    await api('/api/approve', { id: event.target.dataset.id, reviewer: fields.get('reviewer'), status: fields.get('decision'), note: fields.get('note'), confirmed: fields.get('confirmed') === 'on', version: event.target.dataset.version || null, reviewToken: event.target.dataset.token });
    dialog.close(); await refresh(); notify('Human review recorded for this version.');
  } catch (error) { document.querySelector('#dialog-error').textContent = '! ' + error.message; button.disabled = false; }
});
function filterReferences() {
  const url = new URL(location.href);
  const query = document.querySelector('#reference-search').value, kind = document.querySelector('#reference-kind').value;
  query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
  kind !== 'all' ? url.searchParams.set('kind', kind) : url.searchParams.delete('kind');
  history.replaceState({}, '', url); currentURL = location.href; renderReferences();
}
document.addEventListener('input', event => { if (event.target.id === 'reference-search') filterReferences(); });
document.addEventListener('change', event => { if (event.target.id === 'reference-kind') filterReferences(); });
window.addEventListener('popstate', () => {
  if (editor?.dirty && !confirm('Discard your unsaved changes before leaving?')) { history.pushState({}, '', currentURL); return; }
  editor = null; if (dialog.open) dialog.close(); currentURL = location.href; render(true);
});
try { await render(); }
catch (error) { main.innerHTML = `<section class="error-panel"><h1>The studio could not load</h1><p role="alert">! ${escape(error.message)}</p><button class="button primary" data-action="retry">Retry</button></section>`; }
