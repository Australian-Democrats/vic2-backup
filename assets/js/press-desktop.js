/* press-desktop.js — the cinematic homepage's DESKTOP MOTION LAYER.
 * ===========================================================================
 * Imported by press-boot.js, dynamically, and ONLY when all three of these are
 * true at the same time:
 *
 *   1 · the viewport is ≥1024px      (the one breakpoint, adjudication C4)
 *   2 · prefers-reduced-motion is NOT `reduce`   (adjudication B4 / 02 §6)
 *   3 · html.js-motion is set        (effects.js, repo deviation #9)
 *
 * so this file never reaches a phone, never reaches a visitor who has asked
 * for less motion, and never reaches a browser with JavaScript off. There is
 * no fourth condition and no override flag.
 *
 * THE ONE PROPERTY THAT MATTERS MOST. Everything here is a LAYER ON TOP of a
 * page that is already finished. Stage 4 shipped a complete static editorial
 * document; the reduced-motion page is that document, unchanged, byte for
 * byte. Nothing below is required for the homepage to be correct, readable or
 * beautiful — which is why the reduced-motion state is not a fallback, it is
 * the same design standing still (01 §8).
 *
 * That principle has a concrete engineering consequence, and it is worth
 * stating because it shaped every choice in this file: NOTHING IS HIDDEN
 * HARDER THAN IT HAS TO BE. The scroll-linked arrivals bottom out at 82%
 * opacity, never 0. The one tween that would have hidden an act outright is
 * built with `immediateRender: false` so its hidden state exists only while the
 * reader is inside the transition. And the hero — the one place content is
 * briefly invisible — has three independent ways out: the skip control, any
 * scroll, any key. Every builder below runs inside its own guard, so a failure
 * in one costs that one thing and not the page.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A SECOND FILE NEXT TO THIS ONE
 * ---------------------------------------------------------------------------
 * `./press-vendor.js` is a GENERATED bundle of GSAP 3 (core + ScrollTrigger +
 * CustomEase) and Lenis. It exists because of a hard constraint in this repo:
 * scripts live in `public/assets/js/` and are referenced with `is:inline` from
 * the layout's `scripts` slot (CLAUDE.md; repo deviation #10, because the CSP
 * carries no `unsafe-inline`). Files under `public/` are copied verbatim — Vite
 * never sees them — so a bare `import { gsap } from 'gsap'` in this file would
 * be an unresolvable specifier in the browser. The npm packages are real
 * dependencies in package.json; the bundle is how they reach a public/ script.
 *
 * Regenerate it after any `npm update gsap lenis`:
 *
 *   printf '%s\n' \
 *     "export { gsap } from 'gsap';" \
 *     "export { ScrollTrigger } from 'gsap/ScrollTrigger';" \
 *     "export { CustomEase } from 'gsap/CustomEase';" \
 *     "export { default as Lenis } from 'lenis';" > .press-vendor-entry.mjs
 *   ./node_modules/.bin/esbuild .press-vendor-entry.mjs --bundle --format=esm \
 *     --minify --target=es2020 --legal-comments=none \
 *     --outfile=public/assets/js/press-vendor.js
 *   rm .press-vendor-entry.mjs
 *
 * Splitting authored code from vendor code is deliberate: this file stays
 * readable and reviewable, and the 137KB of minified library sits in one file
 * that is obviously not hand-written. Desktop only, after first paint, second
 * request — it is never on the critical path of anything.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ON THE PAGE — the whole census, so it can be counted in review
 * ---------------------------------------------------------------------------
 * THE HERO SEQUENCE   timed autoplay, 4.79s, holds the final frame, never
 *                     loops, never pinned (adjudications A1–A3).
 *
 * THREE SET PIECES, and there is no fourth (adjudication B1):
 *   1 · THE FRACTURE     Scene 1 → Scene 2   the reckoning tears apart
 *   2 · THE APERTURE     Scene 4 → Scene 5   the catch irises open
 *   3 · THE FADE TO INK  Scene 8 → Close     the page goes dark and stops
 * Each carries the one-sentence comment adjudication B1 demands: what the
 * motion tells the reader that a static layout could not.
 *
 * ONE QUIET DEPTH CUE, identical at every other narrative seam: the arriving
 * act comes forward out of real perspective as a single plate. Same numbers
 * every time (see `DEPTH`) — six different sets of physics at six seams is a
 * showreel, and the page's epigraph names that failure.
 *
 * THREE CUTS, on purpose: join, donate and proof of life get NO motion at all.
 * The conversion spine is where the page calms down, and that contrast is what
 * makes the ask land (02 §2.5). It is also the flat rule that no conversion
 * element is ever animated on scrub.
 *
 * ZERO PINNED ACTS. The budget allows two (adjudication B2) and the hero may
 * never be one of them. This file spends none of that budget: see the note
 * above `fracture()` for why the signature seam reads better unpinned here.
 *
 * VERIFIED AGAINST THE BUILT PAGE, not assumed from the brief: ten acts in the
 * order SPINE lists; four `.press-lb` lines in the hero <h1>; three hero
 * frames; a six-glyph shatter word against a six-row shard table; exactly seven
 * pieces in the reckoning for the seven-row fracture table (label, headline,
 * standfirst, three beats, turn); and a real link — "Meet the people doing it"
 * — as the aperture's origin. If a scene is switched on or off in Keystatic
 * those counts change, and every lookup here tolerates that.
 *
 * ---------------------------------------------------------------------------
 * THINGS THE BRIEF ASKS FOR THAT ARE NOT HERE, AND WHY
 * ---------------------------------------------------------------------------
 * · THE LIGHT (adjudication A5, hero beat t=2900) requires "a pre-rendered
 *   light-leak frame (committed asset)". There is no such asset in
 *   public/assets/img/, and the two ways to fake one — a radial-gradient bloom
 *   and an animated filter: blur() — are both banned by name in the same row.
 *   A beat is missing from the hero until an art asset lands; inventing one
 *   would have been worse.
 * · The motion toggle in the menu overlay (02 §1.2) needs a control in the
 *   overlay's markup, which this file does not own.
 * · The gold ring around THE APERTURE would need either a gradient (illegal
 *   outside a photographic scrim and the one marker, 05 §2) or a new element
 *   and stylesheet rules. The iris ships without a drawn edge.
 */

import { gsap, ScrollTrigger, CustomEase, Lenis } from './press-vendor.js';

