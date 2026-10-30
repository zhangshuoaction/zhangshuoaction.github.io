import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('dist');
const site = new URL(process.env.SITE_URL || 'https://zhangshuoaction.github.io');
assert.equal(site.protocol, 'https:', 'Production must use HTTPS');
assert(!['localhost', '127.0.0.1'].includes(site.hostname), 'Production site cannot use localhost');
async function walk(dir) {
  return (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const pages = (await walk(root)).filter((file) => file.endsWith('.html'));
for (const file of pages) {
  const html = await fs.readFile(file, 'utf8');
  const relative = path.relative(root, file).split(path.sep).join('/');
  // Astro renders the custom 404 with a /404/ URL while emitting 404.html.
  const pathname = relative === '404.html' ? '404/' : relative.endsWith('index.html') ? relative.slice(0, -10) : relative;
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(canonical, new URL(pathname, site).href, 'Incorrect production canonical: ' + relative);
  assert(!/(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?|file:\/\/\/)/i.test(html), 'Local URL leaked into production: ' + relative);
  if (relative !== '404.html') assert(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html), 'Published page blocked from indexing: ' + relative);
}
let urls = 0;
for (const name of ['rss.xml', 'sitemap-index.xml', 'sitemap-0.xml']) {
  const xml = await fs.readFile(path.join(root, name), 'utf8');
  assert(!/localhost|127\.0\.0\.1|file:\/\/\//i.test(xml), 'Local URL leaked into ' + name);
  for (const match of xml.matchAll(/<(?:link|loc)>([^<]+)<\/(?:link|loc)>/g)) {
    assert.equal(new URL(match[1]).origin, site.origin, 'Wrong public origin in ' + name);
    urls++;
  }
}
assert((await fs.readFile(path.join(root, 'robots.txt'), 'utf8')).includes('Sitemap: ' + new URL('sitemap-index.xml', site).href), 'Production robots sitemap is missing');
console.log('PASS: ' + pages.length + ' production pages and ' + urls + ' feed/sitemap URLs use ' + site.origin + ', with no local URLs or accidental noindex.');
