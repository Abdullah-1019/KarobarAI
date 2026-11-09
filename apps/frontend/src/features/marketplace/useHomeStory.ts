import { useEffect, type RefObject } from 'react';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Rect { x: number; y: number; w: number; h: number }
const mix = (a: Rect, b: Rect, t: number): Rect => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

interface Scene {
  card: HTMLElement;
  top: number; // where the card sticks
  start: number; // the scroll position at which it sticks
  left: number;
  height: number;
  hold: number; // how long it rests before the next card comes
  reveals: { el: HTMLElement; at: number }[];
}

/** Left and top of an element relative to `root`, ignoring transforms (they are layout offsets). */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

const ROUTE_CHIP = 84;

interface StoryOptions { image: string | null; isUr: boolean; compact: boolean }

// Runs the home page's scroll story. From the layout it works out where each card rests and where
// each photo slot sits while its card is pinned, then every frame places the one travelling photo
// along that path, plays each card's reveals, and draws the two brand circles in all their layers.
// Scroll position alone drives the story, so it always runs the same both ways. The photo journey
// is desktop-only; phones and reduced motion keep the photo in place in each card.
export function useHomeStory(rootRef: RefObject<HTMLDivElement | null>, { image, isUr, compact }: StoryOptions) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
    const all = <T extends HTMLElement>(selector: string, from: ParentNode = root) => Array.from(from.querySelectorAll<T>(selector));

    const hero = q('.hero--night');
    const track = q('.st-hero-track');
    const cards = all('.st-card');
    const markers = all('.st-marker');
    const rest = q('.st-rest');
    const closeSlot = q('[data-slot="close"]');
    if (!hero || !track || cards.length !== 4 || markers.length !== 4 || !rest || !closeSlot) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const actor = q('.st-actor');
    const story = !!(actor && image && !compact && !reduce.matches);
    root.toggleAttribute('data-journey', story);

    const heroCopy = q('.hero__inner');
    const heroDim = q('.hero-dim');
    const found = q('.hero-found');
    const wall = q('.nw-wall');
    const bar = q('.st-bar');
    const barItems = bar ? all('li', bar) : [];
    const tlItems = all('.st-tl li');
    const notices = all('.st-notice__item');
    const routeBase = root.querySelector<SVGPathElement>('.st-route-base');
    const routeDone = root.querySelector<SVGPathElement>('.st-route-done');
    const map = q('.st-map-box');
    const svg = root.querySelector<SVGSVGElement>('.st-map');
    const payBar = q('.st-paybar');
    const retCard = cards[3]!;
    const phone = q('.st-phone');
    const flash = q('.st-flash');

    const routeLength = routeBase?.getTotalLength() ?? 0;
    if (routeDone) routeDone.style.strokeDasharray = `${routeLength} ${routeLength}`;

    // ── measuring ──
    let scenes: Scene[] = [];
    let pinLength = 0;
    let front: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let slots: { ask: Rect; pay: Rect; ret: Rect } | null = null;
    let mapRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let close = { x: 0, docY: 0, w: 0, h: 0 };
    let closeAt = 0;
    let sourceTile: HTMLElement | null = null;

    const measure = () => {
      const scrollY = window.scrollY;
      scenes = cards.map((card, index) => {
        const style = getComputedStyle(card);
        const marker = markers[index]!.getBoundingClientRect();
        const top = parseFloat(style.top) || 0;
        return {
          card,
          top,
          start: marker.top + scrollY - top,
          left: marker.left,
          height: card.offsetHeight,
          hold: parseFloat(style.marginBottom) || 0,
          reveals: all('[data-at]', card).map((el) => ({ el, at: Number(el.dataset.at) })),
        };
      });
      scenes[3]!.hold = rest.offsetHeight;
      const heroH = hero.offsetHeight;
      pinLength = Math.max(1, track.offsetHeight - heroH);
      const frontH = Math.min(window.innerHeight * 0.56, 460);
      const frontW = frontH * 1.03;
      front = { x: window.innerWidth / 2 - frontW / 2, y: heroH / 2 - frontH / 2 - 34, w: frontW, h: frontH };

      const slotRect = (index: number, name: string): Rect => {
        const el = cards[index]!.querySelector<HTMLElement>(`[data-slot="${name}"]`);
        if (!el) return front;
        const offset = offsetIn(el, cards[index]!);
        return { x: scenes[index]!.left + offset.x, y: scenes[index]!.top + offset.y, w: el.offsetWidth, h: el.offsetHeight };
      };
      slots = { ask: slotRect(0, 'ask'), pay: slotRect(1, 'pay'), ret: slotRect(3, 'ret') };
      if (map) {
        const offset = offsetIn(map, cards[2]!);
        mapRect = { x: scenes[2]!.left + offset.x, y: scenes[2]!.top + offset.y, w: map.offsetWidth, h: map.offsetHeight };
      }
      const closeBox = closeSlot.getBoundingClientRect();
      close = { x: closeBox.left, docY: closeBox.top + scrollY, w: closeSlot.offsetWidth, h: closeSlot.offsetHeight };
      closeAt = Math.min(close.docY - (window.innerHeight - close.h) / 2, document.documentElement.scrollHeight - window.innerHeight);
    };

    /** The point on the road, in screen space. */
    const routeRect = (fraction: number, size: number): Rect => {
      if (!routeBase || !svg) return front;
      const box = svg.viewBox.baseVal;
      const k = Math.max(mapRect.w / box.width, mapRect.h / box.height);
      const ox = (mapRect.w - box.width * k) / 2;
      const oy = (mapRect.h - box.height * k) / 2;
      const point = routeBase.getPointAtLength(routeLength * fraction);
      return { x: mapRect.x + ox + point.x * k - size / 2, y: mapRect.y + oy + point.y * k - size / 2, w: size, h: size };
    };

    const findTile = () => {
      const centre = window.innerWidth / 2;
      let best: HTMLElement | null = null;
      let distance = Infinity;
      all<HTMLImageElement>('.nw-tile img').forEach((img) => {
        if (img.getAttribute('src') !== image) return;
        const tile = img.parentElement as HTMLElement;
        const box = tile.getBoundingClientRect();
        if (box.right < 0 || box.left > window.innerWidth) return;
        const d = Math.abs(box.left + box.width / 2 - centre);
        if (d < distance) { distance = d; best = tile; }
      });
      return best;
    };

    // ── the travelling photo ──
    const placeActor = (y: number) => {
      if (!actor || !slots) return;
      const S = scenes;
      const toFront = pinLength * 0.42;
      const leave = pinLength * 0.72;
      const askEnd = S[0]!.start + S[0]!.hold;
      const payEnd = S[1]!.start + S[1]!.hold;
      const trackEnd = S[2]!.start + S[2]!.hold;
      const retEnd = S[3]!.start + S[3]!.hold;
      let rect: Rect;
      let radius = 18;
      let opacity = 1;

      if (y < toFront) {
        if (y < 2) sourceTile = null;
        if (!sourceTile) sourceTile = findTile();
        const box = sourceTile?.getBoundingClientRect();
        const t = easeInOut(clamp(y / toFront));
        rect = mix(box ? { x: box.left, y: box.top, w: box.width, h: box.height } : front, front, t);
        opacity = clamp(y / (pinLength * 0.05));
        radius = lerp(16, 26, t);
      } else if (y < leave) {
        rect = front;
        radius = 26;
      } else if (y < S[0]!.start) {
        const t = clamp((y - leave) / (S[0]!.start - leave));
        rect = mix(front, slots.ask, easeInOut(t));
        radius = lerp(26, 16, t);
      } else if (y < askEnd) {
        rect = slots.ask;
      } else if (y < S[1]!.start) {
        rect = mix(slots.ask, slots.pay, easeInOut(clamp((y - askEnd) / (S[1]!.start - askEnd))));
      } else if (y < payEnd) {
        rect = slots.pay;
      } else if (y < S[2]!.start) {
        const t = easeInOut(clamp((y - payEnd) / (S[2]!.start - payEnd)));
        rect = mix(slots.pay, routeRect(0, ROUTE_CHIP), t);
        radius = lerp(18, 22, t);
      } else if (y < trackEnd) {
        rect = routeRect(clamp((y - S[2]!.start) / S[2]!.hold), ROUTE_CHIP);
        radius = 22;
      } else if (y < S[3]!.start) {
        const t = easeInOut(clamp((y - trackEnd) / (S[3]!.start - trackEnd)));
        rect = mix(routeRect(1, ROUTE_CHIP), slots.ret, t);
        radius = lerp(22, 18, t);
      } else if (y < retEnd) {
        rect = slots.ret;
      } else {
        const over = y - retEnd;
        const from = { ...slots.ret, y: slots.ret.y - over };
        const to = { x: close.x, y: close.docY - y, w: close.w, h: close.h };
        const t = easeInOut(clamp(over / Math.max(1, closeAt - retEnd)));
        rect = mix(from, to, t);
        radius = lerp(18, 26, t);
      }

      const docked = (y >= S[0]!.start && y < askEnd) || (y >= S[1]!.start && y < payEnd) || (y >= S[3]!.start && y < retEnd);
      const riding = y >= S[2]!.start && y < trackEnd;
      actor.toggleAttribute('data-docked', docked || riding);
      actor.toggleAttribute('data-riding', riding);
      actor.style.width = `${rect.w.toFixed(1)}px`;
      actor.style.height = `${rect.h.toFixed(1)}px`;
      actor.style.transform = `translate3d(${rect.x.toFixed(1)}px, ${rect.y.toFixed(1)}px, 0)`;
      actor.style.borderRadius = `${radius.toFixed(1)}px`;
      actor.style.opacity = opacity.toFixed(3);
      actor.style.visibility = rect.y + rect.h < -40 ? 'hidden' : 'visible';
    };

    // ── the hero while it holds still ──
    const placeHero = (y: number) => {
      const p = clamp(y / pinLength);
      if (heroCopy) {
        heroCopy.style.opacity = (1 - clamp(p / 0.26)).toFixed(3);
        heroCopy.style.translate = `0 ${(-p * 90).toFixed(1)}px`;
      }
      if (heroDim) heroDim.style.opacity = clamp(p / 0.4).toFixed(3);
      if (wall) wall.style.transform = `scale(${(1 - clamp(p / 0.6) * 0.07).toFixed(4)})`;
      if (found) {
        const inn = clamp((p - 0.36) / 0.14);
        found.style.opacity = (inn * (1 - clamp((p - 0.74) / 0.14))).toFixed(3);
        found.style.translate = `0 ${((1 - inn) * 20).toFixed(1)}px`;
      }
    };

    // ── the cards ──
    let stage = -1;
    let flashed = false;
    const playCards = (y: number) => {
      scenes.forEach((scene, index) => {
        const run = scene.height * 0.55;
        const progress = clamp((y - (scene.start - run)) / (run + scene.hold));
        scene.card.classList.toggle('is-in', y > scene.start - scene.height * 0.62);
        scene.reveals.forEach(({ el, at }) => el.classList.toggle('on', progress >= at));
        scene.card.style.setProperty('--e', clamp((scene.start - y) / scene.height).toFixed(3));
        const next = scenes[index + 1];
        if (next) {
          scene.card.style.setProperty('--p', clamp(1 - (next.start - y) / next.height).toFixed(3));
          // once the next card has fully landed this one is gone, so no old edges or text show
          const gone = clamp((y - next.start - 10) / 90);
          scene.card.style.opacity = (1 - gone).toFixed(3);
          scene.card.style.visibility = gone >= 1 ? 'hidden' : 'visible';
        }
      });

      let active = -1;
      scenes.forEach((scene, index) => { if (y >= scene.start - scene.height * 0.5) active = index; });
      barItems.forEach((item, index) => item.classList.toggle('on', index === active));
      const last = scenes[3]!;
      bar?.classList.toggle('show', y >= scenes[0]!.start - scenes[0]!.height * 0.5 && y < last.start + last.hold);

      // tracking
      const t3 = scenes[2]!;
      const f = clamp((y - t3.start) / t3.hold);
      if (routeDone) routeDone.style.strokeDashoffset = String(routeLength * (1 - f));
      const nextStage = f >= 0.98 ? 3 : f >= 0.62 ? 2 : f >= 0.3 ? 1 : 0;
      if (nextStage !== stage) {
        stage = nextStage;
        tlItems.forEach((item, index) => item.classList.toggle('on', index <= stage));
        notices.forEach((item, index) => item.classList.toggle('is-now', index === stage));
      }

      // cash
      const t2 = scenes[1]!;
      payBar?.classList.toggle('is-paid', y > t2.start + t2.hold * 0.72);

      // return
      const t4 = scenes[3]!;
      const g4 = clamp((y - (t4.start - t4.height * 0.3)) / (t4.height * 0.3 + t4.hold));
      if (g4 > 0.22 && !flashed) {
        flashed = true;
        if (flash) {
          flash.classList.remove('go');
          void flash.offsetWidth;
          flash.classList.add('go');
        }
      }
      if (g4 < 0.18) flashed = false;
      phone?.classList.toggle('is-scan', g4 > 0.3 && g4 < 0.72);
      const match = easeInOut(clamp((g4 - 0.5) / 0.4));
      retCard.style.setProperty('--g', (match * 0.86).toFixed(3));
      retCard.classList.toggle('is-matched', match >= 0.99);
    };

    // ── the same two circles, in the hero, on the page and in every card ──
    const circles = [
      { baseX: 0.62, baseY: 0.36, reach: 0.4, lag: 3.2, x: 0, y: 0 },
      { baseX: 0.36, baseY: 0.52, reach: 0.28, lag: 1.9, x: 0, y: 0 },
    ];
    circles.forEach((circle) => {
      circle.x = circle.baseX * window.innerWidth;
      circle.y = circle.baseY * window.innerHeight;
    });
    const heroGlows = all('.hero__blob[data-glow]', hero).sort((a, b) => Number(a.dataset.glow) - Number(b.dataset.glow));
    const pageGlows = all('.st-page-glows [data-glow]');
    const cardGlows = cards.map((card) => all('[data-glow]', card));
    let pointerX = 0;
    let pointerY = 0;
    const onPointer = (event: PointerEvent) => {
      pointerX = event.clientX - window.innerWidth / 2;
      pointerY = event.clientY - window.innerHeight / 2;
    };
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce.matches;
    if (fine) window.addEventListener('pointermove', onPointer, { passive: true });

    const drawGlows = (now: number, dt: number) => {
      circles.forEach((circle, index) => {
        const k = 1 - Math.exp(-circle.lag * dt);
        const driftX = reduce.matches ? 0 : Math.sin(now / (3200 + index * 900) + index) * 34;
        const driftY = reduce.matches ? 0 : Math.cos(now / (3800 + index * 700)) * 26;
        circle.x += (circle.baseX * window.innerWidth + pointerX * circle.reach + driftX - circle.x) * k;
        circle.y += (circle.baseY * window.innerHeight + pointerY * circle.reach + driftY - circle.y) * k;
        const move = `translate3d(${circle.x.toFixed(1)}px, ${circle.y.toFixed(1)}px, 0)`;
        if (heroGlows[index]) heroGlows[index]!.style.transform = move;
        if (pageGlows[index]) pageGlows[index]!.style.transform = move;
        cardGlows.forEach((set, cardIndex) => {
          const box = cards[cardIndex]!.getBoundingClientRect();
          if (box.bottom < -200 || box.top > window.innerHeight + 200 || !set[index]) return;
          set[index]!.style.transform = `translate3d(${(circle.x - box.left).toFixed(1)}px, ${(circle.y - box.top).toFixed(1)}px, 0)`;
        });
      });
    };

    let frame = 0;
    let previous: number | null = null;
    const loop = (now: number) => {
      const dt = previous === null ? 1 / 60 : Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const y = window.scrollY;
      if (scenes.length) {
        playCards(y);
        if (story) {
          placeHero(y);
          placeActor(y);
        }
      }
      drawGlows(now, dt);
      frame = requestAnimationFrame(loop);
    };

    let measureFrame = 0;
    const scheduleMeasure = () => {
      if (!measureFrame) {
        measureFrame = requestAnimationFrame(() => {
          measureFrame = 0;
          measure();
        });
      }
    };
    measure();
    frame = requestAnimationFrame(loop);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('load', scheduleMeasure);
    document.fonts?.ready.then(scheduleMeasure).catch(() => undefined);
    // anything above or inside the story changing size moves every resting point
    const observer = 'ResizeObserver' in window ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(root);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measureFrame);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('load', scheduleMeasure);
      window.removeEventListener('pointermove', onPointer);
      observer?.disconnect();
      root.removeAttribute('data-journey');
      if (heroCopy) { heroCopy.style.opacity = ''; heroCopy.style.translate = ''; }
      if (heroDim) heroDim.style.opacity = '';
      if (wall) wall.style.transform = '';
      if (found) { found.style.opacity = ''; found.style.translate = ''; }
    };
  }, [rootRef, image, isUr, compact]);
}

