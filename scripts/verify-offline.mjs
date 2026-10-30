import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || 'offline');
const inside = (file) => { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
async function walk(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const files = await walk(root);
const pages = files.filter((file) => file.endsWith('.html'));
assert(pages.length >= 5, 'Expected offline pages');
let count = 0;
async function checkLink(value, owner) {
  if (!value || /^(https?:|mailto:|tel:|data:|\/\/)/i.test(value)) return;
  assert(!value.startsWith('/'), 'Root-based file link: ' + value);
  assert(!value.startsWith('file:'), 'Machine-specific file link: ' + value);
  const url = new URL(value.replaceAll('&amp;', '&'), pathToFileURL(owner));
  assert.equal(url.protocol, 'file:', 'Unexpected protocol: ' + value);
  const target = fileURLToPath(url);
  assert(inside(target), 'File link escapes the portable folder: ' + value);
  await access(target);
  assert((await stat(target)).isFile(), 'Directory links must name index.html: ' + value);
  if (url.hash && target.endsWith('.html')) {
    const html = await readFile(target, 'utf8');
    assert(html.includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'), 'Missing anchor: ' + value);
  }
  count++;
}
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  assert(!/<script\b[^>]*(?:type="module"|src=)/i.test(html), 'File preview cannot depend on module scripts');
  for (const match of html.matchAll(/\b(?:href|src|poster|action)=(["'])(.*?)\1/gi)) {
    const value = match[2];
    assert(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(value), 'Server-dependent page link: ' + value);
    if (match[0].startsWith('src=')) assert(!/^https?:|^\/\//i.test(value), 'Remote media in offline preview');
    await checkLink(value, file);
  }
  for (const match of html.matchAll(/\bsrcset=(["'])(.*?)\1/gi)) {
    if (match[2].startsWith('data:')) continue;
    for (const candidate of match[2].split(',')) await checkLink(candidate.trim().split(/\s+/)[0], file);
  }
}
for (const file of files.filter((file) => file.endsWith('.css'))) {
  const css = await readFile(file, 'utf8');
  assert(!/@import\b/i.test(css), 'Offline styles must not require CSS imports');
  for (const match of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
    assert(!/^https?:|^\/\//i.test(match[2]), 'Remote CSS asset in offline preview');
    await checkLink(match[2].trim(), file);
  }
}
console.log('PASS: ' + pages.length + ' offline pages, ' + count + ' file links/resources/anchors; no local server required.');