const doc = document;
const root = doc.documentElement;

/* The single canonical breakpoint. It is written here, in press.css §4, and in
   press-boot.js — three places, one value, and they must never disagree. */
const DESKTOP = '(min-width: 1024px)';

gsap.registerPlugin(ScrollTrigger, CustomEase);

/* ---------------------------------------------------------------------------
   1 · THE THREE CURVES — registered once, before anything references them
   ---------------------------------------------------------------------------
   `CustomEase.create(n, 'M0,0 C x1,y1 x2,y2 1,1')` is exactly
   `cubic-bezier(x1,y1,x2,y2)`, so these three are the SAME curves press.css
   §2.7 publishes as --press-ease-in / --press-ease-out / --press-ease-settle.
   CSS transitions and GSAP tweens on this page therefore move identically,
   which is the only way a page that animates in both can feel like one thing.

   THREE, AND NO OTHER EASE STRING ANYWHERE IN THIS FILE. A different ease per
   tween is the loudest machine tell in motion design. The one other value that
   appears is `ease: 'none'` on scroll-scrubbed tweens, which is not a curve at
   all — it is what makes the tween track the scrollbar 1:1 instead of easing
   away from the reader's own input. 02 §2.1 writes it the same way.

   press.css also publishes a fourth curve, --press-ease-fracture. It is not
   registered here: the budget is three, and pressIn already does the job the
   fracture needs (accelerate away, never decelerate into rest). -------------- */
CustomEase.create('pressIn', 'M0,0 C0.7,0 0.84,0 1,1');
CustomEase.create('pressOut', 'M0,0 C0.16,1 0.3,1 1,1');
CustomEase.create('pressSettle', 'M0,0 C0.34,1.24 0.36,1 1,1');

/* ---------------------------------------------------------------------------
   2 · THE DURATION LADDER — taken from press.css §2.7, not invented here
   ---------------------------------------------------------------------------
   Six values are in play across the eighteen TIMED tweens on the page, and no
   value carries more than a third of them. That is the anti-uniformity rule
   (≥5 distinct, none above 40%) satisfied by arithmetic rather than by hope:

     0.62s  ×6   the six shards of the hero's fracture           33%
     0.70s  ×6   four headline lines, the logo, the digit settle 33%
     0.34s  ×3   the masthead slug and the two hero CTAs         17%
     1.05s  ×1   the hero standfirst
     1.18s  ×1   the closing line
     0.18s  ×1   the scroll cue

   SCROLL-SCRUBBED TWEENS ARE NOT IN THAT CENSUS and must not be added to it.
   A scrubbed tween has no perceived duration: GSAP normalises its timeline to
   the trigger's scroll distance, so the `1` below is a normalisation constant,
   not a speed. Counting it would make five duplicate "durations" appear out of
   nowhere and would say nothing true about how the page feels. -------------- */
const D = {
  micro: 0.18,
  ui: 0.34,
  reveal: 0.62,
  revealB: 0.7,
  scene: 1.05,
  sceneB: 1.18,
};

/** Normalisation length for scroll-scrubbed tweens. Not a duration. */
const SCRUB_LEN = 1;

/* ---------------------------------------------------------------------------
   3 · THE HAND-AUTHORED SHARD TABLE (adjudication A4)
   ---------------------------------------------------------------------------
   One row per glyph of the hero's shatter word, in order. Rotation in degrees,
   x and y in pixels, delay in seconds from the start of the fracture beat.

   NO `gsap.utils.random()`. NO Physics2D. Randomness cannot be art-directed,
   cannot be reviewed and is different for every visitor, so the page has no
   fixed signature moment — it has a different one every time. These numbers
   were set by hand and can be argued with, which is the point.

   The delays are deliberately NOT in glyph order (0, 5, 2, 1, 4, 3 by rank).
   A stagger that walks left to right at a constant step is a machine reading a
   string; type thrown out of a case lands in no order at all.

   WHERE THE GLYPHS END UP. They do not fly away and vanish. They fall a little,
   turn a little, and STAY — the word ends up pied, the way a line of metal type
   looks after it has been dropped: still the word, visibly broken. Two reasons.
   The held final frame has to keep the complete sentence the <h1> promises
   (adjudication A3), and a word that fades out would read as a fade rather than
   a fracture — the one thing 02 §3.2 says it must not do.

   ADJUDICATION A9 IS ENFORCED AT RUNTIME BELOW: if an editor changes
   `shatterWord` in Keystatic and the table no longer has one row per glyph, the
   fracture does not run at all and the headline simply reveals whole. A silent,
   correct page beats a signature moment applied to the wrong letters. --------- */
const SHARDS = [
  { rot: -7, x: -6, y: 9, delay: 0.0 },
  { rot: 5, x: -2, y: 15, delay: 0.19 },
  { rot: -11, x: 3, y: 6, delay: 0.07 },
  { rot: 8, x: 7, y: 12, delay: 0.04 },
  { rot: -4, x: 1, y: 16, delay: 0.15 },
  { rot: 10, x: 9, y: 7, delay: 0.11 },
];

/* ---------------------------------------------------------------------------
   4 · THE ONE DEPTH CUE
   ---------------------------------------------------------------------------
   The client asked for a three-dimensional effect between sections. This is it,
   and it is the SAME at every seam that has one: the arriving act comes forward
   out of real perspective, as a single plate, and settles.

   Real perspective, not a fake: `transformPerspective` writes `perspective()`
   into the element's own transform, so the vanishing point belongs to the act
   rather than to a shared stage. That matters here — a shared `perspective` on
   a wrapper would make it a containing block for every position:fixed child,
   and this page has two of those (the scrolled chrome plate and the follow bar).
   press.css warns about exactly that trap twice.

   IT ARRIVES FROM BEHIND, not from in front. Coming forward from z:+180 means
   starting 11% oversize, and the acts clip horizontally (`overflow-x: clip`),
   so at the widest lines the first frame of the transition would show cropped
   type. From behind, the plate can only ever be smaller than its resting size.

   And it never reaches zero opacity: 0.82 is the floor. If a ScrollTrigger were
   ever to fail to fire, the worst case is an act that is slightly dim, not one
   that is blank. ---------------------------------------------------------- */
const DEPTH = {
  z: -160,
  rotateX: 3,
  yPercent: 2,
  opacity: 0.82,
  perspective: 1800,
  start: 'top 88%',
  end: 'top 42%',
  scrub: 0.45,
};

