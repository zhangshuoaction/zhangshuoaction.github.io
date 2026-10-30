import { cp, lstat, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(project, 'dist');
const output = path.resolve(project, 'offline');
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not supported in the offline export: ' + file);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}
const sourceEntry = await lstat(source);
if (!sourceEntry.isDirectory() || sourceEntry.isSymbolicLink()) throw new Error('Run astro build first; dist must be a real directory.');
const files = await walk(source);
const home = await readFile(path.join(source, 'index.html'), 'utf8');
const site = new URL(home.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1] || 'http://localhost:4321/');
async function localLink(value, file) {
  if (!value || value.startsWith('#') || /^(data:|mailto:|tel:|javascript:|blob:)/i.test(value)) return value;
  const page = path.relative(source, file).split(path.sep).map(encodeURIComponent).join('/');
  const url = new URL(value.replaceAll('&amp;', '&'), new URL(page, site));
  if (url.origin !== site.origin) return value;
  let target = path.resolve(source, '.' + decodeURIComponent(url.pathname));
  if (!inside(source, target)) throw new Error('Link escapes the export: ' + value);
  if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
  await stat(target);
  const relative = path.relative(path.dirname(file), target).split(path.sep).map(encodeURIComponent).join('/');
  return (relative || path.basename(target)) + url.search.replaceAll('&', '&amp;') + url.hash;
}
async function replaceAsync(input, pattern, replacer) {
  const matches = [...input.matchAll(pattern)];
  let result = '', offset = 0;
  for (const match of matches) {
    result += input.slice(offset, match.index) + await replacer(match);
    offset = match.index + match[0].length;
  }
  return result + input.slice(offset);
}
if (output !== path.join(project, 'offline') || !inside(project, output)) throw new Error('Unsafe export directory');
const previous = await lstat(output).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (previous && (!previous.isDirectory() || previous.isSymbolicLink())) throw new Error('Refusing to replace a non-directory or linked offline path.');
await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });
let count = 0;
for (const file of files) {
  const destination = path.join(output, path.relative(source, file));
  if (file.endsWith('.html')) {
    let html = await readFile(file, 'utf8');
    // These web-only URLs do not describe a portable file preview.
    html = html.replace(/<link\b[^>]*rel="canonical"[^>]*>/gi, '')
      .replace(/<meta\b[^>]*property="og:(?:url|image)"[^>]*>/gi, '')
      .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '');
    if (/<script\b[^>]*(?:type="module"|src=)/i.test(html)) throw new Error('Offline preview supports inline classic scripts only; external or module scripts require adaptation: ' + file);
    html = await replaceAsync(html, /\b(href|src|poster|action)=(["'])(.*?)\2/gi, async (match) =>
      match[1] + '=' + match[2] + await localLink(match[3], file) + match[2]);
    html = await replaceAsync(html, /\bsrcset=(["'])(.*?)\1/gi, async (match) => {
      if (match[2].startsWith('data:')) return match[0];
      const candidates = [];
      for (const candidate of match[2].split(',')) {
        const [url, ...descriptor] = candidate.trim().split(/\s+/);
        candidates.push([await localLink(url, file), ...descriptor].join(' '));
      }
      return 'srcset=' + match[1] + candidates.join(', ') + match[1];
    });
    html = html.replace('通过 RSS 订阅，在你喜欢的阅读器里收到更新。', '当前为本地内容快照，网站上线后可通过 RSS 订阅更新。');
    await writeFile(destination, html, 'utf8');
    count++;
  } else if (file.endsWith('.css')) {
    let css = await readFile(file, 'utf8');
    css = await replaceAsync(css, /url\(\s*(["']?)([^"')]+)\1\s*\)/gi, async (match) => 'url("' + await localLink(match[2].trim(), file) + '")');
    await writeFile(destination, css, 'utf8');
  }
}
await writeFile(path.join(output, 'README.txt'), 'Action Blog 离线预览\n\n双击 index.html 即可阅读，无需 Node.js、网络或本地服务。\n移动或分享时请保留整个 offline 文件夹，不要只复制单个 HTML。\n修改文章或样式后，在项目中运行 npm run build:offline 更新快照。\nRSS、Sitemap 等 XML 是静态文件，保留构建时的站点地址；正式订阅需要网站上线。\n', 'utf8');
console.log('Offline export ready: ' + count + ' pages. Open offline/index.html directly.');
