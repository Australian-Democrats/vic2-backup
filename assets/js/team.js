/* Our team page behaviour. Progressive enhancement only — the page is
   complete without this file. Staggered reveals for the value and person
   cards, plus a gentle pointer tilt on the person cards (mouse only).
   Everything is disabled under prefers-reduced-motion. */
(function () {
  'use strict';

  var page = document.getElementById('teamPage');
  if (!page) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || !('IntersectionObserver' in window)) return;

  /* ---- Staggered reveals -------------------------------------------------- */
  var revealer = new IntersectionObserver(
    function (entries) {
      var delay = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('tm-in');
        el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
        delay = Math.min(delay + 70, 280);
        revealer.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
  );
  page.querySelectorAll('.tm-reveal').forEach(function (el) { revealer.observe(el); });

  /* ---- Gentle pointer tilt on person cards -------------------------------- */
  page.querySelectorAll('.tm-card').forEach(function (card) {
    card.addEventListener('pointermove', function (ev) {
      if (ev.pointerType !== 'mouse' || !card.classList.contains('tm-in')) return;
      var r = card.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width;
      var py = (ev.clientY - r.top) / r.height;
      card.style.transform =
        'perspective(60rem) rotateX(' + ((0.5 - py) * 2.5).toFixed(2) + 'deg)' +
        ' rotateY(' + ((px - 0.5) * 3).toFixed(2) + 'deg) translateY(-2px)';
    });
    card.addEventListener('pointerleave', function () { card.style.transform = ''; });
  });
})();