/* Which act gets which treatment. The running order top to bottom; two of the
   scenes here are switched OFF in Keystatic today (candidates, how to vote) and
   simply are not in the DOM, which is why every lookup below tolerates a miss.

   'depth'   the one quiet depth cue
   'set'     a set piece owns this act's arrival; no depth cue on top of it
   'cut'     nothing at all — the conversion spine, deliberately still */
const SPINE = [
  { id: 'press-hero', role: 'hero' },
  { id: 'press-reckoning', role: 'depth' },
  { id: 'press-hinge', role: 'depth' },
  { id: 'press-platform', role: 'depth' },
  { id: 'press-people', role: 'depth' },
  { id: 'press-candidates', role: 'depth' },
  { id: 'press-blocker', role: 'set' }, // THE APERTURE
  { id: 'press-join', role: 'cut' },
  { id: 'press-donate', role: 'cut' },
  { id: 'press-howtovote', role: 'cut' },
  { id: 'press-proof', role: 'cut' },
  { id: 'press-close', role: 'set' }, // THE FADE TO INK
];

/* ---------------------------------------------------------------------------
   5 · SMALL HELPERS
   -------------------------------------------------------------------------- */

const $ = (sel, ctx) => (ctx || doc).querySelector(sel);
const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));

/** The desktop copy of an act's content. The mobile copy is `display: none` at
 *  this width and must never be touched — it is a second, complete document. */
const treeOf = (id) => $('#' + id + ' .press-tree--desktop');

/**
 * will-change, added on enter and REMOVED on leave, never permanent (02 §5).
 * A permanent will-change is a promoted layer per act for the whole session,
 * which is how a page that animates beautifully for ten seconds runs out of
 * texture memory on a laptop with two other tabs open.
 */
function hint(target, value) {
  /* The hint has to land on the elements that actually move. Handing it to a
     parent promotes the wrong layer and buys nothing — which is why this takes
     the tween's own targets, list or single. */
  const els = Array.isArray(target) ? target : [target];
  const set = (v) => els.forEach((el) => el && (el.style.willChange = v));
  return {
    onEnter: () => set(value),
    onEnterBack: () => set(value),
    onLeave: () => set(''),
    onLeaveBack: () => set(''),
  };
}

/**
 * Wrap each glyph of an element's text in an inline-block span, and hand back
 * both the spans and a function that puts the text back exactly as it was.
 *
 * This is what SplitText would do, in eleven lines, without a second plugin —
 * and the shard table means the interesting part (which glyph goes where) was
 * never the splitter's job anyway.
 *
 * THE SHARDS ARE A DRAWING OF THE WORD, NOT THE WORD, and the accessibility
 * tree has to be told so. An earlier revision of this function left the aria
 * alone on the reasoning that splitting does not change `textContent`, so the
 * <h1>'s accessible name must be unchanged. MEASURED, AND FALSE: Chrome's
 * accessible-name computation concatenates descendants and inserts a space
 * between `inline-block` boxes, so the naive split made the hero <h1> announce
 *
 *     "Politics is b r o k e n . Let's change the system."
 *
 * and the figure in Scene 5 announce "5 0 0" — read out letter by letter and
 * digit by digit. (Chrome AX tree via CDP `Accessibility.getFullAXTree`, at
 * 1440x900 and 1024x768; the mobile tree, which never splits, was clean.)
 *
 * So the shards go behind `aria-hidden` and the ORIGINAL string rides beside
 * them, visually hidden. That is not a second source of truth — it is the same
 * string, copied at the moment of the split from the element itself, so an
 * editor rewriting `shatterWord` in Keystatic can never make the two disagree.
 * `restore()` still puts everything back with one assignment, which is why the
 * shard-count mismatch path and the matchMedia revert both stay one-liners.
 *
 * `.visually-hidden` is global.css's own utility (position:absolute, 1x1,
 * clipped), so the copy costs no layout in either place this is used.
 */
function splitGlyphs(el) {
  const chars = Array.from(el.textContent || '');
  const original = el.textContent;

  const shell = doc.createElement('span');
  shell.setAttribute('aria-hidden', 'true');
  const spans = chars.map((ch) => {
    const s = doc.createElement('span');
    s.textContent = ch;
    s.style.display = 'inline-block';
    shell.appendChild(s);
    return s;
  });

  const readable = doc.createElement('span');
  readable.className = 'visually-hidden';
  readable.textContent = original;

  el.textContent = '';
  el.appendChild(readable);
  el.appendChild(shell);
  return {
    spans,
    restore: () => {
      el.textContent = original;
    },
  };
}

/* The mask used by every one-shot reveal that walks a soft edge up through a
   block. It is the same gradient press.css §16 uses for `.press-wipe`, so the
   JS-driven reveals and the CSS-driven ones are the same gesture. Three times
   the element's height: bottom-aligned is hidden, top-aligned is revealed. */
const MASK = 'linear-gradient(to top, rgba(0,0,0,0) 0 8%, rgba(0,0,0,1) 34%)';

/**
 * Mask a block up, once, and then remove the mask entirely.
 *
 * The trailing clear is not tidiness — a mask is a paint-time operation, and a
 * page carrying a dozen finished masks repaints them on every scroll. Clearing
 * on completion means the cost belongs to the transition and not to the page.
 */
function maskUp(tl, el, at, dur) {
  const on = {
    maskImage: MASK,
    webkitMaskImage: MASK,
    maskSize: '100% 300%',
    webkitMaskSize: '100% 300%',
    maskPosition: '0% 100%',
    webkitMaskPosition: '0% 100%',
  };
  tl.set(el, on, 0)
    .to(
      el,
      {
        maskPosition: '0% 0%',
        webkitMaskPosition: '0% 0%',
        duration: dur,
        ease: 'pressOut',
      },
      at
    )
    .set(
      el,
      {
        clearProps:
          'maskImage,webkitMaskImage,maskSize,webkitMaskSize,maskPosition,webkitMaskPosition',
      },
      at + dur
    );
}

