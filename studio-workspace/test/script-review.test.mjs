import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptReview } from '../pages/site/script-review.js';

const STORE = 'rhs:script-review:notes:v1';
test('overall and paragraph feedback persist, remain version-aware, and use a safe GitHub handoff', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) };
  globalThis.document = { querySelector: () => ({ close() {} }) };
  globalThis.confirm = () => true;
  const nodes = new Map();
  const body = { isConnected:true, innerHTML:'', querySelector: s => {
    if (!nodes.has(s)) nodes.set(s, { innerHTML:'', textContent:'' });
    return nodes.get(s);
  }, querySelectorAll: () => [] };
  let dialog, notice;
  const render = async (revision='revision-one', source='github-main', id='PSY-A-01') => {
    dialog = null;
    await scriptReview.render({ body, episode:{id,story:'Test story'},
      readDocument: async path => ({path,exists:true, content:'## Full narration\nFirst paragraph.\n\nSecond paragraph.',githubRevision:revision,source}),
      showDialog: (title,html) => { dialog={title,html}; }, notify: text => {notice=text;} });
  };
  const click = (action, extra={}) => scriptReview.click({dataset:{action,...extra}});
  const form = (text, extra={}) => ({ id:'rv-note-form', dataset:{kind:'overall',revision:'revision-one',episode:'PSY-A-01',...extra}, querySelector: () => ({value:text}) });
  const saved = () => JSON.parse(storage.get(STORE))['PSY-A-01'];
  const request = () => new URL(dialog.html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'));
  await render();
  assert.match(body.innerHTML, /data-action="rv-overall"/);
  await click('rv-request'); assert.equal(dialog,null); assert.match(notice,/current script/);
  await click('rv-overall'); assert.match(dialog.html,/data-kind="overall"/);
  assert.throws(() => scriptReview.submit(form('  ')), /between 2/);
  scriptReview.submit(form('Rethink the pacing <script>alert(1)</script>'));
  assert.equal(saved()[0].kind,'overall'); assert.equal(saved()[0].revision,'revision-one');
  await render();
  assert.match(nodes.get('#rv-note-list').innerHTML,/Overall feedback/);
  assert.match(nodes.get('#rv-note-list').innerHTML,/&lt;script&gt;/);
  assert.doesNotMatch(nodes.get('#rv-note-list').innerHTML,/Find in script|Paragraph NaN/);
  await click('rv-request');
  assert.match(request().searchParams.get('body'),/1\. Overall feedback\nRethink the pacing/);
  assert.match(request().searchParams.get('body'),/NOT APPROVED/);
  assert.match(dialog.html,/opening it does not send anything/);
  assert.equal(saved().length,1);
  await click('rv-add',{paragraph:'0'}); assert.match(dialog.html,/data-revision="revision-one"/);
  scriptReview.submit(form('Tighten this opening',{kind:undefined,paragraph:'0'}));
  assert.equal(saved()[1].paragraph,0); assert.equal(saved()[1].kind,undefined);
  await click('rv-request'); assert.match(request().searchParams.get('body'),/2\. Paragraph 1\n> First paragraph\.\nTighten/);
  assert.match(nodes.get('#rv-note-inline-0').innerHTML,/Tighten/);
  await render('revision-two');
  assert.match(nodes.get('#rv-note-list').innerHTML,/Earlier script version · Overall feedback/);
  assert.equal(nodes.get('#rv-note-inline-0').innerHTML,'');
  await click('rv-request'); assert.equal(dialog,null);
  assert.throws(() => scriptReview.submit(form('Stale dialog')), /script changed/);
  scriptReview.submit(form('New direction',{revision:'revision-two'}));
  await click('rv-request'); assert.match(request().searchParams.get('body'),/New direction/);
  assert.doesNotMatch(request().searchParams.get('body'),/Tighten|Rethink/);
  await render('revision-two','offline'); await click('rv-request');
  assert.equal(request().search,''); assert.match(dialog.html,/Verify the current file/);
  await render('revision-two','github-main','OTHER'); await click('rv-request'); assert.equal(dialog,null);
  assert.throws(() => scriptReview.submit(form('Wrong episode',{revision:'revision-two'})),/script changed/);
  await render('revision-two');
  await click('rv-delete',{id:saved()[2].id}); assert.equal(saved().length,2);
  await render();
  for(let i=0;i<8;i++) scriptReview.submit(form('Long feedback '.repeat(80)));
  await click('rv-request'); assert.equal(request().search,''); assert.match(dialog.html,/paste request/);
  const original = localStorage.setItem;
  localStorage.setItem = () => {throw Error('Storage full');};
  assert.throws(() => scriptReview.submit(form('Must not report saved')),/Storage full/);
  localStorage.setItem = original;
});
