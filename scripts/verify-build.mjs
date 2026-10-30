import { readFile, readdir, stat, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('dist');
const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
const files = await walk(root);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
assert(htmlFiles.length >= 5, 'Expected built pages');
let links = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  assert(html.includes('lang="zh-CN"'), 'Missing Chinese page language: ' + file);
  assert(html.includes('name="description"'), 'Missing description: ' + file);
  assert(html.includes('rel="canonical"'), 'Missing canonical: ' + file);
  const relative = path.relative(root, file).split(path.sep).join('/');
  const pagePath = relative.endsWith('index.html') ? relative.slice(0, -10) : relative;
  const base = new URL(pagePath, 'https://verify.invalid/');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1].replaceAll('&amp;', '&');
    if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(value)) continue;
    const url = new URL(value, base);
    const decoded = decodeURIComponent(url.pathname);
    let target = path.join(root, decoded.replace(/^\/+/, ''));
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      await access(target);
    } catch {
      throw new Error('Broken link in ' + relative + ': ' + value);
    }
    if (url.hash && target.endsWith('.html')) {
      const content = target === file ? html : await readFile(target, 'utf8');
      const id = decodeURIComponent(url.hash.slice(1));
      assert(content.includes('id="' + id + '"'), 'Broken anchor in ' + relative + ': ' + value);
    }
    links++;
  }
}
const rss = await readFile(path.join(root, 'rss.xml'), 'utf8');
const articleFiles = htmlFiles.filter((file) => path.relative(root, file).split(path.sep).join('/').startsWith('blog/') && path.relative(root, file).split(path.sep).length > 2);
assert.equal((rss.match(/<item>/g) || []).length, articleFiles.length, 'RSS and article page counts differ');
const sitemap = await readFile(path.join(root, 'sitemap-0.xml'), 'utf8');
for (const file of articleFiles) {
  const article = await readFile(file, 'utf8');
  if (article.includes('<pre')) assert(article.includes('class="astro-code'), 'Missing syntax highlighting: ' + file);
  if (/<h[23][^>]*id=/.test(article)) assert(article.includes('aria-label="文章目录"'), 'Missing article TOC: ' + file);
}
console.log('PASS: ' + htmlFiles.length + ' pages, ' + links + ' local links and anchors, RSS, sitemap, drafts, syntax highlighting, and article TOC.');

for (const source of (await walk(path.resolve('src/content/blog'))).filter((file) => file.endsWith('.md'))) {
  const raw = await readFile(source, 'utf8');
  const frontmatter = raw.split('---')[1] || '';
  if (!/^draft:\s*true\s*$/m.test(frontmatter)) continue;
  const id = path.relative(path.resolve('src/content/blog'), source).split(path.sep).join('/').slice(0, -3);
  const route = '/blog/' + id + '/';
  assert(!files.includes(path.join(root, 'blog', id, 'index.html')), 'Draft page generated: ' + id);
  assert(!decodeURIComponent(rss).includes(route), 'Draft leaked to RSS: ' + id);
  assert(!decodeURIComponent(sitemap).includes(route), 'Draft leaked to sitemap: ' + id);
}
console.log('PASS: all current draft source routes excluded from published output.');