/* ===========================================================================
   6 · THE HERO SEQUENCE — timed autoplay, never pinned, never looping
   ===========================================================================
   Adjudication A1: ≤4,800ms, holds the final frame. This one runs 4,790ms.

   IT IS A TREATMENT OF TEXT THAT ALREADY EXISTS. The complete sentence is in
   the HTML from first paint and stays in the DOM throughout; the timeline only
   changes how it arrives. Nothing here injects a word.

   THE WAY OUT, three of them, per adjudication A2 and WCAG 2.2.2:
     · the "Skip the intro" control — focusable element #2, ≥48×48, on screen
       from t=0, and this file is what makes it real (press-boot.js hides it
       when no sequence exists, precisely so it is never a control that lies);
     · ANY scroll, wheel or touch;
     · Tab, Escape, or any of the scrolling keys.
   All three call the same `resolve()`, which is `progress(1)` — the end state,
   immediately, with no animation to sit through.
   ======================================================================== */
function buildHero(cleanups) {
  const hero = $('#press-hero');
  const tree = treeOf('press-hero');
  if (!hero || !tree) return null;

  const logo = $('.press-chrome__logo', hero);
  const slug = $('.press-hero__slug', hero);
  const lines = $$('.press-hero__title .press-lb', tree);
  const sub = $('.press-hero__sub', tree);
  const ctas = $$('.press-hero__ctas .press-btn', tree);
  const primary = $('.press-hero__ctas .press-btn--primary', tree);
  const cue = $('[data-press-scrollcue]', hero);
  const frames = $$('[data-press-frame]', hero);
  const skip = $('[data-press-skip]', hero);

  if (!lines.length) return null;

  /* --- the frames ---------------------------------------------------------
     Ported contract, not a new one (02 §3.3): decode before the cut, and if a
     frame has not decoded in time, SKIP it rather than stall on a half-painted
     image. `ready[]` is read at render time through GSAP's function-based
     values, so the guard survives a jump to the end as well as normal playback.

     The cut itself is a splice, not a crossfade: the outgoing frame goes to
     zero, ~66ms of the stage's own near-black shows through, and the incoming
     frame arrives. A film cut. If the incoming frame is not ready, the outgoing
     one is simply never turned off and the reader sees nothing at all happen —
     which is the correct failure for a beat nobody was told to expect. */
  const ready = frames.map((_, i) => i === 0);
  frames.forEach((img, i) => {
    if (i === 0 || !img.decode) return;
    img.decode().then(
      () => (ready[i] = true),
      () => {}
    );
  });

  const tl = gsap.timeline({ paused: true });

  /* --- t = 0 · the resting state the sequence starts from ------------------
     Set inside the timeline, never as a side effect, so `progress(1)` and the
     matchMedia revert both unwind it completely. */
  if (logo) tl.set(logo, { opacity: 0 }, 0);
  if (slug) tl.set(slug, { clipPath: 'inset(0 100% 0 0)' }, 0);
  if (sub) tl.set(sub, { y: 24 }, 0);
  if (ctas.length) tl.set(ctas, { opacity: 0, y: 14 }, 0);
  if (cue) tl.set(cue, { opacity: 0 }, 0);

  /* --- t = 0.00 · the real logo file, faded in. Never traced, never redrawn. */
  if (logo) tl.to(logo, { opacity: 1, duration: D.revealB, ease: 'pressOut' }, 0);

  /* --- t = 0.20 · the masthead slug prints in from the left.
     A clip-path, but a TIMED one — adjudication B6 caps the page at one
     SCRUBBED clip-path, which is spent on THE APERTURE. A 340ms clip on a
     140px plate is not the thing B6 is protecting the frame budget from. */
  if (slug) tl.to(slug, { clipPath: 'inset(0 0 0 0)', duration: D.ui, ease: 'pressOut' }, 0.2);

  /* --- the headline, line by line -----------------------------------------
     Beats, not a stagger. 0.95 is deliberately ~60ms later than the mechanical
     interval the first two lines would otherwise sit on (02 §3.2): "broken"
     arrives a beat late, and that hesitation is the whole reading of the line.
     The resolve waits until after the fracture and lands into the decay. */
  const BEATS = [0.35, 0.95, 3.52, 3.6];
  lines.forEach((line, i) => {
    maskUp(tl, line, BEATS[Math.min(i, BEATS.length - 1)], D.revealB);
  });

  /* --- t = 1.60 · FRAME 2, spliced ---------------------------------------- */
  if (frames.length > 1) {
    tl.set(frames[0], { opacity: () => (ready[1] ? 0 : 1) }, 1.6).set(
      frames[1],
      { opacity: () => (ready[1] ? 1 : 0) },
      1.666
    );
  }

  /* --- t = 2.05 · THE FRACTURE, in the hero ------------------------------
     The word breaks apart under its own weight. `pressIn` accelerates the whole
     way, so the glyphs read as falling rather than fading — the distinction
     02 §3.2 insists on, and the reason no opacity is tweened here at all. */
  const word = $('[data-shatter]', tree);
  let shards = null;
  if (word) {
    const split = splitGlyphs(word);
    if (split.spans.length === SHARDS.length) {
      shards = split;
      split.spans.forEach((el, i) => {
        const s = SHARDS[i];
        tl.to(
          el,
          { rotate: s.rot, x: s.x, y: s.y, duration: D.reveal, ease: 'pressIn' },
          2.05 + s.delay
        );
      });
    } else {
      /* Adjudication A9. The word and the table disagree — an editor changed
         `shatterWord` and the shards were never re-authored for it. Put the
         word back and let the line simply reveal. */
      split.restore();
    }
  }

  /* --- t = 2.55 · FRAME 3, same grammar as the first cut ------------------- */
  if (frames.length > 2) {
    tl.set(frames[1], { opacity: () => (ready[2] ? 0 : 1) }, 2.55).set(
      frames[2],
      { opacity: () => (ready[2] ? 1 : 0) },
      2.616
    );
  }

  /* (t = 2.90 · THE LIGHT would sit here. See the header: the committed
     light-leak asset adjudication A5 requires does not exist, and both ways of
     faking it are banned by the same row.) */

  /* --- t = 3.86 · the standfirst rises. Translate only, no opacity: it is
     never invisible, only out of place, and it is the one reveal on the page
     that moves without fading. */
  if (sub) tl.to(sub, { y: 0, duration: D.scene, ease: 'pressSettle' }, 3.86);

  /* --- t = 4.08 · the calls to action. Join first, Donate 90ms behind it.
     This is the page's ONE opacity+translate reveal (press.css §16 choreography
     5, "used once — if you are reaching for this a second time, one of the four
     above is the right answer"). Everything else here masks, clips or rises. */
  ctas.forEach((btn, i) => {
    tl.to(btn, { opacity: 1, y: 0, duration: D.ui, ease: 'pressOut' }, 4.08 + i * 0.09);
  });

  /* The gold underrule beneath the primary button draws itself: press.css owns
     that transition and waits on `.is-inview`. Handing it the class at 4.10s is
     the whole of the beat — no second implementation of the same 520ms line.

     A TIMER AND NOT A TIMELINE CALLBACK, measured rather than assumed. GSAP
     suppresses callbacks when the playhead JUMPS, so `.call()` would have left
     a reader who pressed "Skip the intro" with a Join button and no rule under
     it — and GSAP's own `className: '+=…'` was verified in a headless run to
     overwrite the class attribute outright (`class="+=is-inview"`, the button's
     own classes gone). Neither is acceptable for the page's primary CTA, so the
     class goes on through classList, from three places that between them cover
     every path: the beat, the skip, and the natural end. It is idempotent. */
  const mark = () => {
    if (primary) primary.classList.add('is-inview');
  };
  const markTimer = setTimeout(mark, 4100);

  /* --- t = 4.30 · the scroll cue. Total: 4.79s, inside the 4.8s ceiling. */
  if (cue) tl.to(cue, { opacity: 1, duration: D.micro, ease: 'pressOut' }, 4.3);

  /* --- resolving the sequence ---------------------------------------------
     `progress(1)` renders the end state of every tween AND every `.set()` in
     one pass. That is why the frame cuts are sets with function-based values
     rather than `.call()` callbacks: GSAP suppresses callbacks on a jump, and a
     skip control that left the hero on frame 1 with two masked lines would be
     an escape hatch into a broken page. */
  let resolved = false;
  const resolve = () => {
    if (resolved) return;
    resolved = true;
    tl.progress(1);
    mark();
    detach();
  };

  const onKey = (e) => {
    if (
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === ' ' ||
      e.key === 'PageDown' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      resolve();
    }
  };
  const opts = { passive: true };
  function detach() {
    clearTimeout(markTimer);
    window.removeEventListener('wheel', resolve, opts);
    window.removeEventListener('touchstart', resolve, opts);
    window.removeEventListener('scroll', onScroll, opts);
    doc.removeEventListener('keydown', onKey);
    if (skip) skip.removeEventListener('click', resolve);
  }

  /* The scroll listener has to tolerate the reset to the top this file performs
     on load (§9) — that reset itself fires a scroll event, and a hero that
     skips itself before it has drawn a frame is not a hero. Anything past a
     20px intent threshold is a reader, not a scroll restoration. */
  const onScroll = () => {
    if (window.scrollY > 20) resolve();
  };

  window.addEventListener('wheel', resolve, opts);
  window.addEventListener('touchstart', resolve, opts);
  window.addEventListener('scroll', onScroll, opts);
  doc.addEventListener('keydown', onKey);

  if (skip) {
    /* press-boot.js hid this control because, until this file loaded, there was
       no sequence to escape from. Giving it back is a one-line handshake and it
       is documented at both ends. */
    skip.style.display = '';
    skip.addEventListener('click', resolve);
  }

  tl.eventCallback('onComplete', () => {
    mark();
    detach();
    resolved = true;
    /* A "Skip the intro" button after the intro is over is noise, and a control
       that does nothing is worse than no control. It only disappears if it is
       not the thing the reader currently has focus on — pulling an element out
       from under focus dumps the caret back to <body> and loses their place. */
    if (skip) {
      if (doc.activeElement === skip) skip.addEventListener('blur', () => (skip.style.display = 'none'), { once: true });
      else skip.style.display = 'none';
    }
  });

  cleanups.push(() => {
    detach();
    if (shards) shards.restore();
    if (skip) skip.style.display = 'none';
  });

  tl.play();
  return tl;
}

