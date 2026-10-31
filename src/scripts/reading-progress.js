(() => {
  const button = document.querySelector('[data-reading-progress]');
  const value = document.querySelector('[data-reading-progress-value]');
  const article = document.querySelector('.prose');
  if (!button || !value || !article) return;

  let frame = 0;
  function update() {
    frame = 0;
    const scrollTop = window.scrollY;
    const articleTop = article.getBoundingClientRect().top + scrollTop;
    // Count the first screen as 0%; finish when the article's end is visible.
    const start = Math.max(0, articleTop - 60);
    const end = articleTop + article.getBoundingClientRect().height - window.innerHeight;
    const progress = end <= start ? (scrollTop >= end ? 100 : 0)
      : Math.round(Math.min(1, Math.max(0, (scrollTop - start) / (end - start))) * 100);
    value.textContent = progress + '%';
    button.setAttribute('aria-label', '回顶部，文章阅读进度 ' + progress + '%');
    button.hidden = scrollTop < window.innerHeight;
  }
  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  new ResizeObserver(scheduleUpdate).observe(article);
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  update();
})();
