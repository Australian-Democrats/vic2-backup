/* press-mobile.js — the cinematic homepage's mobile reveal fallback.
 * ===========================================================================
 * ONE JOB: add `.is-inview` to a short, named list of NON-INTERACTIVE elements
 * when they come into view, so src/styles/press-mobile.css §5 can finish a
 * reveal in a browser that has no scroll-driven CSS. That is the whole file.
 *
 * IT IS NOT THE MOBILE MOTION LAYER. The motion is CSS — `position: sticky`
 * chapters and `animation-timeline: view()` (press-mobile.css §4 and §6) —
 * and in a current browser this script measures nothing, observes nothing and
 * costs one media-query read. Zero GSAP, zero ScrollTrigger, zero Lenis on the
 * phone is adjudication B3, and the reason is arithmetic: those three are
 * 45.6KB brotli before a line of application code, against a 20KB budget.
 *
 * FOUR GATES, ALL OF WHICH MUST BE OPEN.
 *   1 · below 1024px           the one canonical breakpoint (adjudication C4).
 *                              Re-checked on change, so a rotate or a resize
 *                              into the mobile tree arms it.
 *   2 · html.js-motion         the site's own switch, set by effects.js on
 *                              every page (repo deviation #9). Never a
 *                              parallel one.
 *   3 · no prefers-reduced-motion
 *   4 · NO `animation-timeline: view()` support. With it, the CSS does the
 *                              whole job and this script must stay out of the
 *                              way — two engines animating the same element
 *                              is how a reveal ends up running twice.
 *
 * THE RECEIPT, AND WHY IT IS NOT A SECOND MOTION SWITCH.
 * A stylesheet may only hide something if something is guaranteed to show it
 * again. `html.js-motion` cannot carry that guarantee here: effects.js sets it
 * on every page whether or not THIS file loaded, so a rule keyed to it alone
 * would leave content hidden forever the day this script fails to arrive. So
 * the moment an observer is actually armed, this sets
 *
 *     <html data-press-reveal="io">
 *
 * and every rule in press-mobile.css §5 hangs off that attribute. It says "an
 * observer is alive in this document", which is the only safe condition under
 * which CSS may hide and wait. No attribute, no hidden state, finished page.
 *
 * NOTHING ANIMATES UNDER A FINGER. The register below is non-interactive
 * elements only, and the stylesheet independently refuses to animate anything
 * matching `:has(a, button, input, select, textarea, [tabindex])`. Join and
 * Donate are printed and pressable from first paint at all five of the moments
 * they appear; no conversion element is ever observed, revealed or moved.
 *
 * ORDER: after press-boot.js, which settles `data-tree` first.
 */
(function () {
  var doc = document;
  var root = doc.documentElement;

  /* The register. Kept here rather than derived from a data attribute so the
     list is reviewable in one place, and deliberately short — seven selectors,
     five choreographies, no reach into any act this file cannot name. Each
     one is matched INSIDE the mobile tree only; the desktop copy of the same
     markup is display:none, never intersects, and is skipped for free. */
  var REGISTER = [
    '.press-tree--mobile .press-reck__chapter-in',  /* arrive · the reckoning  */
    '.press-tree--mobile .press-a3m__chapter-body', /* margin · the platform   */
    '.press-tree--mobile .press-hinge__chamber--m', /* column · the seat fill  */
    '.press-tree--mobile .press-a4m__plate',        /* settle · the people act */
    '.press-tree--mobile .press-a5m__fill',         /* measure · the apex rule */
    '.press-tree--mobile .press-a8m__masthead',     /* settle · proof of life  */
    '.press-tree--mobile .press-a8m__gameshead',    /* settle · proof of life  */
  ].join(',');

  var DESKTOP = '(min-width: 1024px)';
  var mq = window.matchMedia(DESKTOP);
  var armed = false;

  function arm() {
    if (armed) return;
    if (mq.matches) return;
    if (!root.classList.contains('js-motion')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /* The CSS engine is present: stand down completely. */
    if (window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) return;
    if (typeof IntersectionObserver !== 'function') return;

    var targets = doc.querySelectorAll(REGISTER);
    if (!targets.length) return;

    armed = true;
    root.setAttribute('data-press-reveal', 'io');

    var io = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          entries[i].target.classList.add('is-inview');
          /* Once. A reveal that re-runs on the way back up is a page that
             cannot be re-read, and on a phone the way back up is most of the
             session. */
          io.unobserve(entries[i].target);
        }
      },
      /* Fire when the element's leading edge has risen an eighth of the way up
         the display — far enough that the reveal is not happening in the very
         bottom strip, close enough that it has always finished before the
         element is read. A `threshold` cannot express that; a bottom
         rootMargin can, and costs the browser nothing. */
      { threshold: 0, rootMargin: '0px 0px -12% 0px' }
    );

    for (var i = 0; i < targets.length; i++) io.observe(targets[i]);
  }

  arm();

  /* A resize or a rotation across the breakpoint arms it if it was not armed
     before. It never disarms: `.is-inview` is a finished state, and taking it
     away at 1024px would un-reveal content that is already being read. */
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', arm);
  else if (typeof mq.addListener === 'function') mq.addListener(arm);
})();