/* ===========================================================================
   7 · THE SCROLL SPINE
   ======================================================================== */

/** The one quiet depth cue. Same numbers at every seam that has one. */
function depthCue(id) {
  const act = $('#' + id);
  const tree = treeOf(id);
  if (!act || !tree) return;

  gsap.fromTo(
    tree,
    {
      z: DEPTH.z,
      rotateX: DEPTH.rotateX,
      yPercent: DEPTH.yPercent,
      opacity: DEPTH.opacity,
      transformPerspective: DEPTH.perspective,
      transformOrigin: '50% 0%',
    },
    {
      z: 0,
      rotateX: 0,
      yPercent: 0,
      opacity: 1,
      ease: 'none',
      duration: SCRUB_LEN,
      scrollTrigger: Object.assign(
        {
          trigger: act,
          start: DEPTH.start,
          end: DEPTH.end,
          scrub: DEPTH.scrub,
          invalidateOnRefresh: true,
        },
        hint(tree, 'transform, opacity')
      ),
    }
  );
}

/**
 * SET PIECE 1 · THE FRACTURE — Scene 1 (the reckoning) into Scene 2 (the hinge)
 *
 * WHAT THE MOTION SAYS THAT A STATIC LAYOUT COULD NOT: that the three
 * statements above are not a list the reader has finished with — they are the
 * thing that breaks, and the page is what breaks it.
 *
 * Seven pieces, because the act has exactly seven: the label, the misregistered
 * headline, the standfirst, the three beats, and the turn. Odd, so there is a
 * true centre; each one is a real piece of the page rather than a shard of
 * confetti; and the values are hand-set in `FRACTURE`, never randomised.
 *
 * NOT PINNED, and that is a judgement rather than an omission. The brief pins
 * this seam (02 §2.2) with `start: 'top top'`, which assumes an act shorter than
 * the viewport; this one is `.press-act--vast` and is comfortably taller than
 * one, so a pin would either freeze the reader before they had read the beats
 * or fire on the last screenful with five of the seven pieces already above the
 * viewport. Scrubbing the act's own exit gives the same tear at the same moment
 * with no scroll-jacking and no assumption about height — and it keeps the
 * pinned-act budget (adjudication B2) entirely unspent.
 */
const FRACTURE = [
  { rotateY: -14, z: -220, xPercent: -9, yPercent: -1 },
  { rotateY: 14, z: -254, xPercent: 9, yPercent: 2 },
  { rotateY: -14, z: -288, xPercent: -9, yPercent: -3 },
  { rotateY: 14, z: -322, xPercent: 9, yPercent: 1 },
  { rotateY: -14, z: -356, xPercent: -9, yPercent: 3 },
  { rotateY: 14, z: -390, xPercent: 9, yPercent: -2 },
  { rotateY: -14, z: -424, xPercent: -9, yPercent: 2 },
];

