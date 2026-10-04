/**
 * Entrance of the feed cards in cascade (owner's requests of 3 and 4 Oct 2026): cards below the
 * screen fade and rise in when they come into view, in a 70 ms cascade per batch; cards already on
 * screen when added rise in too, by transform only (no opacity: the first photo stays the LCP and
 * is painted at once). transform/opacity only (CLAUDE.md § 6); nothing with « reduce motion ».
 */
const STEP_MS = 70;
const MAX_DELAY_MS = 420;
let observer: IntersectionObserver | null = null;
let onScreenBatch = 0;
let batchTimer = 0;

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries, io) => {
      let i = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.setProperty('--reveal-delay', `${Math.min(i++ * STEP_MS, MAX_DELAY_MS)}ms`);
        el.classList.add('reveal--in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  return observer;
}

/** Returns the cleanup for a component effect. */
export function reveal(el: HTMLElement | null): () => void {
  if (!el || !('IntersectionObserver' in window)) return () => undefined;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined;
  if (el.getBoundingClientRect().top < window.innerHeight) {
    // Same render = same batch: each next card starts a little later.
    el.style.setProperty('--reveal-delay', `${Math.min(onScreenBatch++ * STEP_MS, MAX_DELAY_MS)}ms`);
    el.classList.add('reveal-rise');
    window.clearTimeout(batchTimer);
    batchTimer = window.setTimeout(() => (onScreenBatch = 0), 50);
    return () => undefined;
  }
  el.classList.add('reveal');
  const io = shared();
  io.observe(el);
  return () => io.unobserve(el);
}
