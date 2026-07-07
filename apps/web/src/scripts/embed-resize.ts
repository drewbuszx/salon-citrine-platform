/**
 * Embed mode: notify the parent marketing page when booking content height changes.
 * Host pages listen for `{ type: "saloncitrine:embed-height", height: number }`.
 * Snippet: apps/web/src/pages/embed-demo.astro · docs/EMBED_BOOK.md
 */
function initEmbedResize() {
  if (document.documentElement.dataset.bookingEmbed !== "1") return;
  if (window.parent === window) return;

  let lastHeight = 0;
  let raf = 0;

  const postHeight = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0,
        ),
      );
      if (height === lastHeight || height < 1) return;
      lastHeight = height;
      window.parent.postMessage(
        { type: "saloncitrine:embed-height", height },
        "*",
      );
    });
  };

  postHeight();

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }

  window.addEventListener("load", postHeight);
  window.addEventListener("resize", postHeight);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEmbedResize);
} else {
  initEmbedResize();
}
