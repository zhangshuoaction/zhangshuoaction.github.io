import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { searchArticles, getHighlightRanges } from '../src/lib/search.mjs';

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

const highlighted = (text, query) => getHighlightRanges(text, query).map(({ start, end }) => text.slice(start, end)).join('');
assert.equal(highlighted('产品 产品', '产品'), '产品产品');
assert.equal(highlighted('静态博客', '静博'), '静博');
assert.equal(highlighted('ﬃ & ＭＡＲＫＤＯＷＮ', 'ffi markdown'), 'ﬃＭＡＲＫＤＯＷＮ');
assert.equal(highlighted('Cafe\u0301', 'café'), 'Cafe\u0301');
assert.deepEqual(getHighlightRanges('正文', '   '), []);
console.log('PASS: repeated, fuzzy, full-width, ligature and combining-character highlight offsets.');

const project = fileURLToPath(new URL('../', import.meta.url));
const choices = [process.env.BLOG_BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of choices) { try { await fs.access(candidate); browser = candidate; break; } catch {} }
if (!browser) throw new Error('No browser found. Set BLOG_BROWSER_PATH to a Chromium browser.');
const profile = await fs.mkdtemp(path.join(project, '.browser-check-'));
const screenshots = path.join(project, 'artifacts', 'navigation');
await fs.mkdir(screenshots, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, child, server, readingUrl;
let nextId = 0;
const waiting = new Map();
const errors = [], webRequests = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('CDP timed out: ' + method)); }, 30000);
    waiting.set(id, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
  return reply.result.value;
}
async function waitReady(url) {
  for (let i = 0; i < 300; i++) {
    await sleep(100);
    if (await evaluate('location.href === ' + JSON.stringify(url) + ' && document.readyState === "complete" && !!document.querySelector("[data-theme-toggle]")')) return;
  }
  throw new Error('Page did not become ready: ' + url);
}
async function navigate(url) {
  await send('Page.navigate', { url });
  await waitReady(url);
}
async function follow(selector) {
  const url = await evaluate('(()=>{const a=document.querySelector(' + JSON.stringify(selector) + ');const url=a.href;a.click();return url})()');
  await waitReady(url);
}
async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(screenshots, name + '.png'), Buffer.from(data, 'base64'));
}
async function query(text) {
  await evaluate('document.querySelector("#search-input").value=' + JSON.stringify(text) + ';document.querySelector("#search-input").dispatchEvent(new Event("input",{bubbles:true}));');
  await sleep(180);
  return evaluate('[...document.querySelectorAll("#search-results a")].map(a=>({title:a.querySelector("h3").textContent, text:a.textContent, href:a.href,titleHighlights:[...a.querySelectorAll("h3 mark")].map(m=>m.textContent),bodyHighlights:[...a.querySelectorAll("p mark")].map(m=>m.textContent)}))');
}
async function archiveSnapshot() {
  return evaluate('(()=>{const root=document.querySelector("[data-blog-archive]");return {page:Number(root.dataset.page),pages:Number(root.dataset.totalPages),total:Number(root.dataset.postCount),tag:root.dataset.activeTag||"",ids:[...document.querySelectorAll(".archive-item")].map(a=>a.dataset.postId),dates:[...document.querySelectorAll(".archive-meta time")].map(t=>Date.parse(t.dateTime))}})()');
}
async function checkArchive(home) {
  const start = await archiveSnapshot();
  const tagCounts = await evaluate('[...document.querySelectorAll("[data-blog-tag]")].slice(1).map(a=>Number(a.querySelector(".blog-tag-count").textContent))');
  assert(tagCounts.every((count, i) => i === 0 || count <= tagCounts[i - 1]), 'Tags must be ordered by descending post count');
  assert.equal(await evaluate('Number(document.querySelector("[data-blog-tag]").querySelector(".blog-tag-count").textContent)'), start.total);
  if (start.total) {
    assert(await evaluate('[...document.querySelectorAll(".archive-copy")].every(c=>JSON.stringify([...c.children].map(e=>e.tagName))===JSON.stringify(["H2","DIV","P"]))'), 'Expected title, metadata, description order');
    assert(await evaluate('[...document.querySelectorAll(".archive-meta time")].every(t=>/^\\d{4}\\.\\d{2}\\.\\d{2}$/.test(t.textContent))'), 'Dates must include year/month/day');
    assert.equal(await evaluate('[...document.querySelectorAll(".archive-meta")].some(e=>e.textContent.includes("分钟"))'), false);
    const color = await evaluate('getComputedStyle(document.querySelector(".archive-copy h2 a")).color');
    const box = await evaluate('(()=>{const r=document.querySelector(".archive-copy h2 a").getBoundingClientRect();return {x:r.x+Math.min(10,r.width/2),y:r.y+r.height/2}})()');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await sleep(100);
    assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".archive-copy h2 a")).color'), color, 'Article hover must provide color feedback');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  }
  const colors = await evaluate('["html",".brand-mark",".header-inner nav a[aria-current]"].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return s==="html"?c.backgroundColor:s===".brand-mark"?c.backgroundColor:c.color})');
  for (const color of colors) { const [r,g,b] = color.match(/[\d.]+/g).map(Number); assert(r===g && g===b, 'Light theme default must be neutral: ' + color); }
  const ids = [];
  let lastDate = Infinity;
  for (let page = 1; page <= start.pages; page++) {
    const state = await archiveSnapshot();
    assert.equal(state.page, page);
    assert.equal(state.ids.length, Math.min(10, start.total - (page - 1) * 10));
    for (const date of state.dates) { assert(date <= lastDate, 'Archive dates are not descending'); lastDate = date; }
    ids.push(...state.ids);
    if (page === 2) await screenshot('archive-page-2-light');
    if (page < start.pages) await follow('.blog-pagination a[rel=next]');
  }
  assert.equal(ids.length, start.total);
  assert.equal(new Set(ids).size, ids.length, 'Pagination repeated articles');
  const tag = await evaluate('(()=>{const a=document.querySelectorAll("[data-blog-tag]")[1];return a ? {name:a.dataset.blogTag,count:Number(a.querySelector(".blog-tag-count").textContent)} : null})()');
  if (tag) {
    await follow('.blog-tag-list a:nth-of-type(2)');
    let state = await archiveSnapshot();
    assert.equal(state.page, 1);
    assert.equal(state.tag, tag.name);
    assert.equal(state.total, tag.count);
    const tagged = [];
    for (let page = 1; page <= state.pages; page++) {
      const current = await archiveSnapshot();
      tagged.push(...current.ids);
      assert(await evaluate('[...document.querySelectorAll(".archive-item .inline-tags")].every(e=>e.textContent.includes(' + JSON.stringify(tag.name) + '))'), 'Tag filter included unrelated articles');
      if (page < state.pages) await follow('.blog-pagination a[rel=next]');
    }
    assert.equal(tagged.length, tag.count);
    assert.equal(new Set(tagged).size, tag.count);
    await screenshot('archive-tag-light');
    await follow('[data-blog-tag=""]');
    assert.equal((await archiveSnapshot()).page, 1);
    assert.equal((await archiveSnapshot()).tag, '');
  }
  if (start.pages > 1) {
    await follow('.blog-pagination a[rel=next]');
    assert.equal((await archiveSnapshot()).page, 2);
    await follow('.blog-pagination a[rel=prev]');
    assert.equal((await archiveSnapshot()).page, 1);
  } else assert.equal(await evaluate('!!document.querySelector(".blog-pagination")'), false);
  await navigate(home);
  console.log('PASS: archive rows, neutral light palette, tag count order/filter/reset, all pagination pages, previous/next and no duplicate or missing posts.');
}

