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
  updateThemeButton();
});
updateThemeButton();

function showSearch() {
  if (!dialog.open) dialog.showModal();
  input.focus();
}
function appendHighlightedText(target, value, query) {
  const source = String(value || '');
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const { start, end } of getHighlightRanges(source, query)) {
    if (start > cursor) fragment.append(document.createTextNode(source.slice(cursor, start)));
    const mark = document.createElement('mark');
    mark.className = 'search-highlight';
    mark.textContent = source.slice(start, end);
    fragment.append(mark);
    cursor = end;
  }
  if (cursor < source.length) fragment.append(document.createTextNode(source.slice(cursor)));
  target.replaceChildren(fragment);
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
    appendHighlightedText(title, result.title, query);
    const snippet = document.createElement('p');
    appendHighlightedText(snippet, result.snippet, query);
    const meta = document.createElement('span');
    meta.className = 'search-result-meta';
    meta.textContent = result.date + ' · ' + (result.titleMatch ? '标题匹配' : '正文匹配');
    link.append(title, snippet, meta);
    item.append(link);
    resultsList.append(item);
  }
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
