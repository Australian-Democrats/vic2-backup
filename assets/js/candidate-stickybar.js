/* Candidate profile — the sticky mini-header.
   A slim identity bar (square photo · name · seat) that pins directly under the
   site menu once the hero has scrolled away.

   Rules it keeps, all of them deliberate:
   · The markup ships with the `hidden` attribute, so with JavaScript off there
     is no bar at all — nothing to mis-position, nothing to cover content.
   · It pins UNDER the site menu: --cand-mini-top is measured from #site-header
     at run time (never hard-coded), and its z-index is below the header's, so
     the phone menu drops down OVER it.
   · Short viewports never get one. Below SHORT_VP the bar is not rendered at
     all: a 56px bar under a 68px menu eats a quarter of a 500px screen, which
     is worse than no reminder.
   · While it is showing, html.cand-mini-on adds scroll-padding-top, so anchor
     jumps and keyboard focus land clear of it rather than underneath it.
   · It holds nothing focusable and is aria-hidden — every word in it is
     already the <h1> and the identity statement — so it adds no tab stop and
     no duplicate announcement.

   No scroll listener: an IntersectionObserver on the hero's name decides when
   the bar is wanted. Its own file, because candidates-motion.js is at its byte
   cap. No inline script bodies — the CSP has no 'unsafe-inline'. */
(function () {
  'use strict';

  var SHORT_VP = 600; /* px of viewport height below which no bar is built. */

  var bar = document.getElementById('candMini');
  if (!bar) return;
  var anchor = document.querySelector('#candProfile .cand-name');
  var header = document.getElementById('site-header');
  var root = document.documentElement;
  var wanted = false; /* the hero has scrolled away */
  var built = false;

  function tall() {
    return (window.innerHeight || root.clientHeight || 0) >= SHORT_VP;
  }

  /* --cand-mini-h is published as soon as we know a bar WILL be built, not
     when it first becomes visible: `scroll-margin-top` on the profile's anchor
     targets is read at the moment of the jump, which is usually before the
     hero has scrolled away. Setting it late would land every anchor under a
     bar that arrives a moment later. 56px is the bar's own min-height; the
     real measurement replaces it once there is something to measure. */
  function measure() {
    var h = header ? Math.round(header.getBoundingClientRect().height) : 68;
    root.style.setProperty('--cand-mini-top', h + 'px');
    if (!tall()) {
      root.style.removeProperty('--cand-mini-h');
      return;
    }
    var bh = built ? Math.round(bar.getBoundingClientRect().height) : 0;
    root.style.setProperty('--cand-mini-h', (bh || 56) + 'px');
  }

  function apply() {
    var on = wanted && tall();
    if (on && !built) {
      built = true;
      bar.hidden = false;
      /* Let the browser lay it out before the transition starts. */
      window.requestAnimationFrame(function () {
        measure();
        bar.classList.add('is-on');
        root.classList.add('cand-mini-on');
      });
      return;
    }
    if (on) {
      bar.hidden = false;
      bar.classList.add('is-on');
      root.classList.add('cand-mini-on');
      measure();
    } else {
      bar.classList.remove('is-on');
      root.classList.remove('cand-mini-on');
      if (!tall()) bar.hidden = true;
      measure();
    }
  }

  measure();

  if (anchor && 'IntersectionObserver' in window) {
    /* The bar is wanted exactly while the name is above the fold's top edge —
       i.e. once the visitor has scrolled past the hero's own name. */
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          wanted = !en.isIntersecting && en.boundingClientRect.top < 0;
          apply();
        });
      },
      { rootMargin: '-8px 0px 0px 0px', threshold: 0 }
    );
    io.observe(anchor);
  }

  window.addEventListener('resize', function () { measure(); apply(); }, { passive: true });
})();
