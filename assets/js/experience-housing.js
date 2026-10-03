/* "Home Ground" experience (template: experience-housing).
   Progressive enhancement only — the page is complete without this file:
   the full policy text renders and the pictogram shows the default lens.
   This script pairs the title/body lists into cards, drives the
   hundred-houses lenses, builds the heading rail, and adds counters,
   reveals and the progress beam. Decorative motion is disabled under
   prefers-reduced-motion; the interactive controls keep working. */
(function () {
  'use strict';

  var page = document.getElementById('hxPage');
  if (!page) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Pair title-lists with their explanations into cards --------------- */
  // Sections 02/03: <ul><li><strong>Title</strong></li></ul> + <ul>…</ul>
  // Section 05:     <ol start=N><li><strong>Title</strong></li></ol> + <p>…</p>
  page.querySelectorAll('.hx-sec-body').forEach(function (body) {
    var kids = [].slice.call(body.children);
    var paired = false;
    for (var i = 0; i < kids.length - 1; i++) {
      var a = kids[i];
      var b = kids[i + 1];
      var isTitleList =
        (a.tagName === 'UL' || a.tagName === 'OL') &&
        a.children.length === 1 &&
        a.querySelector(':scope > li > strong');
      if (!isTitleList) continue;
      var wrap = document.createElement('div');
      wrap.className = a.tagName === 'OL' ? 'hx-dir' : 'hx-pair';
      body.insertBefore(wrap, a);
      wrap.appendChild(a);
      if (b && (b.tagName === 'UL' || b.tagName === 'P')) wrap.appendChild(b);
      if (a.tagName === 'OL') {
        var n = document.createElement('span');
        n.className = 'hx-dir-n';
        n.setAttribute('aria-hidden', 'true');
        n.textContent = a.getAttribute('start') || '1';
        wrap.appendChild(n);
      }
      paired = true;
      i++; // skip the consumed sibling
    }
    if (paired) body.classList.add('hx-paired');
  });

  /* ---- Section rail from the page's own headings -------------------------- */
  var rail = document.getElementById('hxRail');
  var heads = [];
  var numbersH = document.getElementById('numbers-h');
  if (numbersH) heads.push(numbersH);
  page.querySelectorAll('.hx-sec h2, .hx-prose h2').forEach(function (h) { heads.push(h); });
  if (rail && heads.length) {
    heads.forEach(function (h, i) {
      if (!h.id) {
        h.id = 'hx-' + (h.textContent || 's' + i).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      }
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = (h.textContent || '').replace(/^\s*\d+\.\s*/, '').trim();
      rail.appendChild(a);
    });
    rail.hidden = false;
  }
  var railLinks = rail ? [].slice.call(rail.querySelectorAll('a')) : [];
  var currentHead = -1;

  /* ---- The hundred houses -------------------------------------------------- */
  // Figures come from the policy's own evidence section (cited there in full).
  var LENSES = {
    empty: {
      big: '100,000',
      cap: 'homes empty or under-used in metro Melbourne',
      note: 'More than double the number of households waiting for social housing — a system that rewards holding homes over housing people. (Prosper Australia, 2024)',
      paint: function (i) { return 'h-dim'; },
    },
    shortfall: {
      big: '16,000 / 80,000',
      cap: 'social homes committed vs needed this decade',
      note: "Each house is a thousand homes: the sector puts the need at 80,000 this decade; the Government's partnership commitment covers 16,000. (Homes Victoria, 2025)",
      paint: function (i) { return i < 16 ? 'h-built' : i < 80 ? 'h-need' : 'h-ghost'; },
    },
    stress: {
      big: '80%+',
      cap: 'of low-income private renters are in rental stress',
      note: 'Rental stress means more than 30% of income going on rent — leaving too little for food, transport and healthcare. (AHURI / Pawson et al., 2024)',
      paint: function (i) { return i < 80 ? 'h-stress' : 'h-dim'; },
    },
  };
  var housesEl = document.getElementById('hxHouses');
  var houses = housesEl ? [].slice.call(housesEl.querySelectorAll('i')) : [];
  var bigEl = document.getElementById('hxBig');
  var capEl = document.getElementById('hxBigCap');
  var noteEl = document.getElementById('hxNote');
  var modesEl = document.getElementById('hxModes');

  function applyLens(name, animate) {
    var lens = LENSES[name];
    if (!lens) return;
    houses.forEach(function (h, i) {
      h.style.transitionDelay = animate && !reduce ? (i * 6) + 'ms' : '0ms';
      h.className = lens.paint(i);
    });
    if (bigEl) bigEl.textContent = lens.big;
    if (capEl) capEl.textContent = lens.cap;
    if (noteEl) noteEl.textContent = lens.note;
    if (modesEl) {
      modesEl.querySelectorAll('button[data-lens]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-lens') === name ? 'true' : 'false');
      });
    }
  }
  if (modesEl) {
    modesEl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-lens]');
      if (btn) applyLens(btn.getAttribute('data-lens'), true);
    });
  }
  applyLens('empty', false);

  /* ---- Figure lightbox (tap to enlarge) ----------------------------------- */
  var lbOverlay = null;
  function closeLightbox() {
    if (!lbOverlay) return;
    lbOverlay.remove();
    lbOverlay = null;
    document.removeEventListener('keydown', lbKey);
  }
  function lbKey(e) { if (e.key === 'Escape') closeLightbox(); }
  page.querySelectorAll('.hx-sec-body img, .hx-prose img').forEach(function (img) {
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

  /* ---- Reveals + counters (motion only) ------------------------------------ */
  if (!reduce && 'IntersectionObserver' in window) {
    page
      .querySelectorAll(
        '.hx-sec-head, .hx-sec-body > *, ' +
          '.hx-prose h2, .hx-prose h3, .hx-prose p:not(blockquote p), .hx-prose blockquote:not(blockquote blockquote), .hx-prose ul, .hx-prose ol, .hx-prose table'
      )
      .forEach(function (el) { el.classList.add('hx-reveal'); });
    var revealer = new IntersectionObserver(
      function (entries) {
        var delay = 0;
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          el.style.transitionDelay = delay + 'ms';
          el.classList.add('hx-in');
          el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
          delay = Math.min(delay + 70, 280);
          revealer.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    page.querySelectorAll('.hx-reveal').forEach(function (el) { revealer.observe(el); });

    var ease = function (p) { return 1 - Math.pow(1 - p, 3); };
    var counter = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          counter.unobserve(e.target);
          var el = e.target;
          var target = parseFloat(el.getAttribute('data-target'));
          if (!isFinite(target)) return;
          var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
          var comma = el.getAttribute('data-format') === 'comma';
          var start = null;
          var stepFn = function (ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / 1100, 1);
            var v = target * ease(p);
            var text = decimals ? v.toFixed(decimals) : String(Math.round(v));
            if (comma) text = Number(text).toLocaleString('en-AU');
            el.textContent = text;
            if (p < 1) requestAnimationFrame(stepFn);
          };
          requestAnimationFrame(stepFn);
        });
      },
      { threshold: 0.6 }
    );
    page.querySelectorAll('.hx-num[data-target]').forEach(function (n) { counter.observe(n); });
  }

  /* ---- Scroll loop: progress beam + rail spy -------------------------------
     Scroll-time work is compositor-only by construction. Two rules:

     1. NEVER measure geometry inside a scroll frame. Document height,
        viewport height, each heading's document-space top and each rail
        pill's position are measured ONCE in measure(), off the scroll path,
        and re-measured only when the page can genuinely have changed size
        (resize / late images / font swap). The frame itself reads one cheap
        value (window.scrollY), does arithmetic, then writes — a strict
        read-then-write order, so a scroll frame can never force a
        synchronous layout. Previously the frame read
        document.documentElement.scrollHeight plus getBoundingClientRect()
        for every heading AFTER writing the beam's transform, forcing a
        full style+layout pass on every single frame.

     2. NEVER call Element.scrollIntoView() to keep the current rail pill in
        view. The rail is sticky inside the document's scroll-padding-top
        band (global.css `html { scroll-padding-top: calc(var(--header-h) +
        1rem) }`), so the browser "corrected" the DOCUMENT scroll by ~6px
        every time the pill changed — dragging the page backwards mid-
        gesture at every heading. That was the reader's stop-start. The rail
        is its own scroll container: move its scrollLeft instead, which
        cannot reach the page scroller. */
  var bar = document.getElementById('hxProgress');
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
  window.addEventListener('resize', invalidate, { passive: true });
  window.addEventListener('load', invalidate);
  if ('ResizeObserver' in window) {
    // Catches late-loading images and the font swap changing the page height.
    try { new ResizeObserver(invalidate).observe(document.body); } catch (e) { /* older engines */ }
  }
  queue();
})();
