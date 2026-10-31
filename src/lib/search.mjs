// Shared by the browser and the behavior checks. No network or DOM dependency.
export function normalizeSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function findToken(text, token) {
  const exact = text.indexOf(token);
  if (exact >= 0) return { index: exact, fuzzy: false, positions: Array.from({ length: token.length }, (_, i) => exact + i) };
  if (token.length < 2) return null;
  // Allow nearby, ordered characters, e.g. "静博" matches "静态博客".
  for (let start = text.indexOf(token[0]); start >= 0; start = text.indexOf(token[0], start + 1)) {
    let cursor = start;
    const positions = [start];
    for (let i = 1; i < token.length && cursor >= 0; i++) {
      cursor = text.indexOf(token[i], cursor + 1);
      if (cursor >= 0) positions.push(cursor);
    }
    if (cursor >= 0 && cursor - start + 1 <= Math.max(6, token.length * 3)) return { index: start, fuzzy: true, positions };
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

// Return offsets in the original text so normalization never changes the displayed content.
export function getHighlightRanges(value, query) {
  const source = String(value || '');
  const normalized = normalizeSearch(source);
  const tokens = [...new Set(normalizeSearch(query).slice(0, 80).split(' '))].filter(Boolean);
  if (!normalized || !tokens.length) return [];
  const offsets = [];
  let previousSpace = true;
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(source);
  for (const { segment, index } of segments) {
    const part = segment.normalize('NFKC').toLocaleLowerCase();
    for (let i = 0; i < part.length; i++) {
      const space = /\s/.test(part[i]);
      if (space && previousSpace) continue;
      offsets.push({ start: index, end: index + segment.length });
      previousSpace = space;
    }
  }
  if (previousSpace) offsets.pop();
  const ranges = [];
  for (const token of tokens) {
    let offset = 0;
    while (offset < normalized.length) {
      const match = findToken(normalized.slice(offset), token);
      if (!match) break;
      for (const position of match.positions) {
        const original = offsets[offset + position];
        if (original) ranges.push({ ...original });
      }
      offset += match.positions[match.positions.length - 1] + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push(range);
  }
  return merged;
}