function fracture(cleanups) {
  const act = $('#press-reckoning');
  const tree = treeOf('press-reckoning');
  if (!act || !tree) return;

  const page = $('.press-page', tree) || tree;

  /* The seven pieces, flattened one level out of the header and the beats list
     so the act's real structure — three lines of masthead, three statements,
     one turn — is what breaks, rather than three fat containers. */
  const slabs = [];
  Array.prototype.forEach.call(page.children, (child) => {
    if (child.classList.contains('press-colrules')) return; // decorative; press.css drives it
    const tag = child.tagName;
    if (tag === 'HEADER' || tag === 'OL' || tag === 'UL') {
      Array.prototype.forEach.call(child.children, (g) => slabs.push(g));
    } else {
      slabs.push(child);
    }
  });
  if (slabs.length < 2) return;

  /* One shared vanishing point for all seven, so they break away from the same
     point in space rather than each pivoting about its own centre. Set on the
     page wrapper rather than on `.press`, because `perspective` creates a
     containing block for position:fixed children and the page's own chrome
     plate is fixed. Nothing inside this act is. Undone on revert. */
  const priorPerspective = page.style.perspective;
  const priorOrigin = page.style.perspectiveOrigin;
  page.style.perspective = '1600px';
  page.style.perspectiveOrigin = '50% 42%';
  cleanups.push(() => {
    page.style.perspective = priorPerspective;
    page.style.perspectiveOrigin = priorOrigin;
  });

  gsap.to(slabs, {
    rotateY: (i) => FRACTURE[i % FRACTURE.length].rotateY,
    z: (i) => FRACTURE[i % FRACTURE.length].z,
    xPercent: (i) => FRACTURE[i % FRACTURE.length].xPercent,
    yPercent: (i) => FRACTURE[i % FRACTURE.length].yPercent,
    opacity: 0,
    transformOrigin: '50% 50%',
    ease: 'none',
    duration: SCRUB_LEN,
    /* from 'end': the pieces nearest the fold go first and the eye is carried
       upward with the act as it leaves. `from: 'center'` (the brief's value)
       assumes a pinned stage where all seven are on screen at once. */
    stagger: { each: 0.045, from: 'end' },
    scrollTrigger: Object.assign(
      {
        trigger: act,
        start: 'bottom bottom',
        end: 'bottom 12%',
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
      hint(slabs, 'transform, opacity')
    ),
  });
}

/**
 * SET PIECE 2 · THE APERTURE — Scene 4 (the people) into Scene 5 (the catch)
 *
 * WHAT THE MOTION SAYS THAT A STATIC LAYOUT COULD NOT: that the obstacle was
 * always there, behind the optimism, and the page is opening a hole in the
 * previous scene to show it — not turning a page onto a new one.
 *
 * The ONE scrubbed clip-path on the whole page (adjudication B6). It is not
 * composited: every frame is a full-viewport main-thread paint, which is why
 * there is one, why the wrapper takes `contain: paint`, and why the grain on
 * the two acts either side is suppressed for the duration (02 §2.3 — a blended
 * layer compositing over a scrubbed clip-path is the exact combination that
 * janks). press.css has no `.no-grain` class to add, so the suppression goes
 * through the act's own `--press-grain` token, which is what that opacity reads.
 *
 * The origin is not the centre of the act. It is the last thing the reader was
 * looking at in the scene above, mapped into this act's coordinate space on
 * every refresh. That specificity is the difference between a transition and an
 * effect.
 */
function aperture() {
  const act = $('#press-blocker');
  const tree = treeOf('press-blocker');
  if (!act || !tree) return;

  const above = $('#press-people') || $('#press-platform');

  /** Where the iris opens from, in this act's own coordinates. */
  const origin = () => {
    const fallback = { x: 50, y: -10 };
    const aboveTree = above && $('.press-tree--desktop .press-page', above);
    if (!aboveTree) return fallback;
    /* The last link in the act above — the thing the reader's eye was last on.
       If that act has none (the composition is an editor's choice, and two of
       these scenes ship without one), the foot of its content column is the
       next most honest answer. */
    const links = $$('.press-btn, .press-tap', aboveTree);
    const el = links.length ? links[links.length - 1] : aboveTree.lastElementChild;
    if (!el) return fallback;
    const anchor = el.getBoundingClientRect();
    const here = tree.getBoundingClientRect();
    if (!here.width || !here.height) return fallback;
    return {
      x: ((anchor.left + anchor.width / 2 - here.left) / here.width) * 100,
      y: ((anchor.top + anchor.height / 2 - here.top) / here.height) * 100,
    };
  };

  let o = origin();
  const circle = (r) => 'circle(' + r + '% at ' + o.x.toFixed(2) + '% ' + o.y.toFixed(2) + '%)';

  const grainOff = () => {
    if (above) above.style.setProperty('--press-grain', '0');
    act.style.setProperty('--press-grain', '0');
  };
  const grainOn = () => {
    if (above) above.style.removeProperty('--press-grain');
    act.style.removeProperty('--press-grain');
  };

  /* FUNCTION VALUES, not strings, and this is what makes the recompute real.
     A literal `circle(0% at 42% -8%)` is parsed once at creation and would keep
     the position it had on the first layout for the rest of the session.
     Function-based values are re-evaluated whenever the tween is invalidated,
     which `invalidateOnRefresh` does on every ScrollTrigger.refresh() — so a
     resize, a late font or a decoded image all move the iris with the anchor. */
  gsap.fromTo(
    tree,
    { clipPath: () => circle(0) },
    {
      clipPath: () => circle(150),
      ease: 'none',
      duration: SCRUB_LEN,
      /* THE MOST IMPORTANT WORD IN THIS TWEEN. Left at its default, a `fromTo`
         applies its from-state the moment the page builds — and the from-state
         here is `circle(0%)`, i.e. this entire act, including the two calls to
         action it carries, invisible from first paint and dependent on a
         ScrollTrigger firing correctly to ever come back. `false` means the
         clip exists only from the instant the reader is inside the transition.
         Crossing the start line can cost one frame of pop; at `top 80%` the
         only thing on screen to pop is the act's top padding. */
      immediateRender: false,
      scrollTrigger: {
        trigger: act,
        start: 'top 80%',
        end: 'top 10%',
        scrub: 0.4,
        invalidateOnRefresh: true,
        /* Recomputed on every refresh — a resize, a font swap or a late image
           all move the anchor, and an iris opening from where a button used to
           be is worse than one opening from the middle. */
        onRefreshInit: () => {
          o = origin();
        },
        onEnter: () => {
          tree.style.contain = 'paint';
          tree.style.willChange = 'clip-path';
          grainOff();
        },
        onEnterBack: () => {
          tree.style.contain = 'paint';
          tree.style.willChange = 'clip-path';
          grainOff();
        },
        onLeave: () => {
          tree.style.contain = '';
          tree.style.willChange = '';
          grainOn();
        },
        onLeaveBack: () => {
          tree.style.contain = '';
          tree.style.willChange = '';
          grainOn();
        },
      },
    }
  );
}

/**
 * The Scene 5 digit settle — the fracture motif's third and last appearance in
 * content (adjudication E7: the hero shatter, this, and THE FRACTURE as a seam).
 *
 * One shot, once, quiet, and pointedly not on scrub: this act carries the
 * page's two calls to action and nothing in it may move while a reader is
 * pointing at it. The figure is the single number the whole homepage is about,
 * and it arrives out of register and settles into place — the same idea as the
 * hero, drawn once, an eighth of the size.
 */
function digitSettle(cleanups) {
  const tree = treeOf('press-blocker');
  const figure = tree && $('.press-apex__figure', tree);
  if (!figure) return;

  const split = splitGlyphs(figure);
  if (!split.spans.length) return;
  cleanups.push(split.restore);

  gsap.from(split.spans, {
    y: (i) => [10, -6, 8, -4, 12, -7][i % 6],
    rotate: (i) => [-4, 3, -2, 5, -3, 2][i % 6],
    duration: D.revealB,
    ease: 'pressSettle',
    stagger: { each: 0.04, from: 'start' },
    scrollTrigger: {
      trigger: figure,
      start: 'top 82%',
      once: true,
      invalidateOnRefresh: true,
    },
  });
}

/**
 * The gold underrule under every primary button on the desktop tree.
 *
 * NOT A MOTION FEATURE — a piece of the design that press.css §16 parks behind
 * a switch. §10 draws a 2px gold rule inset along the primary button's bottom
 * edge and calls it "the primary's mark at rest"; §16 then collapses it to
 * `scaleX(0)` under `html.js-motion` and waits for `.is-inview`. effects.js
 * sets `js-motion` on every page of this site, so without something to add that
 * class the mark at rest is simply missing. press-mobile.css prints it outright
 * on the phone tree, where a rule drawing itself under a thumb is the one
 * animation the thumb contract forbids. The left-to-right draw is a desktop
 * gesture, so its driver belongs here.
 *
 * A plain IntersectionObserver and a class, not a GSAP tween: the transition,
 * its 520ms and its curve are all press.css's, and re-implementing them in JS
 * would be two sources of truth for one line. The hero's own buttons are
 * excluded — its timeline hands them the same class on its own beat at 4.10s.
 */
function releaseUnderrules(cleanups) {
  if (typeof IntersectionObserver !== 'function') return;
  const hero = $('#press-hero');
  const marks = $$('.press-tree--desktop .press-btn--primary').filter(
    (el) => !(hero && hero.contains(el))
  );
  if (!marks.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-inview');
        io.unobserve(e.target);
      });
    },
    { threshold: 0, rootMargin: '0px 0px -8% 0px' }
  );
  marks.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
}

