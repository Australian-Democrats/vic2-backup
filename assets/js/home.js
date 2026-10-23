/* Home page: stats-band animations.
   The HTML is server-rendered as the FINAL state, so no-JS, crawler and
   prefers-reduced-motion visitors always see the finished numbers. Motion-
   capable visitors get the show:
     · "1,000+" rewinds and counts to 500 ("members needed for VEC
       registration"), pops through the target and climbs to 1,000+ —
       "growing more by the day — join today".
     · "2026" rewinds to 1977 ("the year the Democrats were founded"),
       then rolls forward to 2026 — "the year the Democrats returned". */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var ease = function (p) { return 1 - Math.pow(1 - p, 3); };

  function tween(el, from, to, dur, fmt, done) {
    var start = null;
    var step = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = fmt(Math.round(from + (to - from) * ease(p)));
      if (p < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  // The rewind used to happen when the band scrolled into view, which meant
  // the SSR figure was painted first and then visibly JUMPED BACKWARDS —
  // "1,200+" → "373" → climb. Priming runs at script execution instead, before
  // the observer can fire and before first paint, so the number only ever goes
  // up. The server-rendered markup keeps the final value for no-JS, crawlers
  // and reduced motion (which return above this line).
  function prime(el) {
    var label = el.parentElement ? el.parentElement.querySelector('span') : null;
    var state = {
      label: label,
      finalNum: el.textContent,
      finalLabel: label ? label.innerHTML : '',
    };
    if (el.hasAttribute('data-act1')) {
      el.classList.remove('stat-glow');
      if (label) label.textContent = el.getAttribute('data-act1-label') || '';
      el.textContent = el.hasAttribute('data-group') ? (0).toLocaleString('en-AU') : '0';
    } else if (el.hasAttribute('data-target')) {
      el.textContent = '0' + (el.getAttribute('data-suffix') || '');
    }
    return state;
  }

  function playTwoAct(el, state) {
    var label = state.label;
    var finalNum = state.finalNum;
    var finalLabel = state.finalLabel;
    var act1 = parseInt(el.getAttribute('data-act1'), 10);
    var act2 = parseInt(el.getAttribute('data-act2'), 10);
    var suffix = el.getAttribute('data-act2-suffix') || '';
    var group = el.hasAttribute('data-group');
    var fmt = function (n) { return group ? n.toLocaleString('en-AU') : String(n); };

    tween(el, 0, act1, 1000, fmt, function () {
      setTimeout(function () {
        // The break-through: pop, light the highlighter, climb to the real number.
        el.classList.add('stat-pop', 'stat-glow');
        // The label swaps HERE, at the START of act 2 — not in the tween's
        // completion callback. Swapping at the end left act 1's label sitting
        // under act 2's numbers for the whole 900ms climb, which rendered
        // statements that were simply false: "2026 — the year the Democrats
        // were founded" (it was 1977), and a members figure climbing past
        // 1,100 under "members needed for VEC registration" (the Act requires
        // 500). Measured at 884ms and 900ms of false copy per load.
        if (label) {
          label.innerHTML = finalLabel;
          label.classList.add('label-swap');
        }
        tween(el, act1, act2, 900, function (n) { return fmt(n) + suffix; }, function () {
          el.textContent = finalNum;
        });
      }, 850);
    });
  }

  function playSimple(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    tween(el, 0, target, 1200, function (n) { return n + suffix; });
  }

  var nums = document.querySelectorAll('.stat-num');
  if (!nums.length) return;
  var primed = new Map();
  nums.forEach(function (n) { primed.set(n, prime(n)); });
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.hasAttribute('data-act1')) playTwoAct(e.target, primed.get(e.target));
        else playSimple(e.target);
      });
    },
    { threshold: 0.5 }
  );
  nums.forEach(function (n) { io.observe(n); });
})();

