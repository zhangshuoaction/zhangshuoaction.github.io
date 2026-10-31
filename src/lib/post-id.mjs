// The article folder defines its URL; the Markdown filename is for local editing.
export function postIdFromEntry(entry) {
  const parts = entry.replaceAll('\\', '/').split('/');
  const filename = parts.pop();
  return parts.length ? parts.join('/') : filename.replace(/\.md$/i, '');
}
