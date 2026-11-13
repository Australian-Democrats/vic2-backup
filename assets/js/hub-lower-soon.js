/* "Lower-house candidates coming soon" — the ballot draw
   (src/components/HubLowerSoon.astro, src/styles/hub-lower-soon.css, ADR-75).
   The message and the resting paper are plain HTML/CSS, so the block is
   complete without this file. It reveals the one control (shipped `hidden`);
   each press shuffles the paper's rows into a NEW order, the way the VEC draws
   the order of names by lot, and the status line says in words where ours
   landed (the paper itself is aria-hidden, with no numerals). Rows glide to
   their places (FLIP) only with js-motion + [data-cand-motion] + no reduced
   motion; otherwise a draw is an instant reorder. No scroll/resize/touchmove
   listeners, no observers, one timer. */
(function () {
  'use strict';
  var root = document.querySelector('[data-hub-lower-soon]');
  if (!root) return;
  var list = root.querySelector('[data-hls-rows]');
  var btn = root.querySelector('[data-hls-draw]');
  var say = root.querySelector('[data-hls-status]');
  if (!list || !btn || !say) return;
  var rm = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var T = 600; // just past the 0.55s glide in hub-lower-soon.css
  var timer = 0;
  var PLACES = ['at the top of the paper', 'second from the top', 'third from the top', 'fourth from the top'];

  function moving() {
    return document.documentElement.classList.contains('js-motion') &&
      !!root.closest('[data-cand-motion]') && !(rm && rm.matches);
  }
  function rows() { return Array.prototype.slice.call(list.children); }
  function place(i, n) { return i === n - 1 ? 'at the bottom of the paper' : PLACES[i] || 'in the middle of the paper'; }
  function shuffled(a) {
    var b = a.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  function draw() {
    var before = rows();
    var next;
    do { next = shuffled(before); } while (next.every(function (r, i) { return r === before[i]; }));
    var move = moving();
    // Where each row is now (mid-glide included), before it moves.
    var tops = move ? before.map(function (r) { return r.getBoundingClientRect().top; }) : null;
    list.classList.remove('is-drawing');
    next.forEach(function (r) { list.appendChild(r); });
    if (move) {
      next.forEach(function (r) {
        r.style.transform = 'translateY(' + (tops[before.indexOf(r)] - r.getBoundingClientRect().top) + 'px)';
      });
      void list.offsetWidth; // the starting offsets land before the glide starts
      list.classList.add('is-drawing');
      next.forEach(function (r) { r.style.transform = ''; });
      clearTimeout(timer);
      timer = setTimeout(function () { list.classList.remove('is-drawing'); }, T);
    }
    var i = rows().indexOf(list.querySelector('[data-hls-ours]'));
    say.textContent = 'Drawn. This time our candidate is ' + place(i, next.length) + '.';
  }

  btn.addEventListener('click', draw);
  btn.hidden = false;
})();