/* Hero + focus-block slideshows (Keystatic: "Hero slideshow" / "Focus section
   media"). Progressive enhancement only: the first slide/entry is server-
   rendered visible, extra hero layers carry their photo in data-bg (never
   downloaded without JS), and everything stays static under reduced motion. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /* The hero media is already display:none under reduced motion, but the
       item-0 video keeps its `autoplay` attribute in the markup so the JS-off
       case still works. Stand it down here so "no motion" is literally true
       and an invisible video never burns battery. Appearance is unchanged —
       the element is not rendered either way. */
    var offs = document.querySelectorAll('.hero-modern video');
    for (var i = 0; i < offs.length; i++) {
      try {
        offs[i].autoplay = false;
        offs[i].pause();
      } catch (e) {}
    }
    return;
  }
  var PERIOD = 6000; // ~6s per slide; the cross-fade itself is CSS.

  /* Hero playback. Item 0 is the section's own background photo plus the
     optional hero video; items 1..n are the .hero-modern-slide layers (a photo
     in data-bg, or a src-less <video data-src>). The mode comes from
     data-hero-end on the hero video (Keystatic → "When the hero video
     finishes"):
       loop  — the browser's own `loop` attribute does it; nothing here runs
               (`ended` never fires on a looping video);
       hold  — play once, then freeze on the final frame;
       cycle — play once, then advance; videos play out, photos dwell ~6s,
               and the rotation wraps back round to the hero video.
     A photo-only slideshow (no hero video) uses the same rotator, which
     additionally pauses off-screen and when the tab is hidden.
     Everything here is progressive enhancement behind the file's
     prefers-reduced-motion early return above. Declared as hoisted functions
     because show() and arm() call each other. */
  function heroPlayback() {
    var hero = document.querySelector('.hero-modern');
    if (!hero) return;
    var hv = hero.querySelector('.hero-modern-video');
    var mode = hv ? hv.getAttribute('data-hero-end') || 'loop' : 'loop';
    var layers = Array.prototype.slice.call(hero.querySelectorAll('.hero-modern-slide'));

    // HOLD — and CYCLE with nothing to cycle to, which is the same thing.
    if (hv && (mode === 'hold' || (mode === 'cycle' && !layers.length))) {
      hv.addEventListener('ended', function () {
        // Freeze on the final frame. NEVER call load() and NEVER set
        // currentTime = 0: either repaints the poster. Dropping the poster
        // attribute makes a flash-back impossible even if the UA tries.
        hv.removeAttribute('poster');
        try {
          hv.currentTime = Math.max(0, (hv.duration || 0) - 0.05);
        } catch (e) {}
        hv.pause();
      });
    }

    // Rotation: CYCLE with layers, or the photo slideshow (no hero video).
    if (!layers.length || (hv && mode !== 'cycle')) return;

    var at = 0; // 0 = the base item (hero video / hero photo)
    var total = layers.length + 1;
    var timer = null;
    var paused = false;

    function layerVideo(i) {
      return i === 0 ? hv : layers[i - 1].querySelector('video');
    }
    function stopTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    // Preloading discipline: ONLY the next item is ever fetched, one ahead,
    // once. Nothing beyond item 0 is fetched without JS at all.
    function prime(i) {
      var j = i % total;
      if (j === 0) return; // item 0 is already in the document
      var l = layers[j - 1];
      var v = l.querySelector('video');
      if (v) {
        if (!v.getAttribute('src') && v.getAttribute('data-src')) {
          v.src = v.getAttribute('data-src');
          v.preload = 'auto';
          v.load();
        }
      } else if (!l.style.backgroundImage && l.getAttribute('data-bg')) {
        l.style.backgroundImage = "url('" + l.getAttribute('data-bg') + "')";
      }
    }
    function arm(ms) {
      stopTimer();
      if (!paused) timer = setTimeout(function () { show(at + 1); }, ms);
    }
    function show(next) {
      var prev = layerVideo(at);
      if (prev) prev.pause();
      stopTimer();
      at = next % total;
      // The cross-fade itself is CSS (.hero-modern-slide{transition:opacity}).
      layers.forEach(function (l, i) { l.classList.toggle('is-active', i === at - 1); });
      prime(at + 1);
      var v = layerVideo(at);
      if (v) {
        try { v.currentTime = 0; } catch (e) {}
        var p = v.play();
        // Autoplay refused (rare for muted video) → treat this item as a still.
        if (p && p.catch) p.catch(function () { arm(PERIOD); });
      } else {
        arm(PERIOD); // a photo: dwell, then advance
      }
    }

    // Videos advance on `ended`; photos advance on the timer.
    for (var i = 0; i < total; i++) {
      (function (v) {
        if (v) v.addEventListener('ended', function () { if (!paused) show(at + 1); });
      })(layerVideo(i));
    }
    prime(1);
    if (!hv) arm(PERIOD); // photo-only slideshow: start the clock

    // Battery: never play or advance while the tab is hidden or the hero is
    // off screen. Pause only — never skip — so a returning visitor doesn't
    // find the rotation five items further on.
    function setPaused(p) {
      if (p === paused) return;
      paused = p;
      var v = layerVideo(at);
      if (p) {
        stopTimer();
        if (v) v.pause();
      } else if (v) {
        var q = v.play();
        if (q && q.catch) q.catch(function () {});
      } else {
        arm(PERIOD);
      }
    }
    document.addEventListener('visibilitychange', function () { setPaused(document.hidden); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        function (es) {
          es.forEach(function (e) { setPaused(document.hidden || !e.isIntersecting); });
        },
        { threshold: 0 }
      ).observe(hero);
    }
  }
  heroPlayback();

  // Focus block: fade between .hm-focus-item layers, waking/pausing any videos.
  var items = Array.prototype.slice.call(document.querySelectorAll('.hm-focus-item'));
  if (items.length > 1) {
    var at = 0;
    setInterval(function () {
      var prev = items[at];
      at = (at + 1) % items.length;
      var next = items[at];
      prev.classList.remove('is-active');
      next.classList.add('is-active');
      var pv = prev.querySelector('video');
      if (pv) pv.pause();
      var nv = next.querySelector('video');
      if (nv) {
        if (nv.preload === 'none') nv.preload = 'metadata';
        var played = nv.play();
        if (played && played.catch) played.catch(function () {});
      }
    }, PERIOD);
  }
})();
