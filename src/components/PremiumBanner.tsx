import { useEffect, useRef, useState } from 'preact/hooks';
import { cityBySlug } from '../data/cities';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { loadBanner } from '../lib/feed';
import { readFeedCache, writeFeedCache } from '../lib/feed-cache';
import { prepareListing } from '../lib/listing-handoff';
import { listingPhotoUrl } from '../lib/photo-url';
import { ageFromBirthMonth, keepOrder, promotion, shuffled, type PublicListing } from '../lib/public-listing';
import { VerifiedBadge } from './Icon';
import { listingHref } from './ListingCard';

/** Pixels per second of the automatic scroll (owner's request of 4 Oct 2026). */
const SPEED = 70;
/** Last rail seen in this browser, shown at once while the fresh one loads. */
const CACHE_KEY = 'rail';
/** After a touch, a drag or the wheel, the rail stays still this long. */
const RESUME_MS = 2000;
/** Fewer plates than this fit a phone width: shown still, without the looping copy. */
const MIN_TO_LOOP = 3;
/** A pointer that moved more than this was a drag, not a tap: the link is not followed. */
const DRAG_PX = 6;
/** Plates visible at once on a phone: their photos load first. */
const EAGER = 3;

function Plate({ l, copy, eager }: { l: PublicListing; copy: boolean; eager: boolean }) {
  const premium = promotion(l) === 'premium';
  const main = l.photos[0] ?? '';
  return (
    <li class="plate-slot" aria-hidden={copy || undefined}>
      <a
        class={`plate${premium ? ' plate--premium' : ''}`}
        href={listingHref(l.id)}
        tabIndex={copy ? -1 : undefined}
        draggable={false}
        onPointerDown={() => prepareListing(l)}
        onFocus={() => prepareListing(l)}
      >
        <img
          class="plate__img"
          src={listingPhotoUrl(main, 360) ?? ''}
          width={190}
          height={260}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
        <span class="plate__scrim" />
        <span class={`stamp stamp--${premium ? 'premium' : 'sponsored'}`}>
          {premium ? fr.banner.premium : fr.banner.sponsored}
        </span>
        <span class="plate__caption">
          <span class="plate__who">
            {/* The comma stays with the pseudo: a cut pseudo reads « Junior237… 29 ». */}
            <span class="plate__name">{l.pseudo},</span>
            <span class="plate__age">{ageFromBirthMonth(l.birthMonth)}</span>
            {l.verified && <VerifiedBadge />}
          </span>
          <span class="plate__where">
            {l.district} · {cityBySlug(l.citySlug)?.name ?? ''}
          </span>
        </span>
      </a>
    </li>
  );
}

/** While loading (nothing cached): placeholders of the same size as the plates. */
function Placeholders() {
  return (
    <ul class="reel" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} class="plate-slot">
          <div class="plate plate--skeleton skeleton" />
        </li>
      ))}
    </ul>
  );
}

/** No promotion anywhere: an honest invitation in the same space (nothing below moves). */
function Invitation() {
  return (
    <a class="rail-invite" href="/compte#annonces">
      <span class="rail-invite__title">{fr.banner.inviteTitle}</span>
      <span class="rail-invite__body">{fr.banner.inviteBody}</span>
      <span class="button button--gold">{fr.banner.inviteAction}</span>
    </a>
  );
}

/**
 * Premium rail at the very top of the home and city pages (SPEC § 6, owner's decisions of 3 Oct
 * 2026): every Premium then Sponsored listing of every city, drawn at random on each load, scrolls
 * by itself at 55 px/s in an endless loop (the list is shown twice), stops while touched, hovered
 * or focused, follows the finger or the mouse, and starts again 2 s later. With
 * `prefers-reduced-motion` it never moves by itself. Its height is fixed from the first paint
 * (placeholders, then plates or the invitation): nothing below it ever moves (CLS).
 */