async function checkReadingProgress(home, theme, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 760 });
  const article = new URL(readingUrl, home);
  article.searchParams.set('theme', theme);
  await navigate(article.href);
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  await sleep(150);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  assert.equal(await evaluate('document.querySelector("[data-reading-progress]").hidden'), true, 'Reading button must be hidden on the first screen');
  assert.equal(await evaluate('document.querySelector(".toc .eyebrow, .toc .back-top")'), null);
  assert.equal(await evaluate('document.querySelector(".back-link").textContent.trim()'), '返回');
  assert.equal(await evaluate('new URL(document.querySelector(".back-link").href).pathname'), '/blog/');
  const hierarchy = await evaluate('(()=>{const child=document.querySelector(".toc ol ol"),root=document.querySelector(".toc nav > ol > li > a");return child ? {line:getComputedStyle(child).borderLeftWidth,child:child.querySelector("a").getBoundingClientRect().left,root:root.getBoundingClientRect().left} : null})()');
  if (hierarchy) assert(parseFloat(hierarchy.line) > 0 && hierarchy.child > hierarchy.root, 'TOC children must have visible indentation guides');
  if (await evaluate('document.documentElement.scrollHeight - innerHeight <= innerHeight + 20')) {
    await screenshot('reading-short-' + width + '-' + theme);
    console.log('PASS: short article keeps reading control hidden on first screen at ' + width + 'px / ' + theme);
    return;
  }

  await evaluate('window.scrollTo({top:innerHeight/2,behavior:"instant"})');
  await sleep(150);
  assert.equal(await evaluate('document.querySelector("[data-reading-progress]").hidden'), true);
  await evaluate('window.scrollTo({top:innerHeight+20,behavior:"instant"})');
  await sleep(150);
  assert.equal(await evaluate('document.querySelector("[data-reading-progress]").hidden'), false);
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().top'), 0, 'Header must remain visible while scrolling');
  const progress = await evaluate('parseInt(document.querySelector("[data-reading-progress-value]").textContent)');
  assert(progress >= 0 && progress <= 100, 'Expected valid article progress');
  if (await evaluate('document.querySelector(".prose").getBoundingClientRect().bottom <= innerHeight')) assert.equal(progress, 100, 'Article end in view should report completion');
  const bounds = await evaluate('(()=>{const b=document.querySelector("[data-reading-progress]"),r=b.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,position:getComputedStyle(b).position}})()');
  assert.equal(bounds.position, 'fixed');
  assert.equal(bounds.width, 50);
  assert.equal(bounds.width, bounds.height);
  assert(bounds.right <= width && bounds.bottom <= height && bounds.x > width / 2 && bounds.y > height / 2);
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Article horizontal overflow');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".reading-progress-action")).display'), 'none');
  await screenshot('reading-progress-' + width + '-' + theme);
  if (theme === 'dark') {
    const colors = await evaluate('["html",".prose",".toc nav",".sample-notice",".author-avatar",".astro-code",".reading-progress"].map(s=>document.querySelector(s)).filter(Boolean).flatMap(e=>{const c=getComputedStyle(e);return [c.color,c.backgroundColor]})');
    for (const color of colors) {
      const [r, g, b] = color.match(/[\d.]+/g).map(Number);
      assert(r === g && g === b, 'Expected neutral dark theme color: ' + color);
    }
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  await sleep(200);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".reading-progress-action")).display'), 'flex');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-reading-progress-value]")).display'), 'none');
  await screenshot('reading-progress-hover-' + width + '-' + theme);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  for (let i = 0; i < 40 && await evaluate('scrollY > 0'); i++) await sleep(100);
  assert.equal(await evaluate('scrollY'), 0, 'Button click should scroll back to the page top');
  assert.equal(await evaluate('document.querySelector("[data-reading-progress]").hidden'), true);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  await evaluate('window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})');
  await sleep(150);
  assert.equal(await evaluate('document.querySelector("[data-reading-progress-value]").textContent'), '100%');
  const anchor = await evaluate('(()=>{const a=document.querySelector(".toc li.nested a, .toc li a");if(!a)return null;a.click();return decodeURIComponent(a.hash.slice(1))})()');
  if (anchor) {
  let headingTop;
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    headingTop = await evaluate('document.getElementById(' + JSON.stringify(anchor) + ').getBoundingClientRect().top');
    if (headingTop >= 60 && headingTop <= 140) break;
  }
  assert(headingTop >= 60 && headingTop <= 140, 'TOC target hidden by persistent header: ' + headingTop);
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().top'), 0);
  await screenshot('toc-guides-' + width + '-' + theme);
  }
  console.log('PASS: article progress, first-screen visibility, hover, click, bounds and end at ' + width + 'px / ' + theme);
}
try {
  const dist = path.resolve(project, 'dist');
  await fs.access(path.join(dist, 'index.html'));
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.xml': 'application/xml' };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      let target = path.resolve(dist, '.' + pathname);
      const relative = path.relative(dist, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
      if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
      const body = await fs.readFile(target);
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const home = 'http://127.0.0.1:' + server.address().port + '/';
  console.log('Checking built dist pages over a temporary HTTP server.');
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
  await navigate(home);
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'), 60);
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".header-inner nav a")].map(a=>a.textContent.trim())'), ['博客', '关于', '订阅']);
  assert.equal(await evaluate('document.querySelector("h1").textContent.trim()'), '博客');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
  await checkArchive(home);
  await screenshot('desktop-light');
  await evaluate('document.querySelector("[data-search-open]").click()');
  assert.equal(await evaluate('document.querySelector("#site-search").open'), true);
  const indexed = await evaluate('[...document.querySelector("#search-index").content.querySelectorAll("[data-search-post]")].map(a=>({title:a.querySelector("a").textContent,href:new URL(a.querySelector("a").getAttribute("href"),location.href).href,body:a.querySelector("[data-body]").textContent}))');
  assert(indexed.length > 0, 'Browser article checks require at least one published post');
  readingUrl = [...indexed].sort((a,b)=>b.body.length-a.body.length)[0].href;
  const titleQuery = Array.from(indexed[0].title).slice(0,8).join('').trim();
  assert((await query(titleQuery)).some((item) => item.title === indexed[0].title && item.titleHighlights.length > 0));
  const bodySource = [...indexed].sort((a,b)=>b.body.length-a.body.length)[0];
  const bodyQuery = bodySource.body.slice(0,14).trim();
  if (bodyQuery) {
    assert((await query(bodyQuery)).some((item) => item.href === bodySource.href && item.bodyHighlights.length > 0));
    const fullWidth = bodyQuery.replace(/[!-~]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
    assert((await query(fullWidth)).some((item) => item.bodyHighlights.length > 0));
  }
  const characters = Array.from(indexed[0].title.replace(/\s/g,''));
  if (characters.length >= 3) {
    const fuzzyQuery = characters[0] + characters[2];
    assert((await query(fuzzyQuery)).some((item) => item.title === indexed[0].title && item.titleHighlights.join('').includes(fuzzyQuery)));
  }
  assert.equal((await query('zzzz-unpublished-draft-check')).length, 0);
  await query(titleQuery);
  await screenshot('search-results');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('document.querySelector("#site-search").open'), false);
  await evaluate('document.querySelector("[data-theme-toggle]").click()');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await screenshot('desktop-dark');
  assert.equal(await evaluate('getComputedStyle(document.documentElement).backgroundColor'), 'rgb(60, 60, 60)');
  await evaluate('document.querySelector("[data-search-open]").click()');
  await query(titleQuery);
  const highlight = await evaluate('(()=>{const m=document.querySelector("#search-results mark");return {background:getComputedStyle(m).backgroundColor,color:getComputedStyle(m).color}})()');
  assert.notEqual(highlight.background, 'rgba(0, 0, 0, 0)');
  assert.notEqual(highlight.background, highlight.color);
  await screenshot('search-results-dark');
  await evaluate('document.querySelector("#site-search").close()');

  const next = await evaluate('document.querySelector(".archive-item h2 a").href');
  assert.equal(new URL(next).origin, new URL(home).origin);
  await navigate(next);
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await navigate(new URL(readingUrl, home).href);
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  if (await evaluate('!!document.querySelector(".astro-code")')) assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".astro-code")).backgroundColor'), 'rgb(255, 255, 255)');
  await screenshot('article-dark');
  const subscribe = await evaluate('document.querySelector(".subscribe-nav").href');
  await navigate(subscribe);
  assert.equal(await evaluate('document.querySelector("h1").textContent'), '你可以通过下面的方式找到我');
  assert((await evaluate('document.querySelector("#rss-address").value')).startsWith(new URL('rss.xml', home).href));
  await screenshot('subscribe-dark');
  await navigate(new URL('subscribe/?theme=light', home).href);
  await screenshot('subscribe-light');
  for (const theme of ['light', 'dark']) await checkReadingProgress(home, theme, 1280, 900);
  for (const width of [375, 320]) await checkReadingProgress(home, 'dark', width, 812);
  for (const width of [375, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: true });
    await navigate(home + '?theme=light');
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Light archive horizontal overflow at ' + width);
    assert(await evaluate('document.querySelector(".blog-sidebar").getBoundingClientRect().bottom <= document.querySelector(".blog-results").getBoundingClientRect().top'), 'Mobile tags should appear above article list');
    await screenshot('archive-mobile-' + width + '-light');
  }
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
  const external = webRequests.filter((url) => new URL(url).origin !== new URL(home).origin);
  assert.equal(external.length, 0, 'Unexpected external requests: ' + external.join(', '));
  console.log('PASS: built dist browser checks: 60px header, default blog, search, draft exclusion, dialog Escape, theme across pages, subscription RSS, dark code, 375/320px layouts, no external requests.');
  console.log('Screenshots: ' + screenshots);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch {}
    socket.close();
  }
  if (child && child.exitCode === null) { await sleep(1200); if (child.exitCode === null) child.kill(); }
  if (server?.listening) {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
    console.log('Stopped temporary test server.');
  }
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) !== path.resolve(project) || !path.basename(resolved).startsWith('.browser-check-')) throw new Error('Unsafe browser profile cleanup path');
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  console.log('Removed temporary browser profile.');
}
