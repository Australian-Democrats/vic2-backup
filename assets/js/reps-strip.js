/* Homepage — the elected-representatives row.
   ===========================================================================
   The server renders ONE run of cards inside a band that scrolls horizontally
   on its own. That is the complete deliverable: every representative, in
   order, reachable, with no JavaScript at all. This file only ever ADDS the
   endless crawl on top of it, and only when all four of these hold:

     1. the reader has not asked for reduced motion;
     2. the site's motion layer is on (html.js-motion, set by effects.js —
        which itself bails under prefers-reduced-motion, so this is the site's
        single animation switch, honoured rather than re-implemented);
     3. there are at least `data-reps-min` cards. A marquee of two reads as a
        bug, not as a queue, so a short row stays a short row at every width;
     4. one run is GENUINELY WIDER than the band. If the row already fits,
        there is nothing to travel and it stays static.

   SEAMLESSNESS IS STRUCTURAL, not measured (ADR-51, the /candidates search
   band). The crawl is exactly -50% of a track made of TWO IDENTICAL RUNS, so
   run 2 lands precisely where run 1 was — no seam, no gap, at any width. The
   clone is an exact copy of the run element, and the inter-card gap is carried
   as each card's own margin-right (never flex `gap`, which would make the
   track two runs PLUS one stray gap and drift half a gap per cycle). Nothing
   here measures a distance and nothing needs resynchronising.

   The clone is aria-hidden and every link inside it is taken out of the tab
   order, so the duplication is invisible to assistive technology and to the
   keyboard. The crawl does not start until the band is first in view, and it
   pauses under a pointer or a focus ring (CSS). */
(function () {
  'use strict';

  var band = document.querySelector('[data-reps-strip]');
  if (!band) return;
  var track = band.querySelector('[data-reps-track]');
  var run = band.querySelector('[data-reps-run]');
  if (!track || !run) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var min = parseInt(band.getAttribute('data-reps-min'), 10);
  if (!(min > 0)) min = 4;
  var count = run.children.length;
  var clone = null;
  var watching = false;

  function motionOn() {
    return !reduce.matches && document.documentElement.classList.contains('js-motion');
  }

  function stop() {
    band.removeAttribute('data-crawl');
    band.classList.remove('is-live');
    if (clone) {
      clone.parentNode.removeChild(clone);
      clone = null;
    }
  }

  function start() {
    if (!clone) {
      clone = run.cloneNode(true);
      clone.removeAttribute('data-reps-run');
      clone.setAttribute('aria-hidden', 'true');
      var links = clone.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) links[i].setAttribute('tabindex', '-1');
      track.appendChild(clone);
    }
    // The band stops scrolling and starts clipping, so any scroll position the
    // reader left behind would show as a permanent offset in the loop.
    band.scrollLeft = 0;
    band.setAttribute('data-crawl', '');
    watch();
  }

  // In view once, then never observed again: re-adding .is-live on every
  // re-entry would restart the crawl from 0 and jump the row.
  function watch() {
    if (watching || band.classList.contains('is-live')) return;
    if (!('IntersectionObserver' in window)) {
      band.classList.add('is-live');
      return;
    }
    watching = true;
    var io = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          band.classList.add('is-live');
          io.disconnect();
          watching = false;
          return;
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(band);
  }

  function measure() {
    if (!motionOn() || count < min) {
      stop();
      return;
    }
    // The run's own width never changes when the clone is appended — the track
    // is `width: max-content` and the clone sits beside it — so this asks the
    // same question whether or not the crawl is already running.
    if (run.offsetWidth > band.clientWidth) start();
    else stop();
  }

  measure();

  var pending = 0;
  function later() {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () {
      pending = 0;
      measure();
    }, 150);
  }
  window.addEventListener('resize', later);
  // A reader who turns reduced motion on mid-visit gets the static row back.
  if (typeof reduce.addEventListener === 'function') reduce.addEventListener('change', measure);
  // Card widths are set in rem and vw, but a late webfont can still change the
  // text block under them; re-measure once the fonts have settled.
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(measure).catch(function () {});
  }
})();
