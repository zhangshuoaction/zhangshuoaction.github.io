// Shared by the browser and the behavior checks. No network or DOM dependency.
export function normalizeSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function findToken(text, token) {
  const exact = text.indexOf(token);
  if (exact >= 0) return { index: exact, fuzzy: false };
  if (token.length < 2) return null;
  // Allow nearby, ordered characters, e.g. "静博" matches "静态博客".
  for (let start = text.indexOf(token[0]); start >= 0; start = text.indexOf(token[0], start + 1)) {
    let cursor = start;
    for (let i = 1; i < token.length && cursor >= 0; i++) cursor = text.indexOf(token[i], cursor + 1);
    if (cursor >= 0 && cursor - start + 1 <= Math.max(6, token.length * 3)) return { index: start, fuzzy: true };
  }
  return null;
}

export function searchArticles(articles, query) {
  const normalized = normalizeSearch(query).slice(0, 80);
  if (!normalized) return [];
  const tokens = [...new Set(normalized.split(' '))];
  const results = [];
  for (const article of articles) {
    const title = normalizeSearch(article.title);
    const body = normalizeSearch(article.body);
    let score = 0, bodyIndex = -1, titleMatch = false, bodyMatch = false, matched = true;
    for (const token of tokens) {
      const inTitle = findToken(title, token);
      const inBody = findToken(body, token);
      if (!inTitle && !inBody) { matched = false; break; }
      if (inTitle) { score += inTitle.fuzzy ? 40 : 100; titleMatch = true; }
      if (inBody) {
        score += inBody.fuzzy ? 4 : 20;
        bodyMatch = true;
        if (bodyIndex < 0) bodyIndex = inBody.index;
      }
    }
    if (!matched) continue;
    if (title === normalized) score += 200;
    else if (title.includes(normalized)) score += 60;
    const text = bodyMatch ? String(article.body).replace(/\s+/g, ' ') : article.description;
    const start = bodyMatch ? Math.max(0, bodyIndex - 35) : 0;
    const snippet = (start ? '…' : '') + text.slice(start, start + 130) + (text.length > start + 130 ? '…' : '');
    results.push({ ...article, score, snippet, titleMatch, bodyMatch });
  }
  return results.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
}
