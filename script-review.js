export const scriptReview = (function createScriptReview() {
  const STORE = "rhs:script-review:notes:v1", REPO = "davondaneils/RabbitHoleStudios";
  let state = null;
  const escape = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rich = s => escape(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const rev = doc => doc.githubRevision || doc.version || "unknown";
  const sourceURL = p => `https://github.com/${REPO}/blob/main/` + p.split("/").map(encodeURIComponent).join("/");
  const safeDate = date => new Date(date).toLocaleDateString("en-CA", {dateStyle:"medium"});
  function paragraphs(raw) {
    raw = String(raw || "");
    const mark = /^## Full narration[^\n]*\n/m.exec(raw);
    const start = mark ? mark.index + mark[0].length : 0;
    const end = raw.indexOf("\n## ", start);
    return raw.slice(start, end < 0 ? undefined : end).trim().split(/\n\s*\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  }
  function stored() {
    try { const x = JSON.parse(localStorage.getItem(STORE) || "{}"); return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
    catch { return {}; }
  }
  function notes() { const a = stored()[state?.episode?.id]; return Array.isArray(a) ? a.filter(n => n && typeof n.id === "string" && typeof n.text === "string") : []; }
  function writeNotes(list) { const all = stored(); all[state.episode.id] = list; localStorage.setItem(STORE, JSON.stringify(all)); }
  function beat(text, index) {
    const beats = [
      ["A real customer calls", "The impossible reservation"],
      ["One ten-pound burner phone", "Building the illusion"],
      ["TripAdvisor approves", "The climb"],
      ["So Oobah opens it.", "The dinner"],
      ["Now trace the reputation backward.", "The reveal"]
    ];
    return beats.find(([start]) => text.startsWith(start))?.[1] || (index === 0 ? "Full narration" : "");
  }
  function comparison(left, right) {
    const a = paragraphs(left), b = paragraphs(right);
    const dp = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)
      dp[i][j] = a[i]===b[j] ? 1+dp[i+1][j+1] : Math.max(dp[i+1][j],dp[i][j+1]);
    const out=[];let i=0,j=0;
    while(i<a.length||j<b.length) {
      if(i<a.length&&j<b.length&&a[i]===b[j]) {out.push(`<p class="rv-same">${rich(a[i])}</p>`);i++;j++;}
      else if(j===b.length||(i<a.length&&dp[i+1][j]>=dp[i][j+1])) {out.push(`<p class="rv-old"><b>− Before</b> ${rich(a[i])}</p>`);i++;}
      else {out.push(`<p class="rv-new"><b>+ After</b> ${rich(b[j])}</p>`);j++;}
    }
    return out.join("");
  }
  function renderNotes() {
    if (!state?.body?.isConnected) return;
    const current = rev(state.script), saved = notes();
    const count = state.body.querySelector("#rv-count");
    if(count) count.textContent = saved.length;
    const footer = state.body.querySelector("#rv-note-state");
    if(footer) footer.textContent = saved.length ? `${saved.length} note${saved.length===1?"":"s"} saved on this device` : "No review notes yet";
    state.items.forEach((_,i)=>{
      const node = state.body.querySelector("#rv-note-inline-"+i);
      if(node) node.innerHTML=saved.filter(n=>n.revision===current&&n.paragraph===i).map(n=>`<div class="rv-inline"><small>YOUR NOTE</small><p>${escape(n.text)}</p></div>`).join("");
    });
    const list=state.body.querySelector("#rv-note-list");
    if(list)list.innerHTML=saved.length?saved.map(n=>{
      const old=n.revision!==current;
      return `<article class="rv-note"><div class="rv-note-top"><span>${old?"Earlier script version":"Current script"} · Paragraph ${n.paragraph+1}</span><button type="button" data-action="rv-delete" data-id="${escape(n.id)}">Delete</button></div>
      <blockquote>${escape(n.excerpt)}</blockquote><p>${escape(n.text)}</p><small>${escape(safeDate(n.createdAt))}${old?" · Check against current script":""}</small>
      ${!old?`<button class="rv-jump" type="button" data-action="rv-jump" data-paragraph="${n.paragraph}">Find in script →</button>`:""}</article>`;
    }).join(""):`<div class="rv-empty"><h3>No notes yet</h3><p>Read the script and tap “Add note” below a paragraph. Your notes are kept in this browser until you submit them on GitHub.</p></div>`;
  }
  function select(tab) {
    if(!state?.body?.isConnected)return;
    state.body.querySelectorAll("[data-action=rv-tab]").forEach(b=>{const active=b.dataset.tab===tab;b.setAttribute("aria-selected",String(active));b.tabIndex=active?0:-1;});
    state.body.querySelectorAll(".rv-panel").forEach(n=>{n.hidden=n.dataset.panel!==tab;});
    if(tab==="history")void loadIssues();
  }
  async function loadIssues() {
    const node=state?.body?.querySelector("#rv-issue-list");
    if(!node||node.dataset.loaded==="yes")return;
    node.textContent="Checking GitHub…";
    const episodeId=state.episode.id;
    try {
      const r=await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&per_page=100`,{cache:"no-store"});
      if(!r.ok)throw Error("HTTP "+r.status);
      const rows=(await r.json()).filter(x=>!x.pull_request&&x.title?.startsWith(`[${episodeId}] Script revision request`)&&x.body?.includes(`rabbit-hole-script-review:${episodeId}`));
      if(!node.isConnected)return;
      node.dataset.loaded="yes";
      node.innerHTML=rows.length?rows.map(x=>{
        const href=typeof x.html_url==="string"&&x.html_url.startsWith(`https://github.com/${REPO}/issues/`)?x.html_url:"#";
        return `<a class="rv-issue" href="${escape(href)}" target="_blank" rel="noopener noreferrer"><strong>${escape(x.title)}</strong><small>#${escape(x.number)} · ${escape(x.state)} · ${escape(safeDate(x.created_at))} ↗</small></a>`;
      }).join(""):`<p class="rv-small">No submitted revision requests found in the latest 100 GitHub issues. Browser notes won't show here until submitted.</p>`;
    }catch(e){if(node.isConnected)node.textContent="Couldn't load GitHub requests: "+e.message;}
  }
  function revisionRequest() {
    const chosen=notes().filter(n=>n.revision===rev(state.script));
    return [
      `# Script revision request: ${state.episode.story}`,"",
      `Episode: ${state.episode.id}`,
      `Source: ${sourceURL(state.base+"/script.md")}`,
      `Script file revision: ${rev(state.script)}`,
      "Status: SCRIPT CANDIDATE — NOT APPROVED","",
      "## Founder feedback","",
      ...chosen.flatMap((n,i)=>[`${i+1}. Paragraph ${n.paragraph+1}`,`> ${n.excerpt.replace(/\n/g," ")}`,n.text,""]),
      "## Next work",
      "Revise the whole episode into a new candidate. Preserve documented facts and caveats. Consult the current brief, editorial review, and source audit. Do not treat this request as approval.","",
      `<!-- rabbit-hole-script-review:${state.episode.id} -->`
    ].join("\n");
  }
  async function render({body,episode,readDocument,showDialog,notify}) {
    const base=`EPISODES/${episode.id}`;
    const [script,edit,audit,older]=await Promise.all([
      readDocument(base+"/script.md"),
      readDocument(base+"/editorial-review.md").catch(()=>null),
      readDocument(base+"/source-audit.md").catch(()=>null),
      readDocument(base+"/script-v0.md").catch(()=>null)
    ]);
    if(!body.isConnected)return;
    const items=paragraphs(script.content);
    if(!script.exists||!items.length){
      body.innerHTML=`<div class="rv-empty"><h2>Script unavailable</h2><p>Try Sync GitHub or read the source on GitHub.</p><a href="${sourceURL(base+"/script.md")}" target="_blank" rel="noopener noreferrer">Open script ↗</a></div>`;
      return;
    }
    state={body,episode,base,script,edit,audit,older,items,showDialog,notify,request:""};
    const version=(script.content.match(/SCRIPT_CANDIDATE\s+v(\d+)/)||[])[1]||"?";
    const title=(script.content.match(/^#.*?[“"]([^”"]+)[”"]/m)||[])[1]||episode.story;
    const source=script.source==="github-main"?"Live GitHub file":script.source==="browser-draft"?"Unsynced browser draft":"Offline snapshot (may be stale)";
    const printed=items.map((p,i)=>`<section class="rv-paragraph" id="rv-para-${i}">${beat(p,i)?`<h3>${escape(beat(p,i))}</h3>`:""}<div class="rv-line"><span>${String(i+1).padStart(2,"0")}</span><p>${rich(p)}</p></div><button type="button" data-action="rv-add" data-paragraph="${i}">+ Add note</button><div id="rv-note-inline-${i}"></div></section>`).join("");
    body.innerHTML=`<div class="review-workspace">
      <header class="rv-header"><div><span class="rv-eyebrow">SCRIPT REVIEW · ${escape(episode.id)}</span><h2>${escape(title)}</h2><p>Candidate V${escape(version)} · Not approved · ~2:10–2:45 estimated</p></div><aside><strong>Your decision</strong><span>Read the story. Give feedback. Request a revision.</span></aside></header>
      <div class="rv-source"><span>${escape(source)} · ${escape(rev(script).slice(0,9))}</span><a href="${sourceURL(base+"/script.md")}" target="_blank" rel="noopener noreferrer">View GitHub source ↗</a></div>
      <nav class="rv-tabs" aria-label="Script review">
        <button type="button" data-action="rv-tab" data-tab="script" aria-selected="true">Script</button>
        <button type="button" data-action="rv-tab" data-tab="notes" aria-selected="false">My notes <span id="rv-count">0</span></button>
        <button type="button" data-action="rv-tab" data-tab="checks" aria-selected="false">Editorial & facts</button>
        <button type="button" data-action="rv-tab" data-tab="history" aria-selected="false">History</button>
      </nav>
      <section class="rv-panel" data-panel="script"><div class="rv-columns"><article class="rv-paper"><div class="rv-paper-intro"><span class="rv-eyebrow">FULL NARRATION</span><p>Read the complete script. Tap “Add note” under a paragraph to attach feedback to this version.</p></div>${printed}<div class="rv-end">END OF SCRIPT · NOT APPROVED</div></article>
        <aside class="rv-aside"><div><span class="rv-eyebrow">WHAT TO JUDGE</span><h3>Is this a video worth making?</h3><p>Consider the opening, pacing, comedy, one-night dinner, and final psychological insight.</p></div><div><span class="rv-eyebrow">BEFORE PRODUCTION</span><p>The script has an editorial critique and factual audit, but neither is founder approval. The character image is also a candidate.</p><button type="button" data-action="rv-tab" data-tab="checks">Review editorial & facts →</button></div></aside></div></section>
      <section class="rv-panel" data-panel="notes" hidden><div class="rv-section-head"><span class="rv-eyebrow">YOUR FEEDBACK</span><h3>Review notes</h3><p>Notes are tied to the script file revision. They stay in this browser until you use GitHub to submit them.</p></div><div id="rv-note-list"></div></section>
      <section class="rv-panel" data-panel="checks" hidden><div class="rv-section-head"><span class="rv-eyebrow">CONTEXT</span><h3>Editorial and factual checks</h3><p>The editorial critique applies to V0; the source audit applies to this V1 candidate. Both remain available in full.</p></div>
        <div class="rv-checks"><article><strong>Editorial changes</strong><p>V1 tightened the repeated opening, added the birthday reservation, and qualified the ending. Runtime and creative direction still need your judgment.</p></article><article><strong>Fact-check cautions</strong><p>The dinner was free. Diners' reactions were mixed. Avoid invented dialogue and precise dates for when the Shed reached #1.</p></article></div>
        ${edit?.exists?`<details class="rv-document"><summary>Read editorial critique of V0</summary><div class="prose">${edit.html}</div><a href="${sourceURL(edit.path)}" target="_blank" rel="noopener noreferrer">Original source ↗</a></details>`:"<p>Editorial document unavailable.</p>"}
        ${audit?.exists?`<details class="rv-document"><summary>Read source audit of V1</summary><div class="prose">${audit.html}</div><a href="${sourceURL(audit.path)}" target="_blank" rel="noopener noreferrer">Original source ↗</a></details>`:"<p>Source audit unavailable.</p>"}
      </section>
      <section class="rv-panel" data-panel="history" hidden><div class="rv-section-head"><span class="rv-eyebrow">VERSION HISTORY</span><h3>V0 → V1</h3><p>Paragraph-level comparison of the actual earlier candidate and current script.</p></div>${older?.exists?`<div class="rv-diff">${comparison(older.content,script.content)}</div>`:"<p>The V0 script isn't available here.</p>"}<div class="rv-section-head rv-later"><h3>Submitted revision requests</h3><p>GitHub issues show up here only after someone submits them.</p></div><div id="rv-issue-list" role="status"></div></section>
      <footer class="rv-actions"><div><strong id="rv-note-state">No notes yet</strong><span>Official approval is still pending.</span></div><button class="button primary" type="button" data-action="rv-request">Prepare revision request →</button></footer>
    </div>`;
    renderNotes();
  }
  async function click(button) {
    if(!state?.body?.isConnected)return;
    const action=button.dataset.action;
    if(action==="rv-tab"){select(button.dataset.tab);return;}
    if(action==="rv-jump"){
      select("script");
      const node=state.body.querySelector("#rv-para-"+button.dataset.paragraph);
      node?.scrollIntoView({behavior:"smooth",block:"center"});return;
    }
    if(action==="rv-add"){
      const i=Number(button.dataset.paragraph);
      if(!Number.isInteger(i)||!state.items[i])return;
      state.showDialog("Leave a script note",`<form class="dialog-body" id="rv-note-form" data-paragraph="${i}"><p class="rv-small">Paragraph ${i+1} · version ${escape(rev(state.script).slice(0,9))}</p><blockquote>${rich(state.items[i])}</blockquote><label for="rv-note-input">Your feedback</label><textarea id="rv-note-input" name="feedback" rows="5" maxlength="1200" required placeholder="What should change?"></textarea><p class="rv-small">This saves locally. It does not submit anything to GitHub.</p><div class="dialog-actions"><button class="button subtle" type="button" data-action="close-dialog">Cancel</button><button class="button primary" type="submit">Save note</button></div></form>`);return;
    }
    if(action==="rv-delete"){
      if(!notes().some(n=>n.id===button.dataset.id)||!confirm("Delete this feedback note?"))return;
      writeNotes(notes().filter(n=>n.id!==button.dataset.id));
      renderNotes();state.notify("Note deleted from this browser.");return;
    }
    if(action==="rv-request"){
      const chosen=notes().filter(n=>n.revision===rev(state.script));
      if(!chosen.length){select("notes");state.notify("Add a note to the script first.");return;}
      const markdown=revisionRequest();state.request=markdown;
      const link=new URL(`https://github.com/${REPO}/issues/new`);
      link.searchParams.set("title",`[${state.episode.id}] Script revision request (V1)`);
      link.searchParams.set("body",markdown);
      const prefilled=state.script.source==="github-main"&&link.href.length<7600;
      state.showDialog("Prepare revision request",`<div class="dialog-body"><p>${chosen.length} note${chosen.length===1?"":"s"} ready, tied to GitHub file revision <code>${escape(rev(state.script).slice(0,9))}</code>.</p><label for="rv-request-copy">Revision request</label><textarea id="rv-request-copy" rows="10" readonly>${escape(markdown)}</textarea><p class="rv-small">${state.script.source!=="github-main"?"This isn't a live GitHub copy. Verify the current file before submitting.":"This repo is public. GitHub will ask you to review and submit the issue; opening it does not send anything. Your local notes remain saved."}</p><div class="dialog-actions"><button class="button subtle" type="button" data-action="rv-copy">Copy request</button><a class="button primary" href="${prefilled?escape(link.href):`https://github.com/${REPO}/issues/new`}" target="_blank" rel="noopener noreferrer">${prefilled?"Open GitHub to submit ↗":"Open GitHub (paste request) ↗"}</a></div></div>`,true);return;
    }
    if(action==="rv-copy"){
      try{await navigator.clipboard.writeText(state.request);state.notify("Revision request copied.");}
      catch{const textarea=document.querySelector("#rv-request-copy");textarea?.focus();textarea?.select();state.notify("Request selected. Use Copy.");}
    }
  }
  function submit(form) {
    if(!state?.body?.isConnected||form.id!=="rv-note-form")return;
    const i=Number(form.dataset.paragraph),value=form.querySelector("textarea[name=feedback]")?.value.trim()||"";
    if(!Number.isInteger(i)||i<0||i>=state.items.length||value.length<2||value.length>1200)throw Error("Write a note between 2 and 1,200 characters.");
    const list=notes();
    list.push({id:crypto.randomUUID(),paragraph:i,excerpt:state.items[i].replace(/\*/g,"").slice(0,200),text:value,revision:rev(state.script),createdAt:new Date().toISOString()});
    writeNotes(list);
    document.querySelector("#dialog")?.close();renderNotes();
    state.notify("Note saved locally. Submit a GitHub issue to share it.");
  }
  return {render,click,submit,paragraphs,comparison};
})();
