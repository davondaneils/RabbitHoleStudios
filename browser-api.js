import { Marked } from './marked.js';
import { createTwoFilesPatch } from './diff/index.js';
const snapshot = await fetch('./snapshot.json').then(r => { if(!r.ok) throw Error('Repository snapshot could not load'); return r.json(); });
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
 return snapshot.documents[target] ? `<a href="./?episode=PSY-A-01&document=${encodeURIComponent(target)}">${label}</a>` : label;
 }}}); return engine.parse(text);
}
const locked = id => id === 'script' ? !snapshot.workspace.detail.scriptDraftReady : ['storyboard','final-review'].includes(id) && !snapshot.workspace.detail.storyboardReady;
export async function browserAPI(url, data) {
 const request = new URL(url, location.origin), p=request.searchParams, route=request.pathname;
 if(route === '/api/workspace') {
  const workspace = structuredClone(snapshot.workspace);
  for(const stage of workspace.detail.artifacts) if(Object.hasOwn(drafts,stage.path)) { stage.exists=true; stage.substantive=false; }
  // Browser drafts are unreviewed; they never advance official editorial gates.
  return workspace;
 }
 if(route === '/api/document') {
  const file=p.get('path'), original=snapshot.documents[file]; if(!original) throw Error('Document is not indexed');
  if(!Object.hasOwn(drafts,file)) return {...original,html: original.html.replaceAll('href="/?','href="./?')};
  const content=drafts[file]; return {...original,exists:true,content,html:render(content,file),version:await version(content)};
 }
 if(route === '/api/template' || route === '/api/packet') {
  const id=p.get('stage'); if(locked(id)) throw Error('The repository approval gate must be cleared in the local workspace.');
  const value=(route === '/api/template' ? snapshot.templates : snapshot.packets)[id]; if(!value) throw Error('Unknown or blocked stage'); return value;
 }
 if(route === '/api/preview') {
  const original=snapshot.documents[data.path]; if(!original?.editable || typeof data.content !== 'string') throw Error('This document is read-only');
  const stage=snapshot.workspace.detail.artifacts.find(s=>s.path===data.path); if(locked(stage?.id)) throw Error('The repository approval gate is not cleared.');
  const current=Object.hasOwn(drafts,data.path) ? drafts[data.path] : original.exists ? original.content : null;
  if(await version(current)!==data.version) throw Error('Draft changed. Reopen it before editing.');
  const token=crypto.randomUUID(); previews.set(token,{...data}); return {token,diff:createTwoFilesPatch(data.path,data.path,current||'',data.content)};
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
