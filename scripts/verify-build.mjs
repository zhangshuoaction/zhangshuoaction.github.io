import { readFile, readdir, stat, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { postIdFromEntry } from '../src/lib/post-id.mjs';
import { BLOG_PAGE_SIZE } from '../src/lib/pagination.mjs';

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
const articleFiles = [];
for (const file of htmlFiles) {
  if ((await readFile(file, 'utf8')).includes('property="og:type" content="article"')) articleFiles.push(file);
}
assert.equal((rss.match(/<item>/g) || []).length, articleFiles.length, 'RSS and article page counts differ');
const sitemap = await readFile(path.join(root, 'sitemap-0.xml'), 'utf8');
for (const file of articleFiles) {
  const article = await readFile(file, 'utf8');
  if (article.includes('<pre')) assert(article.includes('class="astro-code'), 'Missing syntax highlighting: ' + file);
  if (/<h[23][^>]*id=/.test(article)) assert(article.includes('aria-label="文章目录"'), 'Missing article TOC: ' + file);
}
console.log('PASS: ' + htmlFiles.length + ' pages, ' + links + ' local links and anchors, RSS, sitemap, drafts, syntax highlighting, and article TOC.');

const contentRoot = path.resolve('src/content/blog');
const sources = (await walk(contentRoot)).filter((file) => file.endsWith('.md') && !path.relative(contentRoot, file).split(path.sep).some((part) => ['.obsidian', '.trash'].includes(part)));
const articleIds = new Set();
let published = 0;
for (const source of sources) {
  const raw = await readFile(source, 'utf8');
  const frontmatter = raw.split('---')[1] || '';
  const entry = path.relative(contentRoot, source).split(path.sep).join('/');
  const id = postIdFromEntry(entry);
  assert(!articleIds.has(id), 'Multiple Markdown articles use the same folder/URL: ' + id);
  articleIds.add(id);
  const route = '/blog/' + id.split('/').map(encodeURIComponent).join('/') + '/';
  const output = path.join(root, 'blog', id, 'index.html');
  if (/^draft:\s*true\s*$/m.test(frontmatter)) {
    assert(!files.includes(output), 'Draft page generated: ' + id);
    assert(!rss.includes(route), 'Draft leaked to RSS: ' + id);
    assert(!sitemap.includes(route), 'Draft leaked to sitemap: ' + id);
  } else {
    published++;
    assert(files.includes(output), 'Missing article at its folder URL: ' + entry + ' -> ' + route);
    assert(rss.includes(route), 'Published article missing from RSS: ' + id);
    assert(sitemap.includes(route), 'Published article missing from sitemap: ' + id);
  }
}
assert.equal(articleFiles.length, published, 'Published source and output page counts differ');
console.log('PASS: unique folder URLs, every published article generated at the expected URL, RSS/sitemap inclusion, and all drafts excluded.');

const archiveSeries = new Map();
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  if (!html.includes('data-blog-archive')) continue;
  const page = Number(html.match(/data-page="(\d+)"/)?.[1]);
  const totalPages = Number(html.match(/data-total-pages="(\d+)"/)?.[1]);
  const total = Number(html.match(/data-post-count="(\d+)"/)?.[1]);
  const tag = html.match(/data-active-tag="([^"]*)"/)?.[1] || '';
  const ids = [...html.matchAll(/<article\b[^>]*data-post-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, Math.min(BLOG_PAGE_SIZE, Math.max(0, total - (page - 1) * BLOG_PAGE_SIZE)), 'Incorrect archive page size: ' + file);
  assert.equal(html.includes('aria-label="文章分页"'), totalPages > 1, 'Incorrect pagination visibility: ' + file);
  if (path.relative(root, file) === 'index.html') continue;
  const series = archiveSeries.get(tag) || [];
  series.push({ page, totalPages, total, ids });
  archiveSeries.set(tag, series);
}
for (const [tag, series] of archiveSeries) {
  series.sort((a, b) => a.page - b.page);
  assert.equal(series.length, series[0].totalPages, 'Missing archive pages: ' + tag);
  assert.deepEqual(series.map((entry) => entry.page), Array.from({ length: series.length }, (_, i) => i + 1), 'Archive page numbering is not contiguous: ' + tag);
  const ids = series.flatMap((entry) => entry.ids);
  assert.equal(ids.length, series[0].total, 'Archive omitted articles: ' + tag);
  assert.equal(new Set(ids).size, ids.length, 'Archive duplicated articles across pages: ' + tag);
}
assert.equal(archiveSeries.get('')?.[0].total, published, 'All-blog count does not match published source articles');
console.log('PASS: every archive/tag page has at most 10 posts, complete pagination, no duplicated or omitted posts, and pagination only when needed.');
