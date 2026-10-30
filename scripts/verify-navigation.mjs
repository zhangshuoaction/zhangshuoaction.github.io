import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { searchArticles } from '../src/lib/search.mjs';

const samples = [
  { title: '静态博客与产品', body: '我们记录写作过程并验证想法。', description: '示例', date: '2026.10.30', url: '/a/' },
  { title: '技术笔记', body: '用 Markdown 记录产品，检查构建产物。', description: '示例', date: '2026.10.29', url: '/b/' },
];
assert.equal(searchArticles(samples, '产品')[0].url, '/a/');
assert.equal(searchArticles(samples, '构建产物')[0].url, '/b/');
assert.equal(searchArticles(samples, 'ＭＡＲＫＤＯＷＮ')[0].url, '/b/');
assert.equal(searchArticles(samples, '静博')[0].url, '/a/');
assert.equal(searchArticles(samples, '产品 验证')[0].url, '/a/');
assert.equal(searchArticles(samples, 'zzzzunknown').length, 0);
assert.equal(searchArticles(samples, '   ').length, 0);
console.log('PASS: title/body search, ranking, Unicode normalization, fuzzy characters, multi-term and empty/no-result queries.');

const project = fileURLToPath(new URL('../', import.meta.url));
const choices = [process.env.BLOG_BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of choices) { try { await fs.access(candidate); browser = candidate; break; } catch {} }
if (!browser) throw new Error('No browser found. Set BLOG_BROWSER_PATH to a Chromium browser.');
const profile = await fs.mkdtemp(path.join(project, '.browser-check-'));
const screenshots = path.join(project, 'artifacts', 'navigation');
await fs.mkdir(screenshots, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, child;
let nextId = 0;
const waiting = new Map();
const errors = [], webRequests = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('CDP timed out: ' + method)); }, 10000);
    waiting.set(id, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
  return reply.result.value;
}
async function navigate(url) {
  await send('Page.navigate', { url });
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    if (await evaluate('location.href === ' + JSON.stringify(url) + ' && document.readyState === "complete" && !!document.querySelector("[data-theme-toggle]")')) return;
  }
  throw new Error('Page did not become ready: ' + url);
}
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(screenshots, name + '.png'), Buffer.from(data, 'base64'));
}
async function query(text) {
  await evaluate('document.querySelector("#search-input").value=' + JSON.stringify(text) + ';document.querySelector("#search-input").dispatchEvent(new Event("input",{bubbles:true}));');
  await sleep(180);
  return evaluate('[...document.querySelectorAll("#search-results a")].map(a=>({title:a.querySelector("h3").textContent, text:a.textContent, href:a.href}))');
}
try {
  child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  let port;
  for (let i = 0; i < 120; i++) {
    if (spawnError) throw spawnError;
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; if (port) break; } catch {}
    await sleep(100);
  }
  if (!port) throw new Error('Browser debugging endpoint unavailable');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const target = targets.find((item) => item.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.id) {
      const pending = waiting.get(message.id);
      if (!pending) return;
      waiting.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    else if (message.method === 'Network.requestWillBeSent' && /^https?:/.test(message.params.request.url)) webRequests.push(message.params.request.url);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const home = pathToFileURL(path.join(project, 'offline', 'index.html')).href;
  await navigate(home);
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'), 60);
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".header-inner nav a")].map(a=>a.textContent.trim())'), ['博客', '关于', '订阅']);
  assert.equal(await evaluate('document.querySelector("h1").textContent.trim()'), '博客');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
  await screenshot('desktop-light');
  await evaluate('document.querySelector("[data-search-open]").click()');
  assert.equal(await evaluate('document.querySelector("#site-search").open'), true);
  assert((await query('Markdown')).some((item) => item.title.includes('Markdown')));
  assert((await query('npm run preview')).some((item) => item.text.includes('正文匹配')));
  assert((await query('搭博')).some((item) => item.title.includes('搭建一个小博客')));
  assert.equal((await query('尚未发布的草稿')).length, 0);
  await query('Markdown');
  await screenshot('search-results');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('document.querySelector("#site-search").open'), false);
  await evaluate('document.querySelector("[data-theme-toggle]").click()');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await screenshot('desktop-dark');
  const next = await evaluate('document.querySelector(".archive-item h2 a").href');
  assert(next.includes('theme=dark'));
  await navigate(next);
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await navigate(new URL('blog/markdown-guide/index.html?theme=dark', home).href);
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".astro-code")).backgroundColor'), 'rgb(255, 255, 255)');
  await screenshot('article-dark');
  const subscribe = await evaluate('document.querySelector(".subscribe-nav").href');
  await navigate(subscribe);
  assert.equal(await evaluate('document.querySelector("h1").textContent'), '你可以通过下面的方式找到我');
  assert((await evaluate('document.querySelector("#rss-address").value')).startsWith('file:'));
  await screenshot('subscribe-dark');
  await navigate(subscribe.replace('theme=dark', 'theme=light'));
  await screenshot('subscribe-light');
  for (const width of [375, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: true });
    await navigate(home + '?theme=dark');
    assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'), 60);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow at ' + width);
    assert(await evaluate('[...document.querySelectorAll(".header-inner nav a,.header-actions > *")].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})'), 'Header action overflow at ' + width);
    await screenshot('mobile-' + width + '-dark');
    if (width === 375) { await navigate(await evaluate('document.querySelector(".subscribe-nav").href')); await screenshot('subscribe-mobile-dark'); }
  }
  await evaluate('document.querySelector("[data-theme-toggle]").click()');
  await navigate(await evaluate('document.querySelector(".subscribe-nav").href'));
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
  assert.equal(errors.length, 0, 'Browser script exceptions: ' + errors.join(', '));
  assert.equal(webRequests.length, 0, 'Offline page made network requests: ' + webRequests.join(', '));
  console.log('PASS: file:// browser checks: 60px header, default blog, search, draft exclusion, dialog Escape, theme across pages, subscription RSS, dark code, 375/320px layouts, no network requests.');
  console.log('Screenshots: ' + screenshots);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch {}
    socket.close();
  }
  if (child && child.exitCode === null) { await sleep(1200); if (child.exitCode === null) child.kill(); }
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) !== path.resolve(project) || !path.basename(resolved).startsWith('.browser-check-')) throw new Error('Unsafe browser profile cleanup path');
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  console.log('Removed temporary browser profile.');
}
