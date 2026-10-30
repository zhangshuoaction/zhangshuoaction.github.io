const root = document.documentElement;
const themeButton = document.querySelector('[data-theme-toggle]');
const searchButton = document.querySelector('[data-search-open]');
const dialog = document.querySelector('#site-search');
const input = document.querySelector('#search-input');
const resultsList = document.querySelector('#search-results');
const searchStatus = document.querySelector('#search-status');
const template = document.querySelector('#search-index');
const articles = [...template.content.querySelectorAll('[data-search-post]')].map((item) => ({
  title: item.querySelector('a').textContent,
  url: item.querySelector('a').getAttribute('href'),
  body: item.querySelector('[data-body]').textContent,
  description: item.querySelector('[data-description]').textContent,
  date: item.dataset.date,
}));

// file: localStorage can be isolated per file. Carry the preference in page links as well.
function syncThemeLinks(scope = document) {
  if (location.protocol !== 'file:') return;
  for (const link of scope.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) continue;
    const url = new URL(href, location.href);
    if (url.protocol !== 'file:' || !/\.html?$/i.test(url.pathname)) continue;
    url.searchParams.set('theme', root.dataset.theme);
    link.href = url.href;
  }
}
function updateThemeButton() {
  const dark = root.dataset.theme === 'dark';
  const label = dark ? '切换为浅色模式' : '切换为深色模式';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
}
themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.style.colorScheme = root.dataset.theme;
  try { localStorage.setItem('action-blog-theme', root.dataset.theme); } catch {}
  if (location.protocol === 'file:') {
    const url = new URL(location.href);
    url.searchParams.set('theme', root.dataset.theme);
    try { history.replaceState(null, '', url); } catch {}
  }
  updateThemeButton();
  syncThemeLinks();
});
updateThemeButton();
syncThemeLinks();

function showSearch() {
  if (!dialog.open) dialog.showModal();
  input.focus();
}
function renderResults() {
  resultsList.replaceChildren();
  const query = input.value.trim();
  if (!query) {
    searchStatus.textContent = '输入关键词，搜索 ' + articles.length + ' 篇文章的标题和正文。';
    return;
  }
  const results = searchArticles(articles, query);
  searchStatus.textContent = results.length ? '找到 ' + results.length + ' 篇相关文章' : '没有找到相关文章，试试更短的关键词。';
  for (const result of results) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = result.url;
    const title = document.createElement('h3');
    title.textContent = result.title;
    const snippet = document.createElement('p');
    snippet.textContent = result.snippet;
    const meta = document.createElement('span');
    meta.className = 'search-result-meta';
    meta.textContent = result.date + ' · ' + (result.titleMatch ? '标题匹配' : '正文匹配');
    link.append(title, snippet, meta);
    item.append(link);
    resultsList.append(item);
  }
  syncThemeLinks(resultsList);
}
searchButton.addEventListener('click', showSearch);
dialog.addEventListener('close', () => searchButton.focus());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
let pending;
input.addEventListener('input', () => { clearTimeout(pending); pending = setTimeout(renderResults, 100); });
input.addEventListener('keydown', (event) => {
  const first = resultsList.querySelector('a');
  if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); }
  if (event.key === 'Enter') {
    clearTimeout(pending);
    renderResults();
    resultsList.querySelector('a')?.click();
  }
});
resultsList.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const links = [...resultsList.querySelectorAll('a')];
  const index = links.indexOf(document.activeElement);
  event.preventDefault();
  if (event.key === 'ArrowUp' && index <= 0) input.focus();
  else links[Math.max(0, Math.min(links.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dialog.open) { event.preventDefault(); dialog.close(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    showSearch();
  }
});
renderResults();

const rssAddress = document.querySelector('#rss-address');
const rssFile = document.querySelector('[data-rss-file]');
const copyButton = document.querySelector('[data-copy-rss]');
if (rssAddress && rssFile) rssAddress.value = rssFile.href;
copyButton?.addEventListener('click', async () => {
  let copied = false;
  try { await navigator.clipboard.writeText(rssAddress.value); copied = true; } catch {
    rssAddress.select();
  }
  copyButton.textContent = copied ? '已复制' : '请手动复制';
  if (!copied) rssAddress.select();
  setTimeout(() => { copyButton.textContent = '复制地址'; }, 2000);
});