export function PremiumBanner() {
  const [items, setItems] = useState<PublicListing[] | null>(() => {
    const cached = readFeedCache(CACHE_KEY);
    if (!cached) return null;
    const premium = cached.filter((l) => promotion(l) === 'premium');
    const sponsored = cached.filter((l) => promotion(l) === 'sponsored');
    const shown = [...shuffled(premium), ...shuffled(sponsored)];
    return shown.length ? shown : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadBanner()
      .then((fresh) => {
        if (cancelled) return;
        writeFeedCache(CACHE_KEY, fresh);
        setItems((shown) => (shown ? keepOrder(shown, fresh) : fresh));
      })
      .catch((e: unknown) => {
        reportError(e, 'banner');
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Rail items={items} failed={failed} />;
}

function Rail({ items, failed }: { items: PublicListing[] | null; failed: boolean }) {
  const list = items ?? [];
  const railRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLUListElement>(null);
  /** Pause end, kept when the plates change (cached rail → fresh rail): a touch is not forgotten. */
  const idle = useRef(0);
  const loop = list.length >= MIN_TO_LOOP;

  useEffect(() => {
    const rail = railRef.current;
    const reel = reelRef.current;
    if (!rail || !reel || !loop) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last: number | null = null;
    // Fractional position: one frame moves less than a pixel, which scrollLeft alone would drop.
    let pos = rail.scrollLeft;
    let drag: { x: number; scroll: number; moved: number; id: number } | null = null;
    let suppressClick = false;

    const half = () => reel.scrollWidth / 2;
    // Depth: the plate at the centre comes forward (scale up), the others shrink and dim.
    const slots = [...reel.querySelectorAll<HTMLElement>('.plate-slot')];
    const centres = slots.map((s) => s.offsetLeft + s.offsetWidth / 2);
    const depth = () => {
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      const reach = rail.clientWidth / 2 + 60;
      for (let i = 0; i < slots.length; i++) {
        const t = Math.min(Math.abs((centres[i] ?? 0) - mid) / reach, 1);
        const slot = slots[i] as HTMLElement;
        slot.style.transform = `scale(${(1.05 - 0.13 * t).toFixed(3)})`;
        slot.style.opacity = (1 - 0.35 * t).toFixed(3);
      }
    };
    let tick = 0;
    const step = (ts: number) => {
      const dt = last === null ? 0 : (ts - last) / 1000;
      last = ts;
      const h = half();
      if (!drag && ts > idle.current && !document.hidden && h > rail.clientWidth) {
        pos += SPEED * dt;
        if (pos >= h) pos -= h;
        rail.scrollLeft = pos;
      } else {
        pos = rail.scrollLeft;
        // Scrolled by hand past the first copy: back by one copy, nothing moves on screen.
        if (h > 0 && pos >= h) {
          pos -= h;
          rail.scrollLeft = pos;
        }
      }
      // Depth every 3rd frame (~20 fps): smooth enough, a third of the main-thread work.
      if (++tick % 3 === 0) depth();
      frame = requestAnimationFrame(step);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      last = null;
      if (!reduce.matches) frame = requestAnimationFrame(step);
    };
    const stop = () => cancelAnimationFrame(frame);
    const hold = () => {
      idle.current = Infinity;
    };
    const release = () => {
      idle.current = performance.now() + RESUME_MS;
    };

    // Mouse: drag in both directions (fingers use the native scroll).
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      drag = { x: e.clientX, scroll: rail.scrollLeft, moved: 0, id: e.pointerId };
      suppressClick = false;
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = e.clientX - drag.x;
      drag.moved = Math.max(drag.moved, Math.abs(d));
      if (drag.moved > DRAG_PX) {
        if (!rail.hasPointerCapture(e.pointerId)) rail.setPointerCapture(e.pointerId);
        rail.classList.add('rail--dragging');
      }
      rail.scrollLeft = drag.scroll - d;
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      suppressClick = drag.moved > DRAG_PX;
      drag = null;
      rail.classList.remove('rail--dragging');
      if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId);
      release();
    };
    const click = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault();
        suppressClick = false;
      }
    };

    const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [rail, 'pointerdown', down as EventListener],
      [rail, 'pointermove', move as EventListener],
      [rail, 'pointerup', up as EventListener],
      [rail, 'pointercancel', up as EventListener],
      [rail, 'click', click as EventListener, { capture: true }],
      [rail, 'touchstart', hold, { passive: true }],
      [rail, 'touchend', release, { passive: true }],
      [rail, 'touchcancel', release, { passive: true }],
      [rail, 'wheel', release, { passive: true }],
      [rail, 'mouseenter', hold],
      [rail, 'mouseleave', release],
      [rail, 'focusin', hold],
      [rail, 'focusout', release],
      [reduce, 'change', start],
    ];
    for (const [t, type, fn, opts] of listeners) t.addEventListener(type, fn, opts);
    start();
    return () => {
      stop();
      for (const [t, type, fn, opts] of listeners) t.removeEventListener(type, fn, opts);
    };
  }, [loop, list.length]);

  // A failed read with nothing cached: the honest invitation rather than a broken block.
  const state = items === null ? (failed ? 'empty' : 'loading') : items.length ? 'ready' : 'empty';
  const premium = list.filter((l) => promotion(l) === 'premium').length;
  return (
    <section class="rail-block" aria-label={fr.banner.label} aria-busy={state === 'loading'}>
      <div class="eyebrow">
        <h2 class="eyebrow__title">{fr.banner.title}</h2>
        <span class="eyebrow__rule" aria-hidden="true" />
        <span class="eyebrow__count">
          {state === 'ready' && fr.banner.count(premium, list.length - premium)}
        </span>
      </div>
      <div class="rail" ref={railRef}>
        {state === 'loading' && <Placeholders />}
        {state === 'empty' && <Invitation />}
        {state === 'ready' && (
          <ul class="reel" ref={reelRef}>
            {list.map((l, i) => (
              <Plate key={l.id} l={l} copy={false} eager={i < EAGER} />
            ))}
            {/* Second copy for a seamless loop; skipped by screen readers and the keyboard. */}
            {loop && list.map((l) => <Plate key={`copy-${l.id}`} l={l} copy eager={false} />)}
          </ul>
        )}
      </div>
    </section>
  );
}
