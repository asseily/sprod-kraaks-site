import { animate, scroll } from "motion";

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const isReduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!isReduced) {
  ready(boot);
}

function ready(fn: () => void) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function boot() {
  // Foundation
  splitDisplayHeadings();
  tagAnimationTargets();

  // Stunning layer
  buildScrollProgress();
  setupClipReveals();
  setupCounters();
  setupMarquees();
  setupSpotlight();
  attachMagneticHover();

  // Reveal orchestration
  scheduleReveal();
  attachScrollObservers();

  // Hover + parallax (existing)
  attachHoverLifts();
  attachHeroParallax();
}

// ─────────────────────────────────────────────────────────────────────────────
// Char split for premium editorial reveal
// ─────────────────────────────────────────────────────────────────────────────
function splitDisplayHeadings() {
  const selectors = [
    "h1.font-display-lg",
    "h2.font-display-md",
    "h2.font-display-lg",
    "h1.font-display-md",
    "h1.font-headline",
    "h2.font-headline",
  ];
  document.querySelectorAll<HTMLElement>(selectors.join(",")).forEach((h) => {
    if (h.dataset.motionSplit === "true") return;
    if (h.querySelector("input,button,form")) return;

    // Decide char-split vs word-split based on size class
    const useChars =
      h.classList.contains("font-display-lg") ||
      h.classList.contains("text-display-xl") ||
      h.classList.contains("text-display-lg");

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        const tokens = text.split(/(\s+)/);
        for (const tok of tokens) {
          if (!tok) continue;
          if (/^\s+$/.test(tok)) {
            frag.appendChild(document.createTextNode(tok));
          } else if (useChars) {
            // Wrap each character in a span, group inside a word wrapper so
            // wrapping breaks happen between whole words.
            const wordWrap = document.createElement("span");
            wordWrap.className = "m-word-wrap";
            wordWrap.style.display = "inline-block";
            wordWrap.style.whiteSpace = "nowrap";
            for (const ch of Array.from(tok)) {
              const charSpan = document.createElement("span");
              charSpan.className = "m-char";
              charSpan.textContent = ch;
              wordWrap.appendChild(charSpan);
            }
            frag.appendChild(wordWrap);
          } else {
            const span = document.createElement("span");
            span.className = "m-word";
            span.textContent = tok;
            frag.appendChild(span);
          }
        }
        node.parentNode?.replaceChild(frag, node);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        if ((node as Element).tagName === "BR") return;
        Array.from(node.childNodes).forEach(walk);
      }
    };
    Array.from(h.childNodes).forEach(walk);
    h.dataset.motionSplit = "true";
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Target tagging
// ─────────────────────────────────────────────────────────────────────────────
function tagAnimationTargets() {
  document
    .querySelectorAll<HTMLElement>("main > section, main main > section")
    .forEach((s) => s.classList.add("m-section"));

  document
    .querySelectorAll<HTMLElement>(
      "h1.font-display-lg, h1.font-display-md, h2.font-display-lg, h2.font-display-md, h1.font-headline, h2.font-headline"
    )
    .forEach((h) => h.classList.add("m-headline"));

  const gridSelectors = [
    ".grid.grid-cols-2",
    ".grid.grid-cols-3",
    ".grid.grid-cols-4",
    ".grid.md\\:grid-cols-2",
    ".grid.md\\:grid-cols-3",
    ".grid.md\\:grid-cols-4",
    ".grid.sm\\:grid-cols-2",
    ".flex.divide-y",
    ".flex.md\\:divide-x",
  ];
  document
    .querySelectorAll<HTMLElement>(gridSelectors.join(","))
    .forEach((group) => {
      const items = Array.from(group.children).filter(
        (c) => c instanceof HTMLElement
      ) as HTMLElement[];
      if (items.length < 2) return;
      group.classList.add("m-stagger");
      items.forEach((item, i) => {
        item.classList.add("m-stagger-item");
        item.style.transitionDelay = `${0.1 + i * 0.08}s`;
      });
    });

  document
    .querySelectorAll<HTMLElement>(
      ".hairline-b, .hairline-l, .hairline-t, .hairline-r"
    )
    .forEach((el) => el.classList.add("m-hairline"));

  // Tag large content imagery for clip-path reveal.
  // We look for images that either sit inside an aspect-ratio wrapper, OR
  // carry an aspect-ratio class themselves (the pattern used in story.astro).
  const candidateImgs = document.querySelectorAll<HTMLImageElement>("main img");
  candidateImgs.forEach((img) => {
    if (img.closest("header")) return;
    const parent = img.parentElement;
    if (!parent) return;
    if (parent.classList.contains("m-clip-wrap")) return;

    const cls = img.className;
    const parentCls = parent.className;
    const hasAspect =
      /aspect-\[/.test(cls) ||
      /aspect-square/.test(cls) ||
      /aspect-\[/.test(parentCls) ||
      /aspect-square/.test(parentCls);
    const isAbsoluteCover =
      img.classList.contains("absolute") &&
      /overflow-hidden/.test(parentCls);

    if (!hasAspect && !isAbsoluteCover) return;
    if (img.getBoundingClientRect().width < 80) return;

    img.classList.add("m-clip-image");
    parent.classList.add("m-clip-wrap");
  });

  // Stockist row is explicitly tagged via [data-marquee="stockists"] in the
  // component. setupMarquees() will pick it up automatically.

  // Tag the main CTA on the hero & "Read the full story" — magnetic
  document
    .querySelectorAll<HTMLElement>(
      "a.inline-flex.items-center, a.inline-block.bg-espresso"
    )
    .forEach((el) => el.classList.add("m-magnetic"));

  // Hero zone — gets cursor spotlight
  const heroSection = document.querySelector<HTMLElement>(
    "main > section:first-of-type"
  );
  if (heroSection) heroSection.classList.add("m-spotlight");
}

// ─────────────────────────────────────────────────────────────────────────────
// Visibility helpers
// ─────────────────────────────────────────────────────────────────────────────
function isInView(el: HTMLElement, marginPx = 40): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return rect.top < vh - marginPx && rect.bottom > marginPx;
}

function reveal(el: HTMLElement, instant = false) {
  if (el.classList.contains("m-revealed")) return;
  if (instant) {
    const all: HTMLElement[] = [el];
    el.querySelectorAll<HTMLElement>(
      ".m-word, .m-char, .m-word-wrap, .m-stagger-item, .m-headline, .m-section, .m-hairline, .m-clip-wrap"
    ).forEach((d) => all.push(d));
    all.forEach((d) => {
      d.style.transition = "none";
      d.classList.add("m-revealed");
    });
    void el.offsetHeight;
    requestAnimationFrame(() => {
      all.forEach((d) => (d.style.transition = ""));
    });
  } else {
    el.classList.add("m-revealed");
    // Cascade reveal to any clip wrappers inside the revealing element
    el.querySelectorAll<HTMLElement>(".m-clip-wrap:not(.m-revealed)").forEach(
      (w) => w.classList.add("m-revealed")
    );
  }
}

function scheduleReveal() {
  const targets = document.querySelectorAll<HTMLElement>(
    ".m-section, .m-headline, .m-stagger, .m-hairline, .m-clip-wrap"
  );
  targets.forEach((el) => {
    if (isInView(el)) reveal(el, true);
  });
}

function attachScrollObservers() {
  const targetSelector =
    ".m-section, .m-headline, .m-stagger, .m-hairline, .m-clip-wrap";

  let observer: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            observer?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
    );
    document.querySelectorAll<HTMLElement>(targetSelector).forEach((el) => {
      if (!el.classList.contains("m-revealed")) observer!.observe(el);
    });
  }

  let ticking = false;
  const sweep = () => {
    ticking = false;
    document.querySelectorAll<HTMLElement>(targetSelector).forEach((el) => {
      if (!el.classList.contains("m-revealed") && isInView(el)) {
        reveal(el);
        observer?.unobserve(el);
      }
    });
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sweep);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scroll-progress copper line at the top of the viewport
// ─────────────────────────────────────────────────────────────────────────────
function buildScrollProgress() {
  if (document.querySelector(".m-scroll-progress")) return;
  const bar = document.createElement("div");
  bar.className = "m-scroll-progress";
  document.body.appendChild(bar);
  scroll((progress: number) => {
    bar.style.transform = `scaleX(${progress})`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Animated number counters for the 01/02/03 stat band
// ─────────────────────────────────────────────────────────────────────────────
function setupCounters() {
  const counters = document.querySelectorAll<HTMLElement>(
    "section .font-display-lg.italic, section .font-display-lg"
  );
  counters.forEach((el) => {
    const raw = (el.textContent ?? "").trim();
    // Only animate elements that contain a small number (1-99). Stat-band "01" etc.
    if (!/^0?\d{1,2}$/.test(raw)) return;
    const target = parseInt(raw, 10);
    if (Number.isNaN(target)) return;
    const padded = raw.length;
    el.dataset.counterTarget = String(target);
    el.dataset.counterPad = String(padded);
    el.classList.add("m-counter");
    el.textContent = String(0).padStart(padded, "0");
  });
}

function runCounter(el: HTMLElement) {
  if (el.dataset.counterFired === "true") return;
  el.dataset.counterFired = "true";
  const target = parseInt(el.dataset.counterTarget ?? "0", 10);
  const pad = parseInt(el.dataset.counterPad ?? "2", 10);
  const duration = 1200; // ms
  const start = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const v = Math.round(ease(t) * target);
    el.textContent = String(v).padStart(pad, "0");
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Clip-path curtain reveal for full-width imagery
//    (handled via CSS — JS just toggles .m-revealed on the wrapper)
// ─────────────────────────────────────────────────────────────────────────────
function setupClipReveals() {
  // CSS handles the actual clip-path animation when .m-revealed is added.
  // We just need to make sure m-clip-wrap is observable (already in target list).
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Slow horizontal marquee for stockists row
// ─────────────────────────────────────────────────────────────────────────────
function setupMarquees() {
  document
    .querySelectorAll<HTMLElement>("[data-marquee='stockists']")
    .forEach((row) => {
      // Wrap in a track that duplicates content for seamless loop
      const items = Array.from(row.children);
      if (items.length < 2) return;
      const wrap = document.createElement("div");
      wrap.className = "m-marquee";
      const track = document.createElement("div");
      track.className = "m-marquee-track";
      // Move existing items into the track
      items.forEach((c) => track.appendChild(c));
      // Duplicate them once for the seamless loop
      track.querySelectorAll(":scope > *").forEach((c) => {
        const clone = c.cloneNode(true) as HTMLElement;
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
      wrap.appendChild(track);
      row.appendChild(wrap);
      row.classList.add("m-marquee-host");

      // Animate via CSS — duration scaled to track width
      requestAnimationFrame(() => {
        const trackWidth = track.scrollWidth / 2;
        const speedPxPerSec = 28; // gentle drift
        const duration = trackWidth / speedPxPerSec;
        track.style.setProperty("--m-marquee-duration", `${duration}s`);
      });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cursor-aware copper spotlight on the hero
// ─────────────────────────────────────────────────────────────────────────────
function setupSpotlight() {
  const hero = document.querySelector<HTMLElement>(".m-spotlight");
  if (!hero) return;
  // Skip on touch devices — no cursor to follow
  if (matchMedia("(pointer: coarse)").matches) return;

  hero.style.setProperty("--spot-x", "50%");
  hero.style.setProperty("--spot-y", "50%");
  hero.style.setProperty("--spot-opacity", "0");

  hero.addEventListener("pointermove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty("--spot-x", `${x}%`);
    hero.style.setProperty("--spot-y", `${y}%`);
    hero.style.setProperty("--spot-opacity", "1");
  });
  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--spot-opacity", "0");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Magnetic hover on primary CTAs
// ─────────────────────────────────────────────────────────────────────────────
function attachMagneticHover() {
  if (matchMedia("(pointer: coarse)").matches) return;
  const magnets = document.querySelectorAll<HTMLElement>(".m-magnetic");
  magnets.forEach((el) => {
    const strength = 0.25;
    const maxOffset = 10;
    el.style.display = el.style.display || "inline-flex";
    el.style.willChange = "transform";

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      const clampedX = Math.max(-maxOffset, Math.min(maxOffset, dx));
      const clampedY = Math.max(-maxOffset, Math.min(maxOffset, dy));
      animate(
        el,
        { x: clampedX, y: clampedY },
        { duration: 0.4, ease: EASE }
      );
    };
    const onLeave = () => {
      animate(el, { x: 0, y: 0 }, { duration: 0.6, ease: EASE });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Existing: hover lifts + hero parallax (refined)
// ─────────────────────────────────────────────────────────────────────────────
function attachHoverLifts() {
  const cards = document.querySelectorAll<HTMLElement>(
    "a.group, .group.cursor-pointer"
  );
  cards.forEach((card) => {
    const img = card.querySelector<HTMLElement>("img");
    if (!img) return;
    const enter = () =>
      animate(img, { scale: 1.04 }, { duration: 0.6, ease: EASE });
    const leave = () =>
      animate(img, { scale: 1 }, { duration: 0.7, ease: EASE });
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focusin", enter);
    card.addEventListener("focusout", leave);
  });
}

function attachHeroParallax() {
  const heroImgs = document.querySelectorAll<HTMLImageElement>(
    "main > section:first-of-type img.absolute"
  );
  heroImgs.forEach((img) => {
    const parent = img.parentElement;
    if (!parent) return;
    try {
      scroll(
        animate(img, { transform: ["scale(1.04)", "scale(1.12) translateY(-4%)"] }),
        { target: parent, offset: ["start end", "end start"] }
      );
    } catch {
      // skip silently
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter trigger — fire as the band scrolls into view
// ─────────────────────────────────────────────────────────────────────────────
{
  if (!isReduced) {
    ready(() => {
      const counters = document.querySelectorAll<HTMLElement>(".m-counter");
      if (!counters.length) return;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              runCounter(e.target as HTMLElement);
              obs.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.01 }
      );
      counters.forEach((c) => obs.observe(c));
      // Fallback: fire any already in view
      counters.forEach((c) => {
        if (isInView(c)) runCounter(c);
      });
    });
  }
}
