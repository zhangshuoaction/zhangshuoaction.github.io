export const BLOG_PAGE_SIZE = 10;

export function blogPageCount(total) {
  return Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
}

export function blogExtraPages(total) {
  return Array.from({ length: blogPageCount(total) - 1 }, (_, i) => i + 2);
}

export function blogPageUrl(page = 1, tag) {
  const base = tag ? '/tags/' + encodeURIComponent(tag) + '/' : '/blog/';
  return page === 1 ? base : base + 'page/' + page + '/';
}
