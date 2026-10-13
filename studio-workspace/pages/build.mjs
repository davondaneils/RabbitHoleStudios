import { createStudioServer, stages } from '../server.mjs';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
const output = path.resolve(process.argv[2] || 'dist-pages');
await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
const server = await createStudioServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const get = async url => { const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`); if (!response.ok) throw Error(await response.text()); return response.json(); };
try {
 const workspace = await get('/api/workspace');
 const paths = [...new Set([...workspace.sources.shared, ...workspace.sources.visuals, ...Object.values(workspace.sources.episodes), ...workspace.accounts.map(a => a.path), ...workspace.detail.artifacts.map(a => a.path)])];
 const documents = Object.fromEntries(await Promise.all(paths.map(async p => [p, await get('/api/document?path=' + encodeURIComponent(p))])));
 const templates = {}, packets = {};
 for (const stage of stages) {
  try { templates[stage.id] = await get('/api/template?stage=' + stage.id); packets[stage.id] = await get('/api/packet?stage=' + stage.id); } catch { /* blocked editorial gates remain blocked */ }
 }
 delete workspace.csrf; delete workspace.rootId;
 await writeFile(path.join(output, 'snapshot.json'), JSON.stringify({workspace, documents, templates, packets}));
 let html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
 html = html.replaceAll('href="/"', 'href="./"').replace('href="/styles.css"', 'href="./styles.css"').replace('src="/app.js"', 'src="./app.js"').replace('Local workspace', 'Browser demo').replace('One story at a time.', 'Drafts stay in this browser.').replace('Review changes', 'Export drafts').replace('<main id="main"', '<p class="caption browser-note">Repository snapshot · Drafts save in this browser; export to keep them. Approval states belong to the repository.</p><main id="main"');
 await writeFile(path.join(output, 'index.html'), html);
 let app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
 app = "import { browserAPI } from './browser-api.js';\n" + app.replace("const href = params => '/?'", "const href = params => './?'");
 const start = app.indexOf('async function api('), end = app.indexOf('\nfunction notify', start);
 app = app.slice(0, start) + 'async function api(url, data) { return browserAPI(url, data); }\n' + app.slice(end);
 app = app.replaceAll('href="/"', 'href="./"').replaceAll(": '/'", ": './'").replace("=== '/'", "=== './'").replace("startsWith('/?')", "startsWith('./?')");
 app = app.replace('Saving writes this Markdown file locally. Review the repository changes before committing.', 'Saving keeps a private draft in this browser. Export drafts to bring them back into the GitHub repository.');
 app = app.replace('Document saved. Approval states reflect the current files.', 'Draft saved in this browser. Export it when ready; GitHub has not changed.');
 const changeStart = app.indexOf('async function showChanges()'), changeEnd = app.indexOf("\ndocument.addEventListener('click'", changeStart);
 app = app.slice(0, changeStart) + `async function showChanges() { await browserAPI('/api/export'); notify('Drafts exported. GitHub has not changed.'); }\n` + app.slice(changeEnd);
 app = app.replace('async function reviewApproval(id) {', "async function reviewApproval(id) { showDialog('Repository approval states', '<div class=\"dialog-body\"><p>This browser demo displays the repository’s approval states. Record official approvals in the local workspace after reviewing the source files. Browser drafts never grant approval.</p></div>'); return; ");
 await writeFile(path.join(output, 'app.js'), app);
 for (const [source, target] of [['../public/styles.css','styles.css'], ['./browser-api.js','browser-api.js'], ['../node_modules/marked/lib/marked.esm.js','marked.js']]) { if(target) await copyFile(new URL(source, import.meta.url), path.join(output,target)); }
 // Diff's ES module tree keeps its own relative imports.
 const { cp } = await import('node:fs/promises'); await cp(new URL('../node_modules/diff/libesm/', import.meta.url), path.join(output,'diff'), {recursive:true});
 await writeFile(path.join(output, '.nojekyll'), '');
 await writeFile(path.join(output, 'styles.css'), (await readFile(path.join(output, 'styles.css'), 'utf8')) + '\n.browser-note { padding: 0 1.5rem; }\n');
 console.log(`Built browser studio: ${workspace.accounts.length} accounts, ${paths.length} repository documents → ${output}`);
} finally { await new Promise(resolve => server.close(resolve)); }