/** True when the wheel should be left alone: an open overlay, or an inner area that can scroll. */
function wheelBelongsElsewhere(target: EventTarget | null): boolean {
  if (document.body.style.overflow === 'hidden') return true;
  let node = target as Element | null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.matches('.ant-drawer, .ant-modal, .ant-dropdown, .ant-select-dropdown, .ant-popover')) return true;
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** Eases wheel scrolling on the home page. Mouse wheels only reach here on larger screens; touch
 *  keeps the native scroll. The keyboard, scrollbar and links scroll as usual and are picked up. */
export function useSmoothWheel(enabled: boolean) {
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let target = window.scrollY;
    let current = target;
    let running = false;
    let frame = 0;
    let previous = 0;

    const step = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
      previous = now;
      current += (target - current) * (1 - Math.exp(-9 * dt));
      if (Math.abs(target - current) < 0.5) {
        current = target;
        running = false;
        previous = 0;
      }
      window.scrollTo({ top: current, behavior: 'instant' });
      if (running) frame = requestAnimationFrame(step);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (wheelBelongsElsewhere(event.target)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? window.innerHeight : 1;
      if (!running) {
        target = window.scrollY;
        current = target;
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = clamp(target + event.deltaY * unit, 0, max);
      if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
    };
  }, [enabled]);
}
