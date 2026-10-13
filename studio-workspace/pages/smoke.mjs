import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL((process.env.DESIGN_KB_TOOLS || '/workspace/design-kb/tools') + '/node_modules/playwright-core/index.mjs'));
const root=process.argv[2] || '/tmp/studio-pages';
const server=http.createServer(async(req,res)=>{try {const pathname=new URL(req.url,'http://localhost').pathname; if(!pathname.startsWith('/RabbitHoleStudios/')) throw Error(); const file=pathname.slice('/RabbitHoleStudios/'.length)||'index.html'; if(file.includes('..')) throw Error(); res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html'); res.end(await readFile(root+'/'+file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/RabbitHoleStudios/`;
 await page.goto(base); await page.waitForSelector('.account-panel'); assert.equal(await page.locator('.account-panel').count(),3);
 await page.getByRole('link',{name:'Open episode'}).click(); await page.waitForSelector('#episode-body'); assert.ok(page.url().includes('/RabbitHoleStudios/'));
 await page.locator('#repo-status').waitFor();
 await page.locator('#episode-body [data-path="EPISODES/PSY-A-01/brief.md"]').first().click(); await page.locator('#markdown-input').fill('# Browser draft\n\nPrivate audience notes saved in this browser.');
 await page.getByRole('button',{name:'Review diff'}).click(); await page.getByRole('button',{name:'Save reviewed changes'}).click();
 await page.reload(); await page.waitForSelector('#episode-body'); assert.ok((await page.locator('#episode-body').innerText()).includes('Private audience notes'));
 for(const view of ['research','script','references','approvals']) { await page.goto(base+'?episode=PSY-A-01&view='+view); await page.waitForSelector('#episode-body > *'); }
 await page.getByRole('button',{name:'Record review'}).first().click(); await page.getByText('This browser demo displays').waitFor(); await page.getByRole('button',{name:'Close',exact:true}).click();
 const downloadPromise=page.waitForEvent('download'); await page.getByRole('button',{name:'Export drafts'}).click(); assert.equal((await downloadPromise).suggestedFilename(),'studio-drafts.json');
 await page.setViewportSize({width:390,height:844}); await page.goto(base); await page.waitForSelector('.account-panel'); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]); console.log('Pages smoke passed: nested URL navigation, 3 accounts, episode views, reviewed draft save/reload, approval boundaries, export and mobile.');
}finally{await browser.close(); await new Promise(r=>server.close(r));}
