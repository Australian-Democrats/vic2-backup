/* Motion layer: highlighter sweeps, scroll reveals, reading progress.
   Progressive enhancement only — the page is fully usable without this file,
   and everything is disabled under prefers-reduced-motion. */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  // Opt the page into the motion styles only once JS is definitely running,
  // so content is never hidden for no-JS visitors or crawlers.
  document.documentElement.classList.add('js-motion');

  // --- .hl highlighter sweep on first view --------------------------------
  var hlObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('hl-in');
          hlObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  document.querySelectorAll('.hl').forEach(function (el) { hlObserver.observe(el); });

  // --- card / person / stat rise-ins, gently staggered per batch ----------
  var riseObserver = new IntersectionObserver(
    function (entries) {
      var delay = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('in-view');
        el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
        delay = Math.min(delay + 70, 280);
        riseObserver.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
  );
  document.querySelectorAll('.post-card, .post-feature, .card, .person, .stat').forEach(function (el) {
    riseObserver.observe(el);
  });

  // --- reading progress bar ------------------------------------------------
  // The document height is measured OFF the scroll path. Reading
  // document.documentElement.scrollHeight inside the scroll frame forces a
  // synchronous layout on EVERY frame (measured on /policies/housing at 4x CPU
  // throttle: 60 reads / ~83ms of forced layout across one full-page scroll).
  // It is re-measured on resize, on load, and whenever the body's box actually
  // changes — late-loading images, the font swap.
  var bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  var dirty = true;
  var max = 1;
  var measure = function () {
    dirty = false;
    max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  };
  var update = function () {
    ticking = false;
    if (dirty) measure();
    bar.style.transform = 'scaleX(' + Math.min(window.pageYOffset / max, 1) + ')';
  };
  var queue = function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  var invalidate = function () { dirty = true; queue(); };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  window.addEventListener('load', invalidate);
  if ('ResizeObserver' in window) {
    try { new ResizeObserver(invalidate).observe(document.body); } catch (e) { /* older engines */ }
  }
  queue();
})();
