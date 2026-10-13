// Run this on the computer where you want to use the studio.
// Only Node is needed to start: install the locked dependencies when missing,
// start a loopback server, then open the user's default browser.
import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const app = path.dirname(fileURLToPath(import.meta.url));
const root = await realpath(path.resolve(app, '..'));
const rootId = createHash('sha256').update(root).digest('hex');
const desiredPort = Number(process.env.PORT || 3210);

function openBrowser(url) {
  console.log(`\nYour studio: ${url}`);
  if (process.env.STUDIO_NO_BROWSER === '1') return;
  const [command, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () => console.log('Open the address above in your browser.'));
  child.on('exit', code => { if (code) console.log('Open the address above in your browser.'); });
  child.unref();
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or newer from nodejs.org, then run this command again.');
  if (!Number.isInteger(desiredPort) || desiredPort < 0 || desiredPort > 65535) throw new Error('PORT must be a number from 0 to 65535.');
  const required = ['TRACKING/pilots.csv', 'AGENTS.md', 'SHOWS/psychology/pilot-A-the-setup.md'];
  for (const file of required) {
    try { await access(path.join(root, file)); }
    catch { throw new Error(`Missing ${file}. Keep studio-workspace inside your RabbitHoleStudios folder.`); }
  }
  if (desiredPort > 0) {
    try {
      const url = `http://127.0.0.1:${desiredPort}`;
      const response = await fetch(url + '/api/workspace', { signal: AbortSignal.timeout(1200) });
      const data = await response.json();
      if (response.ok && data.app === 'rabbit-hole-studio-workspace' && data.rootId === rootId) {
        console.log('Your studio is already running.'); openBrowser(url); return;
      }
    } catch { /* Start a new instance below. */ }
  }
  const lock = JSON.parse(await readFile(path.join(app, 'package-lock.json'), 'utf8'));
  let installed = true;
  for (const name of Object.keys(lock.packages[''].dependencies)) {
    try {
      const dependency = JSON.parse(await readFile(path.join(app, 'node_modules', name, 'package.json'), 'utf8'));
      if (dependency.version !== lock.packages['node_modules/' + name].version) installed = false;
    } catch { installed = false; }
  }
  if (!installed) {
    console.log('Installing the studio dependencies. This is needed once.');
    const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: app, stdio: 'inherit', shell: process.platform === 'win32' });
    if (install.error || install.status !== 0) throw new Error('Dependency installation failed. Check the message above and run the launcher again.');
  }
  const { createStudioServer } = await import('./server.mjs');
  const server = await createStudioServer({ root });
  const listen = port => new Promise((resolve, reject) => {
    const onError = error => reject(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => { server.off('error', onError); resolve(); });
  });
  try { await listen(desiredPort); }
  catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    console.log('The usual port is busy. Using another free port.'); await listen(0);
  }
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log('Rabbit Hole Studios is ready. Keep this terminal open while using it.');
  openBrowser(url);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}

main().catch(error => { console.error(`\nStudio could not open: ${error.message}`); process.exitCode = 1; });
