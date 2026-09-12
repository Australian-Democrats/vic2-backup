/* "The Citizens' Chamber" experience (template: experience-parliament).
   Progressive enhancement only — the page is complete without this file:
   the full policy text renders, and the chamber shows today's system as a
   static seat block. This script adds the hemicycle layout, the three-system
   interactivity, the heading rail, counters, reveals and the progress beam.
   All decorative motion is disabled under prefers-reduced-motion; the
   interactive controls keep working (state changes apply instantly). */
(function () {
  'use strict';

  var page = document.getElementById('pxPage');
  if (!page) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Section rail, built from the page's own headings ------------------ */
  var rail = document.getElementById('pxRail');
  var heads = [];
  var chamberH = document.getElementById('chamber-h');
  if (chamberH) heads.push(chamberH);
  page.querySelectorAll('.px-sec h2, .px-prose h2').forEach(function (h) { heads.push(h); });
  if (rail && heads.length) {
    heads.forEach(function (h, i) {
      if (!h.id) {
        h.id = 'px-' + (h.textContent || 's' + i).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      }
      var a = document.createElement('a');
      a.href = '#' + h.id;
      // strip leading "1. " style numbering for the pill label
      a.textContent = (h.textContent || '').replace(/^\s*\d+\.\s*/, '').trim();
      rail.appendChild(a);
    });
    rail.hidden = false;
  }
  var railLinks = rail ? [].slice.call(rail.querySelectorAll('a')) : [];
  var currentHead = -1;

  /* ---- The chamber -------------------------------------------------------- */
  // Illustrative seat mixes: the *direction* of the Parliament of Victoria
  // inquiry options and the Guardian's modelling — lower quota, more voices.
  var MODES = {
    regions: {
      quota: 16.7,
      mix: { a: 15, b: 14, c: 8, i: 3 },
      people: 17,
      peopleCap: '≈ 17 of every 100 voters in a region, to elect one member',
      note: 'Eight regions of five seats. A new voice needs 16.7% of a region — roughly one voter in six — so almost every seat stays with the two big blocs.',
    },
    state40: {
      quota: 2.4,
      mix: { a: 13, b: 11, c: 11, i: 5 },
      people: 2,
      peopleCap: '≈ 2 of every 100 voters statewide, to elect one member',
      note: "One statewide contest for all 40 seats. A new voice needs just 2.4% of Victoria — the inquiry's Option 1, and by far the most-supported reform.",
    },
    state20: {
      quota: 4.8,
      mix: { a: 14, b: 12, c: 9, i: 5 },
      people: 5,
      peopleCap: '≈ 5 of every 100 voters statewide, to elect one member',
      note: "Statewide voting, but only 20 of the 40 seats each election, on eight-year terms. Quota 4.8% — the inquiry's Option 2.",
    },
  };
  var ORDER = ['a', 'i', 'c', 'b']; // left → right across the hemicycle

  var arc = document.getElementById('pxArc');
  var seats = arc ? [].slice.call(arc.querySelectorAll('.px-seat')) : [];
  var quotaEl = document.getElementById('pxQuota');
  var noteEl = document.getElementById('pxNote');
  var peopleEl = document.getElementById('pxPeople');
  var peopleCapEl = document.getElementById('pxPeopleCap');
  var people = peopleEl ? [].slice.call(peopleEl.querySelectorAll('i')) : [];
  var modesEl = document.getElementById('pxModes');
  var quotaShown = 16.7;
  var quotaRaf = null;

  function layoutArc() {
    if (!arc || !seats.length) return;
    var W = arc.clientWidth;
    if (!W) return;
    arc.classList.add('px-arc--live');
    var size = Math.max(12, Math.min(26, W * 0.05));
    var H = W * 0.52;
    arc.style.height = H + 'px';
    var rows = [11, 13, 16];
    var maxR = W / 2 - size;
    var radii = [maxR * 0.55, maxR * 0.78, maxR];
    var pos = [];
    rows.forEach(function (n, r) {
      for (var k = 0; k < n; k++) {
        var ang = Math.PI - (Math.PI * k) / (n - 1); // PI → 0, left → right
        pos.push({
          x: W / 2 + radii[r] * Math.cos(ang) - size / 2,
          y: H - radii[r] * Math.sin(ang) - size / 2,
          ang: ang,
        });
      }
    });
    // Seat order across the chamber: sort positions left→right so party
    // blocs sit together like a real hemicycle.
    pos.sort(function (p, q) { return q.ang - p.ang || p.y - q.y; });
    seats.forEach(function (s, i) {
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.transform = 'translate(' + pos[i].x.toFixed(1) + 'px,' + pos[i].y.toFixed(1) + 'px)';
    });
  }

  function seatClasses(mix) {
    var list = [];
    ORDER.forEach(function (key) {
      for (var n = 0; n < mix[key]; n++) list.push('s-' + key);
    });
    return list;
  }

  function tweenQuota(target) {
    if (!quotaEl) return;
    if (quotaRaf) cancelAnimationFrame(quotaRaf);
    if (reduce) { quotaShown = target; quotaEl.textContent = target.toFixed(1); return; }
    var from = quotaShown;
    var start = null;
    var stepFn = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / 700, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      quotaShown = from + (target - from) * eased;
      quotaEl.textContent = quotaShown.toFixed(1);
      if (p < 1) quotaRaf = requestAnimationFrame(stepFn);
    };
    quotaRaf = requestAnimationFrame(stepFn);
  }

  function applyMode(name, animate) {
    var m = MODES[name];
    if (!m) return;
    var classes = seatClasses(m.mix);
    seats.forEach(function (s, i) {
      s.style.transitionDelay = animate && !reduce ? (i * 10) + 'ms' : '0ms';
      s.className = 'px-seat ' + (classes[i] || 's-i');
    });
    people.forEach(function (dot, i) {
      dot.style.transitionDelay = animate && !reduce ? (i * 6) + 'ms' : '0ms';
      dot.classList.toggle('lit', i < m.people);
    });
    if (peopleCapEl) peopleCapEl.textContent = m.peopleCap;
    if (noteEl) noteEl.textContent = m.note;
    tweenQuota(m.quota);
    if (modesEl) {
      modesEl.querySelectorAll('button[data-mode]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-mode') === name ? 'true' : 'false');
      });
    }
  }

  if (modesEl) {
    modesEl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-mode]');
      if (btn) applyMode(btn.getAttribute('data-mode'), true);
    });
  }
  layoutArc();
  applyMode('regions', false);

  /* ---- Figure lightbox (tap to enlarge — works for everyone) ------------- */
  var lbOverlay = null;
  function closeLightbox() {
    if (!lbOverlay) return;
    lbOverlay.remove();
    lbOverlay = null;
    document.removeEventListener('keydown', lbKey);
  }
  function lbKey(e) { if (e.key === 'Escape') closeLightbox(); }
  page.querySelectorAll('.px-sec-body img, .px-prose img').forEach(function (img) {
    img.classList.add('px-zoomable');
    img.setAttribute('title', 'Tap to enlarge');
    img.addEventListener('click', function () {
      closeLightbox();
      lbOverlay = document.createElement('div');
      lbOverlay.className = 'px-lightbox';
      lbOverlay.setAttribute('role', 'dialog');
      lbOverlay.setAttribute('aria-modal', 'true');
      lbOverlay.setAttribute('aria-label', img.alt || 'Enlarged figure');
      var big = document.createElement('img');
      big.src = img.currentSrc || img.src;
      big.alt = img.alt || '';
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'px-lightbox-close';
      close.setAttribute('aria-label', 'Close enlarged figure');
      close.textContent = '✕';
      close.addEventListener('click', closeLightbox);
      lbOverlay.addEventListener('click', function (e) { if (e.target === lbOverlay) closeLightbox(); });
      lbOverlay.appendChild(big);
      lbOverlay.appendChild(close);
      document.body.appendChild(lbOverlay);
      document.addEventListener('keydown', lbKey);
      close.focus();
    });
  });

  /* ---- Reveals + counters (motion only) ----------------------------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    // tag the policy text's content blocks for a staggered reveal: section
    // headers and each direct block of the re-set sections; for the plain
    // fallback article, select blocks directly (the mdoc renderer wraps the
    // body in one node). Paragraphs inside blockquotes ride their parent card.
    page
      .querySelectorAll(
        '.px-sec-head, .px-sec-body > *, ' +
          '.px-prose h2, .px-prose h3, .px-prose p:not(blockquote p), .px-prose blockquote:not(blockquote blockquote), .px-prose ul, .px-prose ol, .px-prose table'
      )
      .forEach(function (el) { el.classList.add('px-reveal'); });
    var revealer = new IntersectionObserver(
      function (entries) {
        var delay = 0;
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          el.style.transitionDelay = delay + 'ms';
          el.classList.add('px-in');
          el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
          delay = Math.min(delay + 70, 280);
          revealer.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    page.querySelectorAll('.px-reveal').forEach(function (el) { revealer.observe(el); });

    var ease = function (p) { return 1 - Math.pow(1 - p, 3); };
    var counter = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          counter.unobserve(e.target);
          var el = e.target;
          var target = parseFloat(el.getAttribute('data-target'));
          if (!isFinite(target)) return;
          var start = null;
          var stepFn = function (ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / 1100, 1);
            el.textContent = String(Math.round(target * ease(p)));
            if (p < 1) requestAnimationFrame(stepFn);
          };
          requestAnimationFrame(stepFn);
        });
      },
      { threshold: 0.6 }
    );
    page.querySelectorAll('.px-num[data-target]').forEach(function (n) { counter.observe(n); });
  }

  /* ---- Scroll loop: progress beam + rail spy ------------------------------
     Scroll-time work is compositor-only by construction. Two rules:

     1. NEVER measure geometry inside a scroll frame. Document height,
        viewport height, each heading's document-space top and each rail
        pill's position are measured ONCE in measure(), off the scroll path,
        and re-measured only when the page can genuinely have changed size
        (resize / late images / font swap). The frame reads one cheap value
        (window.scrollY), does arithmetic, then writes — a strict
        read-then-write order, so a scroll frame can never force a
        synchronous layout. Previously the frame read
        document.documentElement.scrollHeight plus getBoundingClientRect()
        for every heading AFTER writing the beam's transform, forcing a full
        style+layout pass on every single frame.

     2. NEVER call Element.scrollIntoView() to keep the current rail pill in
        view. The rail is sticky inside the document's scroll-padding-top
        band (global.css `html { scroll-padding-top: calc(var(--header-h) +
        1rem) }`), so the browser "corrected" the DOCUMENT scroll by ~6px
        every time the pill changed — dragging the page backwards mid-
        gesture at every heading. That was the reader's stop-start. The rail
        is its own scroll container: move its scrollLeft instead, which
        cannot reach the page scroller. */
  var bar = document.getElementById('pxProgress');
  var doc = document.documentElement;
  var ticking = false;
  var dirty = true;
  var vh = window.innerHeight || 1;
  var maxScroll = 1;
  var headTops = [];
  var pillPos = [];
  var railW = 0;
  var railMax = 0;
  var railTarget = -1;

  function measure() {
    dirty = false;
    vh = window.innerHeight || 1;
    maxScroll = Math.max(doc.scrollHeight - vh, 1);
    var y = window.pageYOffset;
    headTops = heads.map(function (h) { return h.getBoundingClientRect().top + y; });
    if (rail) {
      railW = rail.clientWidth;
      railMax = Math.max(rail.scrollWidth - railW, 0);
      pillPos = railLinks.map(function (a) { return [a.offsetLeft, a.offsetWidth]; });
    }
  }

  // Horizontal-only: the rail's own scroller, never the page's.
  function centreRailPill(i) {
    if (!rail || i < 0 || !pillPos[i] || railMax <= 0) return;
    var left = Math.max(0, Math.min(pillPos[i][0] - (railW - pillPos[i][1]) / 2, railMax));
    if (Math.abs(left - railTarget) < 1) return;
    railTarget = left;
    if (rail.scrollTo) rail.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
    else rail.scrollLeft = left;
  }

  function frame() {
    ticking = false;
    if (dirty) measure();
    // ---- read phase (no geometry APIs below this line) ----
    // rail spy: the last heading above 45% of the viewport is current
    var y = window.pageYOffset;
    var line = y + vh * 0.45;
    var active = -1;
    for (var i = 0; i < headTops.length; i++) {
      if (headTops[i] < line) active = i; else break;
    }
    // ---- write phase ----
    if (bar && !reduce) bar.style.transform = 'scaleX(' + Math.min(y / maxScroll, 1).toFixed(4) + ')';
    if (active !== currentHead) {
      currentHead = active;
      for (var j = 0; j < railLinks.length; j++) {
        if (j === active) railLinks[j].setAttribute('aria-current', 'true');
        else railLinks[j].removeAttribute('aria-current');
      }
      centreRailPill(active);
    }
  }
  function queue() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function invalidate() { dirty = true; queue(); }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { layoutArc(); invalidate(); }, { passive: true });
  window.addEventListener('load', invalidate);
  if ('ResizeObserver' in window) {
    // Catches late-loading images and the font swap changing the page height.
    try { new ResizeObserver(invalidate).observe(document.body); } catch (e) { /* older engines */ }
  }
  queue();
})();