/**
 * SET PIECE 3 · THE FADE TO INK — Scene 8 into the close
 *
 * WHAT THE MOTION SAYS THAT A STATIC LAYOUT COULD NOT: that the page is
 * finishing. The ground goes out from under the reader over 140vh, the last
 * line arrives once, and then — after nine acts of movement — nothing moves at
 * all. The stillness is the payoff, and it only reads as stillness because the
 * fade earned it.
 *
 * DO NOT ADD ANYTHING TO THIS. 02 §2.4 says so in those words, and it is right:
 * the close is the one act where the correct amount of motion is none.
 *
 * The colours are read from the live tokens rather than written down here, so
 * the interpolation can never drift from --paper and --press-black. The inline
 * value is removed again on the way out so the stylesheet, not this file, owns
 * the act's resting ground.
 */
function fadeToInk() {
  const act = $('#press-close');
  const tree = treeOf('press-close');
  if (!act) return;

  const cs = getComputedStyle(root);
  const parse = (name, fallback) => {
    const raw = (cs.getPropertyValue(name) || fallback).trim();
    const hex = raw.replace('#', '');
    if (hex.length !== 6) return null;
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  };
  const from = parse('--paper', '#fffdf7');
  const to = parse('--press-black', '#0b1513');

  if (from && to) {
    const p = { t: 0 };
    gsap.to(p, {
      t: 1,
      ease: 'none',
      duration: SCRUB_LEN,
      onUpdate: () => {
        const c = from.map((v, i) => Math.round(v + (to[i] - v) * p.t));
        act.style.setProperty('--press-bg', 'rgb(' + c[0] + ' ' + c[1] + ' ' + c[2] + ')');
      },
      scrollTrigger: {
        trigger: act,
        /* THE WINDOW IS SET BY CONTRAST, NOT BY TASTE, and it is the one number
           here that must not be widened. This act's type is `--paper` on
           `--press-black` (§6.1). While the ground is interpolating it passes
           through paper, and paper type on a paper ground is invisible — so the
           fade has to be FINISHED before a single word of the close can be on
           screen. `.press-act--vast` gives it 18vw of top padding, which is
           259px at 1440×900; ending when the act's top edge reaches 70% of the
           viewport puts the first line of type at ~889px on a 900px-tall
           screen, i.e. just arriving, with the ground already ink. Everything
           visible during the dissolve is padding.
           Extending `end` past `top 70%` is a WCAG 1.4.3 failure, not a longer
           transition. */
        start: 'top bottom',
        end: 'top 70%',
        scrub: 0.5,
        invalidateOnRefresh: true,
        /* Past the end the tween stops updating, so handing the resting colour
           back to the stylesheet here is safe and keeps one hard-coded hex out
           of the finished DOM. Scrolling back up re-arms it. */
        onLeave: () => act.style.removeProperty('--press-bg'),
      },
    });
  }

  /* The closing line masks up ONCE, and then the page is finished.

     `immediateRender: false` is the load-bearing word in this tween. Without
     it the mask would be applied the moment the page builds and the last
     sentence on the homepage would depend on a ScrollTrigger firing correctly
     for the rest of the session. With it, the hidden state exists only from the
     instant the reveal begins, and it is cleared the instant it ends — before
     and after, the line is exactly what the static document renders. */
  const line = tree && $('.press-close__line', tree);
  if (line) {
    gsap.fromTo(
      line,
      {
        maskImage: MASK,
        webkitMaskImage: MASK,
        maskSize: '100% 300%',
        webkitMaskSize: '100% 300%',
        maskPosition: '0% 100%',
        webkitMaskPosition: '0% 100%',
      },
      {
        maskPosition: '0% 0%',
        webkitMaskPosition: '0% 0%',
        duration: D.sceneB,
        ease: 'pressOut',
        immediateRender: false,
        scrollTrigger: { trigger: line, start: 'top 84%', once: true, invalidateOnRefresh: true },
        onComplete: () =>
          gsap.set(line, {
            clearProps:
              'maskImage,webkitMaskImage,maskSize,webkitMaskSize,maskPosition,webkitMaskPosition',
          }),
      }
    );
  }
}

