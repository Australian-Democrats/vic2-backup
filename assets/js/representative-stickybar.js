/* Representative profile — the sticky mini-header.
   A slim identity bar (square photo · name · office and place) that pins
   directly under the site menu once the hero has scrolled away.

   A port of candidate-stickybar.js with its own ids and custom properties, so
   the two surfaces can never fight over --cand-mini-top / --cand-mini-h. Every
   rule it keeps is deliberate:
   · The markup ships with the `hidden` attribute, so with JavaScript off there
     is no bar at all — nothing to mis-position, nothing to cover content.
   · It pins UNDER the site menu: --rep-mini-top is measured from #site-header
     at run time (never hard-coded), and its z-index is below the header's, so
     the phone menu drops down OVER it.
   · Short viewports never get one. Below SHORT_VP the bar is not built at all:
     a 56px bar under a 68px menu eats a quarter of a 500px screen, which is
     worse than no reminder.
   · While it is showing, html.rep-mini-on adds scroll-padding-top so anchor
     jumps and keyboard focus land clear of it — which matters here more than
     anywhere, because the hero's primary button is an anchor to the contact
     section.
   · It holds nothing focusable and is aria-hidden — every word in it is
     already the <h1> and the identity statement — so it adds no tab stop and
     no duplicate announcement. Do NOT add a Contact button to it.

   No scroll listener: an IntersectionObserver on the hero's name decides when
   the bar is wanted. No inline script bodies — the CSP has no 'unsafe-inline'. */
(function () {
  'use strict';

  var SHORT_VP = 600; /* px of viewport height below which no bar is built. */

  var bar = document.getElementById('repMini');
  if (!bar) return;
  var anchor = document.querySelector('#repProfile .rep-name');
  var header = document.getElementById('site-header');
  var root = document.documentElement;
  var wanted = false; /* the hero has scrolled away */
  var built = false;
  /* The action bar rides the same signal — see applyBar() below. */
  var actionBar = document.getElementById('repBar');

  function tall() {
    return (window.innerHeight || root.clientHeight || 0) >= SHORT_VP;
  }

  /* --rep-mini-h is published as soon as we know a bar WILL be built, not when
     it first becomes visible: `scroll-margin-top` on this page's anchor targets
     is read at the moment of the jump, which is usually before the hero has
     scrolled away. Setting it late would land the "Get help" jump under a bar
     that arrives a moment later. 56px is the bar's own min-height; the real
     measurement replaces it once there is something to measure. */
  function measure() {
    var h = header ? Math.round(header.getBoundingClientRect().height) : 68;
    root.style.setProperty('--rep-mini-top', h + 'px');
    if (!tall()) {
      root.style.removeProperty('--rep-mini-h');
      return;
    }
    var bh = built ? Math.round(bar.getBoundingClientRect().height) : 0;
    root.style.setProperty('--rep-mini-h', (bh || 56) + 'px');
  }

  /* The action bar. Functional UI, never motion-gated: it ships [hidden] and
     its showing state is a class, so with JavaScript off it is absent
     (display:none) and the hero buttons and the closing plate carry contact on
     their own. It rides the same signal as the mini bar — once the hero's own
     buttons have scrolled away — so it can never cover the very buttons it
     duplicates. Unlike the mini bar it is wanted on SHORT viewports too: a
     phone number one tap away matters most on the smallest screen. */
  function applyBar() {
    if (!actionBar) return;
    actionBar.hidden = false;
    actionBar.classList.toggle('is-on', wanted);
  }

  function apply() {
    applyBar();
    var on = wanted && tall();
    if (on && !built) {
      built = true;
      bar.hidden = false;
      /* Let the browser lay it out before the transition starts. */
      window.requestAnimationFrame(function () {
        measure();
        bar.classList.add('is-on');
        root.classList.add('rep-mini-on');
      });
      return;
    }
    if (on) {
      bar.hidden = false;
      bar.classList.add('is-on');
      root.classList.add('rep-mini-on');
      measure();
    } else {
      bar.classList.remove('is-on');
      root.classList.remove('rep-mini-on');
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

  /* No observer available: reveal the action bar rather than leave a phone
     number behind a capability check. The mini bar stays away — it is a
     nicety, the action bar is not. */
  if (!anchor || !('IntersectionObserver' in window)) {
    wanted = true;
    applyBar();
  }

  window.addEventListener('resize', function () { measure(); apply(); }, { passive: true });
})();
