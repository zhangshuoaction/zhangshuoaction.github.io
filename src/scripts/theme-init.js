(() => {
  let saved = 'light';
  try {
    const query = new URLSearchParams(location.search).get('theme');
    const stored = localStorage.getItem('action-blog-theme');
    if (query === 'dark' || query === 'light') saved = query;
    else if (stored === 'dark' || stored === 'light') saved = stored;
  } catch {
    const query = new URLSearchParams(location.search).get('theme');
    if (query === 'dark' || query === 'light') saved = query;
  }
  try { localStorage.setItem('action-blog-theme', saved); } catch {}
  document.documentElement.dataset.theme = saved;
  document.documentElement.style.colorScheme = saved;
})();