/* ===========================================================================
   8 · LENIS — desktop only, never under reduced motion (adjudication B4)
   ======================================================================== */
function startLenis(cleanups) {
  /* `lerp` OR `duration`+`easing`, NEVER both — they fight, and the result is
     the rubbery, weightless feel that makes smooth-scroll libraries infamous.
     0.09 is the value the brief settled on. */
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, autoRaf: false });

  /* global.css sets `html { scroll-behavior: smooth }` sitewide. Native smooth
     scrolling and Lenis both animate the same scroll position and fight over
     it; Lenis's own documentation says to turn the native one off while it
     runs. Restored on revert, so no other page and no other state is affected. */
  const priorBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';

  lenis.on('scroll', ScrollTrigger.update);
  const raf = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(raf);
  /* One clock. lagSmoothing off, or a dropped frame makes GSAP invent a jump
     that Lenis has no idea about and the two desynchronise. */
  gsap.ticker.lagSmoothing(0);

  /* CI asserts this is undefined under prefers-reduced-motion. It is only ever
     defined here, and this function is only ever reached on desktop. */
  window.__lenis = lenis;

  /* Native `#hash` jumps move the scroll position behind Lenis's back and leave
     it interpolating towards where the page used to be. In-page anchors go
     through Lenis instead; everything else (other pages, mailto) is untouched. */
  const onAnchor = (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = doc.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0 });
  };
  doc.addEventListener('click', onAnchor);

  cleanups.push(() => {
    doc.removeEventListener('click', onAnchor);
    gsap.ticker.remove(raf);
    lenis.destroy();
    root.style.scrollBehavior = priorBehavior;
    delete window.__lenis;
  });
}

/* ===========================================================================
   9 · BOOT
   ======================================================================== */

/**
 * gsap.matchMedia() is the ONLY place a ScrollTrigger is created (02 §1.2).
 * That is not a style preference: it is what makes a reader who drags a desktop
 * window down below 1024px — or turns reduced motion on mid-session — get every
 * transform, every trigger and Lenis itself REVERTED, leaving the static
 * document the mobile tree expects. Creating triggers outside it would leave a
 * phone-width layout wearing desktop transforms.
 */
const mm = gsap.matchMedia();

mm.add(DESKTOP + ' and (prefers-reduced-motion: no-preference)', () => {
  const cleanups = [];
  let hero = null;

  /**
   * Every piece of this layer is built inside its own guard, and that is not
   * belt-and-braces — it is the difference between one thing failing and the
   * page having no motion at all. Lenis touching an API a browser has not
   * shipped must not cost the reader the hero sequence; a scene the CMS has
   * switched off must not cost them the close. Each builder is independently
   * skippable because each is independently additive, and the page underneath
   * every one of them is already finished.
   *
   * Deliberately silent: a console error on a live homepage is noise a visitor
   * cannot act on, and the QA pass gates on zero console errors.
   */
  const safe = (fn) => {
    try {
      return fn();
    } catch (err) {
      return null;
    }
  };

  /* A refresh mid-page must not land the reader inside a transition with the
     hero sequence playing behind them. Manual restoration + a reset to the top,
     unless they arrived on a deep link, in which case the anchor is the intent
     and must win. */
  safe(() => {
    if (!location.hash && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }
  });

  /* Lenis first, because ScrollTrigger.update has to be wired to its scroll
     event before any trigger exists. If it fails, everything below still works
     against native scroll — smoothing is a refinement, not a dependency. */
  safe(() => startLenis(cleanups));

  hero = safe(() => buildHero(cleanups));
  if (!hero) {
    /* The sequence never started, so the escape hatch has nothing to escape and
       the buttons it would have revealed need their rule printed. */
    root.removeAttribute('data-press-intro');
    const skip = $('[data-press-skip]');
    if (skip) skip.style.display = 'none';
    $$('#press-hero .press-tree--desktop .press-btn--primary').forEach((b) =>
      b.classList.add('is-inview')
    );
  }

  SPINE.forEach((act) => {
    if (act.role === 'depth') safe(() => depthCue(act.id));
  });

  safe(() => fracture(cleanups));
  safe(() => aperture());
  safe(() => digitSettle(cleanups));
  safe(() => releaseUnderrules(cleanups));
  safe(() => fadeToInk());

  /* --- refresh discipline (02 §1.3) --------------------------------------
     Every start/end offset above is a measurement, and a measurement taken
     against fallback font metrics or an undecoded image is wrong. Three cheap
     re-measurements cover every case that moves the page after first paint. */
  if (doc.fonts && doc.fonts.ready) {
    doc.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
  }
  const imgs = $$('#press-hero [data-press-frame]');
  Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(
    () => ScrollTrigger.refresh()
  );
  const onLoad = () => ScrollTrigger.refresh();
  window.addEventListener('load', onLoad, { once: true });

  return () => {
    window.removeEventListener('load', onLoad);
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        /* a cleanup that throws must not stop the others */
      }
    });
    root.removeAttribute('data-press-intro');
  };
});

/* View transitions are not enabled on this site today, and these two listeners
   cost nothing if they never fire. If they are ever turned on, this is what
   stops a swapped page from inheriting stale measurements and a live Lenis. */
doc.addEventListener('astro:page-load', () => ScrollTrigger.refresh());
doc.addEventListener('astro:before-swap', () => mm.revert());
