import { Marked } from './marked.js';
import { createTwoFilesPatch } from './diff/index.js';
const snapshot = await fetch('./snapshot.json').then(r => { if(!r.ok) throw Error('Repository snapshot could not load'); return r.json(); });
const GITHUB_REPO = 'davondaneils/RabbitHoleStudios';
const GITHUB_API = 'https://api.github.com/repos/' + GITHUB_REPO;
const GITHUB_RAW = 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/main/';
let livePaths = null;
let liveBlobs = null;
let liveError = null;
let liveCheckedAt = null;

// This site is static. Public GitHub reads are safe without credentials; never
// put a GitHub write token in JavaScript delivered to browser visitors.
async function refreshRepository() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(GITHUB_API + '/git/trees/main?recursive=1', {
      signal: controller.signal, cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw Error('GitHub returned HTTP ' + response.status);
    const tree = await response.json();
    if (!Array.isArray(tree.tree) || tree.truncated) throw Error('GitHub file index is unavailable or incomplete');
    const entries = tree.tree.filter(entry => entry.type === 'blob');
    const paths = new Set(entries.map(entry => entry.path));
    if (!paths.has('README.md')) throw Error('GitHub response does not contain studio files');
    livePaths = paths;
    liveBlobs = new Map(entries.map(entry => [entry.path, entry.sha]));
    liveError = null;
    liveCheckedAt = new Date().toISOString();
  } catch (error) {
    // Fail visibly to the bundled snapshot; never imply that stale data is live.
    livePaths = null;
    liveBlobs = null;
    liveError = error.message || 'GitHub could not be reached';
    liveCheckedAt = new Date().toISOString();
  } finally { clearTimeout(timeout); }
}
await refreshRepository();
function onGithub(path) { return !!livePaths && livePaths.has(path); }
function syncState() {
  return { mode: livePaths ? 'live' : 'snapshot', branch: 'main',
    checkedAt: liveCheckedAt, error: liveError, unsyncedDrafts: Object.keys(drafts).length };
}
async function readGithubFile(path) {
  const safePath = path.split('/').map(encodeURIComponent).join('/');
  const revision = liveBlobs?.get(path);
  const url = GITHUB_RAW + safePath + (revision ? '?revision=' + encodeURIComponent(revision) : '');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw Error('Could not load ' + path + ' from GitHub (HTTP ' + response.status + '). Refresh and try again.');
  return response.text();
}
const key = 'rabbit-hole-studio:pages:drafts:v1';
let drafts;
try { drafts = JSON.parse(localStorage.getItem(key) || '{}'); } catch { drafts = {}; }
const previews = new Map();
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const version = async text => text === null ? null : Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
function render(text, file) {
 const engine = new Marked();
 engine.use({renderer:{html({text}) { return esc(text); }, image({text}) { return esc(text || 'Reference image'); }, link({href,tokens}) {
 const label = this.parser.parseInline(tokens);
 if (/^https?:\/\//i.test(href)) return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
 if (href.startsWith('#')) return `<a href="${esc(href)}">${label}</a>`;
 const parts = (file.split('/').slice(0,-1).join('/') + '/' + href.split('#')[0]).split('/'), normalized=[];
 for(const part of parts) { if(part==='..') normalized.pop(); else if(part && part!=='.') normalized.push(part); }
 const target = snapshot.documents[href] ? href : normalized.join('/');
 return (snapshot.documents[target] || onGithub(target)) ? `<a href="./?episode=PSY-A-01&document=${encodeURIComponent(target)}">${label}</a>` : label;
 }}}); return engine.parse(text);
}
const locked = id => id === 'script' ? !snapshot.workspace.detail.scriptDraftReady : ['storyboard','final-review'].includes(id) && !snapshot.workspace.detail.storyboardReady;
export async function browserAPI(url, data) {
 const request = new URL(url, location.origin), p=request.searchParams, route=request.pathname;
 if(route === '/api/refresh') {
  await refreshRepository();
  return syncState();
 }
 if(route === '/api/workspace') {
  const workspace = structuredClone(snapshot.workspace);
  for(const stage of workspace.detail.artifacts) {
    if(livePaths) {
      stage.exists = onGithub(stage.path);
      stage.substantive = stage.exists; // A file exists on GitHub, but is NOT approved.
    }
    if(Object.hasOwn(drafts,stage.path)) {
      stage.exists = true;
      if(!onGithub(stage.path)) stage.substantive = false;
    }
  }
  if(onGithub('EPISODES/PSY-A-01/script.md')) {
    const pilot = workspace.accounts.find(a => a.id === 'psychology')
      ?.episodes.find(e => e.id === 'PSY-A-01');
    if(pilot) {
      pilot.stage = 'Script candidate';
      pilot.nextAction = 'Founder review of full script (not approved)';
      pilot.documentedStatus = 'script-candidate';
    }
    workspace.detail.currentStage = 'Script review';
    // Neither scriptReady nor any approval state is advanced automatically.
  }
  workspace.sync = syncState();
  return workspace;
 }
 if(route === '/api/document') {
  const file = p.get('path');
  if(!file || file.includes('..') || file.startsWith('/') || file.includes('\\'))
    throw Error('Invalid document path');
  const original = snapshot.documents[file];
  if(!original && !onGithub(file)) throw Error('Document is not indexed');
  const repoFileExists = onGithub(file);
  const originalExists = livePaths ? repoFileExists : Boolean(original?.exists);
  let remoteContent;
  try {
    remoteContent = repoFileExists ? await readGithubFile(file) : (originalExists ? original.content : '');
  } catch (error) {
    // Never silently show yesterday's document as if it were today's GitHub revision.
    throw Error('Current repository document could not load: ' + error.message);
  }
  const hasUnsyncedDraft = Object.hasOwn(drafts,file);
  const content = hasUnsyncedDraft ? drafts[file] : remoteContent;
  return { ...original, path:file, exists:originalExists || hasUnsyncedDraft,
    editable:original?.editable ?? false, content, html:render(content,file),
    version:await version(originalExists || hasUnsyncedDraft ? content : null),
    repoFileExists, hasUnsyncedDraft,
    source:hasUnsyncedDraft ? 'browser-draft' : repoFileExists ? 'github-main' : 'snapshot' };
 }
 if(route === '/api/template' || route === '/api/packet') {
  const id=p.get('stage'); if(locked(id)) throw Error('The repository approval gate must be cleared in the local workspace.');
  const value=(route === '/api/template' ? snapshot.templates : snapshot.packets)[id]; if(!value) throw Error('Unknown or blocked stage'); return value;
 }
 if(route === '/api/preview') {
  const original=snapshot.documents[data.path]; if(!original?.editable || typeof data.content !== 'string') throw Error('This document is read-only');
  const stage=snapshot.workspace.detail.artifacts.find(s=>s.path===data.path); if(locked(stage?.id)) throw Error('The repository approval gate is not cleared.');
  const current=await browserAPI('/api/document?path='+encodeURIComponent(data.path));
  if(current.version!==data.version) throw Error('File changed on GitHub or in this browser. Reopen it before editing.');
  const token=crypto.randomUUID(); previews.set(token,{...data}); return {token,diff:createTwoFilesPatch(data.path,data.path,current.content||'',data.content)};
 }
 if(route === '/api/save') {
  const preview=previews.get(data.token); if(!preview) throw Error('Review the diff first');
  const current=await browserAPI('/api/document?path='+encodeURIComponent(preview.path)); if(current.version!==preview.version) throw Error('Draft changed. Review it again.');
  const next={...drafts,[preview.path]:preview.content}; localStorage.setItem(key,JSON.stringify(next)); drafts=next; previews.delete(data.token); return {};
 }
 if(route === '/api/export') {
  const files=Object.entries(drafts); if(!files.length) throw Error('No browser drafts to export yet.');
  const blob=new Blob([JSON.stringify({format:'rabbit-hole-studio-drafts',version:1,repository:'davondaneils/RabbitHoleStudios',note:'Unreviewed browser drafts; import through local diff review. No approvals granted.',files:Object.fromEntries(files)},null,2)],{type:'application/json'});
  const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='studio-drafts.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); return {};
 }
 throw Error('This action requires the local repository workspace.');
}
