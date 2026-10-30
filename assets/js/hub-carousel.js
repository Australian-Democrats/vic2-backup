/* Sideways rows (ADR-73): the /candidates lower-house carousel and a
   candidate profile's photo slideshow ([data-hub-carousel]). The track is the
   poster rail: a plain sideways scroller with scroll-snap, complete with
   JavaScript off (swipe, trackpad, Shift+wheel all move it). This script adds
   what the box asks for:

   · data-shuffle — a fresh order on every visit (Fisher–Yates), done before
     candidates-hub.js runs (it is loaded first), so "Our order", a cleared
     search and the postcode finder all put each card back where THIS visit
     showed it. The built page keeps the editor's order for no-JS readers.
   · Back / Next ([data-hub-carousel-arrows]) — shown only while the visible
     cards do not all fit; aria-disabled (never `disabled`, so focus is not
     dropped) at either end; never hidden while one of them has focus.
   · data-view + "Show all" ⇄ "Show one at a time" — phones only: the same
     cards as a plain list, and back. The editor picks how phones open it.
   · data-autoplay — on phones the row moves along by itself, one card every
     5s, back to the start after the last. Only with the page's motion on
     (html.js-motion + [data-cand-motion]) and no reduced-motion preference;
     only while it is on screen and the tab is visible; never in the list
     view. Pause / Play is the WCAG 2.2.2 stop control, and the row pauses for
     good the moment the reader touches, focuses or steers it — they can
     Play it again.

   What fits comes from an IntersectionObserver rooted on the track (the only
   thing that updates the buttons, so a card coming back is never counted from
   a stale reading). Tabbing to a half-shown card brings it fully into view.
   No scroll, resize or touch listeners; one timer. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return;
  var mq = function (q) {
    return window.matchMedia ? matchMedia(q) : { matches: false, addEventListener: function () {} };
  };
  var rm = mq('(prefers-reduced-motion: reduce)');
  var phone = mq('(max-width: 699px)');
  var slice = function (l) { return Array.prototype.slice.call(l); };
  var listen = function (m, fn) {
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  };

  slice(document.querySelectorAll('[data-hub-carousel]')).forEach(function (box) {
    var track = box.querySelector('[data-hub-carousel-track]');
    var nav = box.querySelector('[data-hub-carousel-nav]');
    var prev = box.querySelector('[data-hub-carousel-prev]');
    var next = box.querySelector('[data-hub-carousel-next]');
    if (!track || !nav || !prev || !next) return;
    var arrows = box.querySelector('[data-hub-carousel-arrows]') || nav;
    var viewBtn = box.querySelector('[data-hub-carousel-view]');
    var viewLabel = viewBtn && viewBtn.querySelector('[data-hub-carousel-view-label]');
    var playBtn = box.querySelector('[data-hub-carousel-play]');
    var playLabel = playBtn && playBtn.querySelector('[data-hub-carousel-play-label]');

    // ---- A fresh order on every visit ----
    if (box.hasAttribute('data-shuffle')) {
      var kids = slice(track.children);
      for (var i = kids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = kids[i]; kids[i] = kids[j]; kids[j] = t;
      }
      // Out first, then back in the new order: moving the card the row is
      // snapped to would make scroll-snap follow it to its new place (the
      // row would open at its far end).
      kids.forEach(function (k) { track.removeChild(k); });
      kids.forEach(function (k, n) {
        track.appendChild(k);
        // The reveal stagger follows the new order too.
        slice(k.querySelectorAll('[style*="--ci"]')).forEach(function (el) { el.style.setProperty('--ci', String(Math.min(n, 4))); });
      });
      track.scrollLeft = 0;
    }

    var ratio = new Map(); // card → how much of it the track shows
    var ready = false;
    function cards() {
      return slice(track.children).filter(function (c) { return !c.hidden; });
    }
    function whole(c) { return (ratio.get(c) || 0) >= 0.97; }
    function isList() { return box.getAttribute('data-view') === 'list' && phone.matches; }
    function motionOn() {
      return document.documentElement.classList.contains('js-motion') && !!box.closest('[data-cand-motion]') && !rm.matches;
    }

    // ---- Auto-advance (phones) ----
    var auto = box.hasAttribute('data-autoplay') && !!playBtn;
    var paused = false; // the reader paused it (or took the wheel)
    var onScreen = false;
    var timer = null;
    var fits = true;
    function canRun() {
      return auto && ready && !paused && onScreen && !document.hidden && phone.matches && motionOn() && !isList() && !fits;
    }
    function setPaused(p) {
      paused = p;
      if (playBtn) {
        playBtn.setAttribute('data-state', p ? 'paused' : 'playing');
        if (playLabel) playLabel.textContent = playLabel.getAttribute(p ? 'data-play' : 'data-pause') || '';
      }
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      timer = canRun() ? setTimeout(tick, 5000) : null;
    }
    function tick() {
      timer = null;
      if (!canRun()) return;
      var list = cards();
      if (list.length && whole(list[list.length - 1])) track.scrollTo({ left: 0, behavior: 'smooth' });
      else step(1);
      schedule();
    }

    function update() {
      if (!ready) return; // nothing changes on screen before the first report
      var list = cards();
      var atStart = !list.length || whole(list[0]);
      var atEnd = !list.length || whole(list[list.length - 1]);
      fits = atStart && atEnd;
      var holding = arrows.contains(document.activeElement);
      arrows.hidden = (fits || isList()) && !holding;
      prev.setAttribute('aria-disabled', String(atStart));
      next.setAttribute('aria-disabled', String(atEnd));
      if (playBtn) playBtn.hidden = !(auto && phone.matches && motionOn() && !isList() && !fits) && !(holding && playBtn === document.activeElement);
      if (viewBtn) viewBtn.hidden = !phone.matches;
      nav.hidden = arrows.hidden && (!viewBtn || viewBtn.hidden) && !nav.contains(document.activeElement);
      if (atEnd) box.removeAttribute('data-more');
      else box.setAttribute('data-more', '');
      schedule();
    }

    // The first report says what fits; until then nothing changes on screen.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { ratio.set(en.target, en.isIntersecting ? en.intersectionRatio : 0); });
      ready = true;
      box.setAttribute('data-ready', '');
      update();
    }, { root: track, threshold: [0, 0.5, 0.97, 1] });
    function watch() { slice(track.children).forEach(function (c) { io.observe(c); }); }
    // Cards hidden by a search, or moved out by a sort and back: re-observe
    // (observing twice is a no-op); the observer's own report then recounts.
    new MutationObserver(watch).observe(track, { childList: true });
    watch();
    nav.addEventListener('focusout', function () { requestAnimationFrame(update); });
    listen(phone, update);
    listen(rm, update);

    // Is the row on screen? (Moving it while nobody can see it helps no one.)
    new IntersectionObserver(function (entries) {
      onScreen = entries[entries.length - 1].intersectionRatio >= 0.4;
      schedule();
    }, { threshold: 0.4 }).observe(box);
    document.addEventListener('visibilitychange', schedule);

    function step(dir) {
      var list = cards();
      if (!list.length) return;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var by = list[0].getBoundingClientRect().width + gap;
      track.scrollBy({ left: dir * by, behavior: rm.matches ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { setPaused(true); if (prev.getAttribute('aria-disabled') !== 'true') step(-1); });
    next.addEventListener('click', function () { setPaused(true); if (next.getAttribute('aria-disabled') !== 'true') step(1); });
    if (playBtn) playBtn.addEventListener('click', function () { setPaused(!paused); });
    // The reader takes the wheel: a touch, click or keyboard focus in the row.
    track.addEventListener('pointerdown', function () { if (!paused) setPaused(true); });

    // Tab onto a card the row only half shows: line its start up with the
    // row's (instantly — the reader asked for that card, not for motion).
    track.addEventListener('focusin', function (e) {
      if (!paused) setPaused(true);
      var card = e.target;
      while (card && card.parentNode !== track) card = card.parentNode;
      if (!card || whole(card) || isList()) return;
      var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      track.scrollBy({ left: card.getBoundingClientRect().left - track.getBoundingClientRect().left - pad, behavior: 'auto' });
    });

    // ---- "Show all" ⇄ "Show one at a time" (phones) ----
    function setView(v) {
      box.setAttribute('data-view', v);
      if (viewLabel) viewLabel.textContent = viewLabel.getAttribute(v === 'list' ? 'data-row' : 'data-list') || '';
      if (viewBtn) viewBtn.setAttribute('data-state', v);
      if (v === 'list') track.scrollTo({ left: 0, behavior: 'auto' });
      update();
    }
    if (viewBtn) {
      viewBtn.addEventListener('click', function () {
        setView(box.getAttribute('data-view') === 'list' ? 'carousel' : 'list');
      });
      setView(box.getAttribute('data-view') === 'list' ? 'list' : 'carousel');
    }
    setPaused(false);
  });
})();
