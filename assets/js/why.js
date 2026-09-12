/* Audit-circle geometry. The CSS already guarantees that each ellipse
   encloses its figure exactly; this only re-cuts the viewBox to the box's
   own aspect ratio so the hand-drawn wobble is never stretched. Runs for
   everyone, including prefers-reduced-motion and IntersectionObserver-less
   browsers — geometry is not motion, so it sits ABOVE the guard below. */
(function () {
  'use strict';
  var d = document;
  function loop(w) {
    var cx = w / 2, cy = 28, rx = w / 2 - 5, ry = 22;
    var n = 36, span = Math.PI * 2 * 1.08, a0 = Math.PI * 0.88, p = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, a = a0 + span * t;
      var k = 1 + 0.034 * Math.sin(t * 18.85 + 1.2) + 0.021 * Math.sin(t * 34.6 + 0.4);
      var g = 1 - 0.05 * t;                       /* the loop closes just inside itself */
      p.push([+(cx + Math.cos(a) * rx * k * g).toFixed(1),
              +(cy + Math.sin(a) * ry * k * g).toFixed(1)]);
    }
    var s = 'M' + p[0][0] + ' ' + p[0][1];
    for (var j = 1; j < n; j++) {
      s += 'Q' + p[j][0] + ' ' + p[j][1] + ' ' +
           (+((p[j][0] + p[j + 1][0]) / 2).toFixed(1)) + ' ' +
           (+((p[j][1] + p[j + 1][1]) / 2).toFixed(1));
    }
    return s + 'L' + p[n][0] + ' ' + p[n][1];
  }
  function fit() {
    d.querySelectorAll('.wy-circ').forEach(function (svg) {
      var r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var path = svg.querySelector('path');
      if (!path) return;
      var vw = Math.max(64, Math.min(360, Math.round(56 * r.width / r.height)));
      if (svg.getAttribute('data-vw') !== String(vw)) {
        svg.setAttribute('data-vw', vw);
        svg.setAttribute('viewBox', '0 0 ' + vw + ' 56');
        path.setAttribute('d', loop(vw));
      }
      /* The draw's dash length, measured — NOT declared via pathLength.
         The path carries vector-effect="non-scaling-stroke", so the dash is
         resolved in SCREEN px while getTotalLength() reports USER units; a
         pathLength-normalised dash therefore fell short of the rendered
         stroke by exactly the viewBox scale factor and the loop never closed
         above 860px. Publishing len × scale (an upper bound: the largest of
         the two axis scales, never below 1) makes one dash cover the whole
         stroke at every width and in either resolution space. Recomputed on
         every pass — the box changes with the font swap and on resize even
         when the aspect, and so the viewBox, does not. */
      var len = path.getTotalLength ? path.getTotalLength() : 0;
      if (len) {
        var scale = Math.max(1, r.width / vw, r.height / 56);
        path.style.setProperty('--wy-dash', (Math.ceil(len * scale) + 8) + 'px');
      }
    });
  }
  fit();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(fit);
  var t;
  addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 150); }, { passive: true });
})();

/* CINEMATIC LEDGER (/why) motion controller.
   Progressive enhancement only — the page is complete static HTML without
   this file; everything here is disabled under prefers-reduced-motion.
   Zero scroll listeners, zero rAF loops: the tape-feed is CSS position:
   sticky, everything else is IntersectionObserver one-shots plus CSS
   transition-delay sequencing. The stamp beats are timed here so the rail
   ticks / register rolls land exactly with each slam. */
(function () {
  'use strict';

  var w = window, d = document;
  if (w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in w)) return;

  d.documentElement.classList.add('js-motion');

  var body = d.body;
  var compact = w.matchMedia('(max-width: 1099px)').matches; /* register instead of rail */
  var phone = w.matchMedia('(max-width: 859px)').matches;    /* sticky tear-tab */

  /* --- press pass (fonts gated, capped 350ms; spot-colour beat at +850ms) -- */
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    body.classList.add('is-loaded');
    setTimeout(function () {
      body.classList.add('is-spot');
      var hl = d.querySelector('.wy-mast .hl');
      if (hl) hl.classList.add('hl-in');
    }, 850);
  }
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(load);
  setTimeout(load, 350);

  /* --- the tally fixtures: audit rail (desktop) / register strip (mobile) -- */
  function railMark(key, cls) {
    var a = d.querySelector('.wy-rail a[data-rail="' + key + '"]');
    if (a) a.classList.add(cls);
  }
  /* HOW MANY ITEMS THE AUDIT HAS — counted from the rail, never assumed.
     The strip is a tally: "0 /4" with four ticks. Four is not a constant of
     this page, it is however many remedy items the whyPage singleton holds,
     and an editor adding a fifth or dropping to three would have left a
     counter that could never reach its own denominator — a fixture stating a
     number the page cannot deliver. The rail is server-rendered from the same
     `items` array in both renderings (full-screen acts AND the classic tape),
     so it is the one place both modes agree. */
  var itemCount = d.querySelectorAll('.wy-rail a[data-rail^="item"]').length || 4;
  var reg = null, regN = 0, regCol = null, regTicks = null;
  if (compact) {
    reg = d.createElement('div');
    /* It STARTS hidden. Below 1100px the strip is `position: fixed; top: 0`
       over a page whose own first line is the dateline in the printer slot —
       measured on a fresh 390×844 load: 14.1px of an 18.4px line covered, 77%
       of it, so a phone reader's first impression of the page was a counter
       reading "0 /4" with the line that says what the page is underneath it.
       Nothing reserves the strip's height (it must not push the mast down), so
       the fix is to not paint it until the mast has gone. */
    reg.className = 'wy-reg is-out';
    reg.setAttribute('aria-hidden', 'true');
    var digits = '', pips = '';
    for (var ri = 0; ri <= itemCount; ri++) digits += '<span>' + ri + '</span>';
    for (var pi = 0; pi < itemCount; pi++) pips += '<i></i>';
    reg.innerHTML =
      '<span class="wy-reg-o"><span class="wy-reg-col">' + digits + '</span></span>' +
      '<span class="wy-reg-of">/' + itemCount + '</span>' +
      '<span class="wy-reg-ticks">' + pips + '</span>';
    /* FIRST in the body, not last. The strip carries the mobile audit-index
       button (see the index block at the foot of this file), and a fixed
       control that paints at the TOP of the viewport must not be the LAST
       thing in the tab order: measured at 390×844 it was focus stop 22 of 22,
       after the entire footer, while the desktop rail it stands in for is
       stops 2–8. It is position: fixed, so moving it changes no layout.
       After the skip link, so "Skip to content" stays the first stop. */
    var skip = d.querySelector('.skip-link');
    if (skip && skip.parentNode === body) body.insertBefore(reg, skip.nextSibling);
    else body.insertBefore(reg, body.firstChild);
    regCol = reg.querySelector('.wy-reg-col');
    regTicks = reg.querySelectorAll('.wy-reg-ticks i');

    /* Reveal it once the masthead has left the viewport. An anchor/bfcache
       arrival below the mast gets the observer's first callback with
       isIntersecting false, so the strip is there immediately — as it should
       be, because the dateline is not on screen to be covered. */
    var mast = d.querySelector('.wy-mast');
    if (mast) {
      var mo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) return;
          reg.classList.remove('is-out');
          mo.disconnect();
        });
      }, { threshold: 0 });
      mo.observe(mast);
    } else {
      reg.classList.remove('is-out');
    }
  }
  function regRoll(n) {
    if (!reg || n <= regN) return;
    /* Clamped to the denominator the strip actually prints: the odometer
       column only holds 0…itemCount ems, so a larger n would scroll it past
       its last digit and show blank. */
    if (n > itemCount) n = itemCount;
    if (n <= regN) return;
    regN = n;
    regCol.style.translate = '0 ' + -n + 'em';
    for (var i = 0; i < n; i++) if (regTicks[i]) regTicks[i].classList.add('is-on');
  }

  /* Bridge to why-acts.js: the acts are scroll-progress driven and carry no
     data-zone, so they tick the rail/register here. The WHOLE interface
     between the two files — do not grow it. */
  w.wyLedger = { markItem: function (n) { railMark('item' + n, 'is-done'); regRoll(n); } };

  /* The register strip is a POSITION indicator, so it advances when the reader
     ENTERS an act, not when they finish it. Driven from completion it read
     "2 /4" while the kicker three lines below said "ITEM 03 / 04" — two
     different numbers for the same section, for the whole of every act. It
     stays monotonic (regRoll early-returns on n <= high-water) because it is
     also the audit tally: items are counted once, never uncounted. */
  if (reg) {
    var actSecs = d.querySelectorAll('.wy-act[data-n]');
    if (actSecs.length) {
      var eo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) regRoll(+entry.target.getAttribute('data-n'));
        });
      }, { threshold: 0, rootMargin: '-25% 0px -25% 0px' });
      actSecs.forEach(function (s) { eo.observe(s); });
    }
  }

  /* --- THE EARNED STAMP.
         The page's closing gesture is the reader's, not the page's. It used to
         be neither: the static markup shipped a <button> with nothing bound to
         it when JS was off, and with JS on the slip's own cut() stamped the box
         ~950ms after the tear zone appeared — so by the time the box was on
         screen it was already stamped, aria-disabled and out of the tab order.
         Measured at 1440×900: a click test could not even run, Playwright
         reporting "element is not enabled" on 55 retries.
         Now: the markup ships a <span>, already stamped (the honest finished
         object with no JS); this upgrades it to a real, un-stamped button; and
         the only automatic stamp watches a marker BELOW the authorisation
         plate, i.e. it can only land once there is nothing left to read. An
         automatic stamp does not disable the control — only the reader's own
         tap retires it. --- */
  var pay = d.getElementById('wyPayBox');
  if (pay && pay.tagName !== 'BUTTON') {
    var real = d.createElement('button');
    /* EVERY attribute, not just class/id. why.astro's box is styled from its
       SCOPED <style> block, so its rules are `.wy-ownerbox[data-astro-cid-…]`
       — a hand-built element without that attribute inherits none of them and
       the box collapsed from 70.4px square to 24.4 × 33.2. Copy first, then
       add what only a button needs. */
    for (var ai = 0; ai < pay.attributes.length; ai++) {
      real.setAttribute(pay.attributes[ai].name, pay.attributes[ai].value);
    }
    real.type = 'button';
    real.setAttribute('aria-label', 'Vote 1 Australian Democrats');
    real.innerHTML = pay.innerHTML;
    pay.parentNode.replaceChild(real, pay);
    pay = real;
  }
  function stampIt(byUser) {
    if (!pay || pay.classList.contains('wy-stamped')) return;
    pay.classList.add('wy-stamped');
    /* Only a TAP retires the control. Its one job is done: the caption has
       faded out and stampIt() early-returns from here on, so leaving it in the
       tab order would park a focus ring on what now reads as decoration.
       tabindex/aria only — never `disabled`, which some UAs repaint. */
    if (byUser) {
      pay.setAttribute('tabindex', '-1');
      pay.setAttribute('aria-disabled', 'true');
    }
    if (navigator.vibrate) navigator.vibrate(10);
  }
  if (pay) {
    pay.classList.remove('wy-stamped');
    pay.addEventListener('click', function () { stampIt(true); });
    var endStop = d.getElementById('wyEndStop');
    if (endStop) {
      /* The marker sits past the last line, but the box is only ~250px above
         it, so at max scroll the box is still mid-screen (measured: it is on
         screen for the last 350px at 1440×900, 500px at 390×844). ARRIVAL
         therefore must not stamp — the backstop waits out a dwell and any move
         away cancels it, so the reader's own tap always gets there first and a
         page left at the end still settles into the finished object. */
      var hold = 0;
      var po = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { clearTimeout(hold); hold = 0; return; }
          if (hold) return;
          hold = setTimeout(function () { stampIt(false); po.disconnect(); }, 2200);
        });
      }, { threshold: 0 });
      po.observe(endStop);
    }
  }

  /* --- zones: sections print via CSS delays; JS times the stamp slams ------ */
  var slamAt = { charge: 1400, item: 1100, recon: 1500 };

  function slam(zone, kind) {
    var stamp = zone.querySelector('.wy-stamp');
    if (stamp) {
      stamp.style.willChange = 'transform';
      stamp.classList.add('is-slammed');
      setTimeout(function () { stamp.style.willChange = ''; }, 600);
    }
    zone.classList.add('is-slammed');
    if (kind === 'charge') {
      railMark('charge', 'is-done');
    } else if (kind === 'item') {
      var n = +zone.getAttribute('data-n');
      railMark('item' + n, 'is-done');
      regRoll(n);
    } else if (kind === 'recon') {
      railMark('recon', 'is-done');
      regRoll(itemCount);
      if (reg) setTimeout(function () { reg.classList.add('is-out'); }, 1500);
    }
  }

  function cut(zone, instant) {
    var line = zone.querySelector('.wy-cutline');
    if (line) line.style.setProperty('--cutw', (line.clientWidth - 26) + 'px');
    zone.classList.add('is-cut');
    /* The slip comes free; the BOX is not touched. Stamping it here is what
       spent the reader's gesture for them — the cut zone contains the box, so
       it fired the moment the slip appeared. */
    if (instant) zone.classList.add('is-freed');
    else setTimeout(function () { zone.classList.add('is-freed'); }, 950);
  }

  /* The audit loops must SETTLE as complete ellipses — identical to the
     JS-off page. The dash is sized to cover the whole stroke (see fit()), and
     this drops it entirely once the last circle has drawn, so no measurement
     error, font swap or resize mid-draw can leave an open "C" behind.
     transitionend is the primary trigger; the timer is the backstop for the
     cases transitionend cannot fire (instant/bfcache arrivals, a zone whose
     transition is suppressed by .is-instant). */
  function settleCircles(zone, instant) {
    var paths = zone.querySelectorAll('.wy-circ path');
    if (!paths.length) return;
    var done = function () { zone.classList.add('is-drawn'); };
    if (instant) { done(); return; }
    paths[paths.length - 1].addEventListener('transitionend', function (e) {
      if (e.propertyName === 'stroke-dashoffset') done();
    });
    /* last row's delay ((rows + 1) × 120ms + 300ms) + the 450ms draw + slack */
    var rows = zone.querySelectorAll('.wy-crow').length;
    setTimeout(done, (rows + 1) * 120 + 300 + 450 + 250);
  }

  function enterZone(zone, instant) {
    if (!zone || zone.classList.contains('in-zone')) return;
    zone.classList.add('in-zone');
    if (instant) zone.classList.add('is-instant');
    var kind = zone.getAttribute('data-zone');
    if (kind === 'charge') settleCircles(zone, instant);
    if (kind === 'cut') { cut(zone, instant); return; }
    if (kind === 'recon') {
      var hl = zone.querySelector('.hl');
      if (hl) setTimeout(function () { hl.classList.add('hl-in'); }, instant ? 0 : 1250);
    }
    if (instant) slam(zone, kind);
    else setTimeout(function () { slam(zone, kind); }, slamAt[kind] || 1000);
  }

  /* DISCONTINUOUS ARRIVALS PRINT AT ONCE.
     A zone entered by scrolling starts printing while it is still below the
     fold, so it is finished by the time the reader is looking at it. A zone
     entered by a JUMP — a scrollbar drag, find-in-page, a fragment link,
     bfcache — starts printing with the reader already parked on it, and the
     ~2s sequence plays out on a near-empty screen. Measured at 390×844, an
     instant scrollTo(15,600): 15.9% of rows painted with a 469px empty band,
     unchanged at 900ms and only resolved by 4s.
     One passive listener, and it reads nothing but scrollY — no layout, no
     rAF, nothing on the paint path. The threshold is 1.5 viewports between
     consecutive scroll events, which no wheel, thumb or flick can produce
     (that would be ~76,000px/s at 390×844); the natural entries measured on
     this page arrive 248–580px below the fold. */
  var zones = d.querySelectorAll('[data-zone]');
  var lastY = w.scrollY || 0, jumpUntil = 0, settleT = 0;
  addEventListener('scroll', function () {
    var y = w.scrollY || 0;
    if (Math.abs(y - lastY) > w.innerHeight * 1.5) jumpUntil = Date.now() + 400;
    lastY = y;
    clearTimeout(settleT);
    settleT = setTimeout(settle, 500);
  }, { passive: true });

  /* THE SETTLE NET — a zone can come to REST on screen and below the observer's
     0.3 ratio, and then it never prints.
     Measured on this build at 1440×900: come to rest at scrollY 16,875 and the
     reconciliation panel (top 17,635, height 583) has its first 140px on
     screen, so its intersection ratio is 0.24 — under the threshold. Its
     kicker `#wyReconH` "The bottom line" is FULLY inside the viewport at
     y=760 and stays `clip-path: inset(0 100% 0 0)`, i.e. a blank line where a
     heading should be, at +300ms, +900ms, +2,000ms and +3,000ms. It is the one
     state on the page that does not resolve itself: every other truncated
     frame the sweeps found clears within 900ms.
     Raising the threshold's sensitivity would move every zone's entry point
     and retune the storytelling, which is not what a defect this narrow is
     worth. This instead waits for the reader to STOP (500ms after the last
     scroll event, so nothing runs on the scroll path — the listener above only
     resets a timer) and then prints, at once, any zone that has a line sitting
     wholly on screen with nothing drawn in it. `enterZone` early-returns on
     `in-zone`, so a zone the observer has already taken is untouched. */
  function settle() {
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (z.classList.contains('in-zone')) continue;
      var ps = z.querySelectorAll('[data-p]');
      for (var j = 0; j < ps.length; j++) {
        var r = ps[j].getBoundingClientRect();
        /* Animated, not instant. The reader here is parked on the TOP of the
           panel, not dropped into the middle of it by a jump — so letting it
           print in sequence in front of them is the designed gesture, not a
           delay. (The reconciliation's five typed lines are the page's closing
           beat; snapping them would spend it for nothing.) It costs about a
           second more than an instant completion and still bounds a frame that
           previously never resolved at all. */
        if (r.height > 0 && r.top >= 0 && r.bottom <= w.innerHeight) { enterZone(z, false); break; }
      }
    }
  }

  var zo = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      enterZone(entry.target, Date.now() < jumpUntil);
      zo.unobserve(entry.target);
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
  zones.forEach(function (z) {
    /* Self-init: zones already scrolled past (anchor/bfcache arrivals)
       complete instantly, so the rail/register never miscount. */
    if (z.getBoundingClientRect().bottom < 60) enterZone(z, true);
    else zo.observe(z);
  });

  /* Keyboard rescue: focus landing inside a not-yet-printed zone completes
     it at once — no focus stop ever rests on clipped content. */
  d.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && t.closest) enterZone(t.closest('[data-zone]'), true);
  });

  /* --- .hl sweeps (items; masthead + reconciliation run on their beats) --- */
  var ho = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('hl-in');
      ho.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  d.querySelectorAll('.hl').forEach(function (el) {
    if (el.closest('.wy-mast') || el.closest('.wy-term')) return;
    ho.observe(el);
  });

  /* --- audit rail current-entry tab (desktop, viewport-middle band) ------- */
  if (!compact) {
    var cur = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var on = d.querySelector('.wy-rail a.is-current');
        if (on) on.classList.remove('is-current');
        railMark(entry.target.getAttribute('data-rail-sec'), 'is-current');
      });
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    d.querySelectorAll('[data-rail-sec]').forEach(function (s) { cur.observe(s); });
  }

  /* --- sticky mobile tear-tab: IntersectionObservers only, no scroll listener
         The pill is opaque and pinned to the right gutter, and below 860px the
         tape is full-bleed — so wherever it shows, it shows ON TOP of the
         ledger/docket VALUE column, i.e. the page's payload. Two rules now
         hold it honest:
           1. it is only ever shown when NOTHING readable is under it. A third
              observer shrinks its root, via an all-negative rootMargin, to
              exactly the pill's own rectangle and watches every text-bearing
              block on the page; one intersection and the pill stays away.
              Hiding is immediate, showing waits out a short settle so the pill
              cannot strobe as text scrolls through its corner.
           2. the document reserves its footprint (--wy-tab-space), so nothing
              — least of all the authorisation end-plate — can come to rest
              underneath it at the end of the page. */
  if (phone) {
    var tab = d.createElement('a');
    tab.className = 'wy-teartab btn btn--primary';
    /* Mirrors whichever CTA carries the primary fill — which is the how-to-vote
       button only while the cards are actually published (see why.astro's
       htvLive). The pill must never be the page's loudest link to a holding
       page that says "not ready yet". */
    var lead =
      d.querySelector('.wy-cta-row .btn--primary') ||
      d.querySelector('[data-testid="why-cta-htv"]');
    tab.href = (lead && lead.getAttribute('href')) || '/join';
    tab.textContent = (lead && lead.textContent.trim()) || 'Join the Democrats';
    body.appendChild(tab);

    var root = d.documentElement;
    var reserve = function () {
      var h = tab.offsetHeight;
      var inset = parseFloat(w.getComputedStyle(tab).bottom) || 0;
      if (h) root.style.setProperty('--wy-tab-space', Math.ceil(h + inset * 2) + 'px');
    };
    reserve();

    var charge = d.getElementById('wyCharge');
    var tear = d.getElementById('wyTear');
    var clear = true, band = true, showTimer = 0;

    /* Hiding is immediate and ALWAYS cancels a pending show — a show that is
       still counting down when text arrives under the pill must not land. */
    function paint() {
      if (!(band && clear)) {
        clearTimeout(showTimer); showTimer = 0;
        tab.classList.remove('is-on');
        return;
      }
      if (showTimer || tab.classList.contains('is-on')) return;
      /* 600ms, not 350. An instant jump-scroll (anchor, rail click, a settled
         QA sweep) can resolve a pending SHOW before the occlusion observer has
         re-reported for the new position — measured once in a 43-stop sweep as
         the pill sitting on top of "The bottom line" for a beat before the
         observer corrected it. The settle has to outlast the observer's first
         callback after a discontinuous scroll. */
      showTimer = setTimeout(function () {
        showTimer = 0;
        if (band && clear) tab.classList.add('is-on');
      }, 600);
    }

    /* The pill's own rectangle, from the used values — it is measurable even
       while hidden (visibility: hidden still lays out; translate does not
       change offsetWidth/offsetHeight). */
    function pillMargin(pad) {
      var cs = w.getComputedStyle(tab);
      var right = parseFloat(cs.right) || 0;
      var bottom = parseFloat(cs.bottom) || 0;
      var bw = tab.offsetWidth, bh = tab.offsetHeight;
      var top = w.innerHeight - bottom - bh;
      var left = w.innerWidth - right - bw;
      return [
        -(top - pad), -(right - pad), -(bottom - pad), -(left - pad),
      ].map(function (n) { return Math.round(n) + 'px'; }).join(' ');
    }

    var TEXT =
      '.wy-h1, .wy-lede, .wy-cue, .wy-h2, .wy-para, .wy-kicker, .wy-crow,' +
      '.wy-sources, .wy-stamp, .wy-docket-title, .wy-dline, .wy-policy-link,' +
      '.wy-term-kicker, .wy-rrow, .wy-recon-total, .wy-slip, .wy-end,' +
      /* the acts: picture and controls are payload too */
      '.wy-act-caption,.wy-stage-fit,.wy-attempts,.wy-modes,.wy-quota-out,.wy-chips';
    var oo = null;
    function watchOcclusion() {
      if (oo) oo.disconnect();
      var under = new Set();
      oo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) under.add(e.target);
          else under.delete(e.target);
        });
        clear = under.size === 0;
        paint();
      }, { rootMargin: pillMargin(8), threshold: 0 });
      d.querySelectorAll(TEXT).forEach(function (el) { oo.observe(el); });
    }
    watchOcclusion();

    if (charge && tear) {
      var to = new IntersectionObserver(function () {
        var past = charge.getBoundingClientRect().bottom < 0;
        var at = tear.getBoundingClientRect().top < w.innerHeight;
        band = past && !at;
        paint();
      });
      to.observe(charge);
      to.observe(tear);
    }

    var rt;
    addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { reserve(); watchOcclusion(); }, 150);
    }, { passive: true });
  }
})();

/* ======================================================================
   THE AUDIT INDEX — in-page navigation below 1100px.

   The desktop rail (nav.wy-rail) is display:none under 1100px, which is
   every phone AND a 1440px desktop at 200% zoom, and the register strip
   that replaces it is a position counter: aria-hidden, zero anchors. So
   this document — 17,289px, 20.5 viewports at 390×844 — shipped with the
   skip link as its only in-page anchor. No way between the four items, no
   way back to the charge sheet, no way back to the top.

   This turns the strip into the trigger for a jump list built FROM THE
   RAIL'S OWN ANCHORS, so the phone index and the desktop rail can never
   drift apart, and there is no second copy of the section names.

   It sits OUTSIDE the motion controller's reduced-motion guard on purpose:
   navigation is not motion (same reasoning as the audit-circle geometry at
   the top of this file). A reader on reduced motion has no register strip
   to enhance, so they get their own identical 24px trigger bar.

   Jumps are plain fragment links — they work with the panel open or from
   the keyboard — and each one MOVES FOCUS to the section it lands on. That
   is the correct behaviour for an in-page link anyway, and here it also
   drives the motion controller's existing `focusin` rescue, so a jump can
   never come to rest on a zone that has not printed yet.
   ====================================================================== */
(function () {
  'use strict';
  var d = document, w = window;

  var rail = d.querySelector('.wy-rail');
  if (!rail) return;
  var railLinks = rail.querySelectorAll('a[href^="#"]');
  if (!railLinks.length) return;

  /* --- the panel, from the rail --- */
  var menu = d.createElement('nav');
  menu.className = 'wy-index';
  menu.id = 'wyIndexMenu';
  menu.hidden = true;
  menu.setAttribute('aria-label', 'Audit index');
  menu.setAttribute('data-testid', 'why-index-menu');

  function row(href, mark, label, key, fullLabel) {
    var a = d.createElement('a');
    a.href = href;
    a.setAttribute('data-testid', 'why-index-' + key);
    if (fullLabel) a.setAttribute('aria-label', fullLabel);
    var b = d.createElement('b');
    b.setAttribute('aria-hidden', 'true');
    b.textContent = mark;
    var s = d.createElement('span');
    s.textContent = label;
    a.appendChild(b);
    a.appendChild(s);
    menu.appendChild(a);
    return a;
  }

  row('#main', '↑', 'Top of the page', 'top');
  railLinks.forEach(function (a) {
    var full = a.getAttribute('aria-label') || a.textContent.trim();
    /* "Item 03 / 04 — Cost of living" → "Cost of living": the chip beside it
       already carries the number, and the anchor keeps the full label as its
       accessible name. */
    var parts = full.split(' — ');
    var short = parts.length > 1 ? parts[parts.length - 1] : full;
    var mark = (a.querySelector('span') || a).textContent.trim();
    var link = row(a.getAttribute('href'), mark, short.charAt(0).toUpperCase() + short.slice(1), a.getAttribute('data-rail') || mark, full);
    link.setAttribute('data-rail-row', a.getAttribute('data-rail') || '');
  });
  /* --- the trigger: the register strip if the motion layer built one, else
         a bar of our own (reduced motion / no IntersectionObserver) --- */
  var strip = d.querySelector('.wy-reg');
  var btn = d.createElement('button');
  btn.type = 'button';
  btn.className = 'wy-reg-btn';
  btn.id = 'wyIndexBtn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'wyIndexMenu');
  btn.setAttribute('aria-label', 'Audit index — jump to a section');
  btn.setAttribute('data-testid', 'why-index-toggle');

  if (strip) {
    /* Move the counter and ticks INTO the button — same nodes, so the
       controller's cached references to them keep working. The strip stops
       being aria-hidden (it now holds a real control); the readout inside it
       is the part that is decorative to a screen reader. */
    while (strip.firstChild) {
      var node = strip.firstChild;
      if (node.nodeType === 1) node.setAttribute('aria-hidden', 'true');
      btn.appendChild(node);
    }
    strip.removeAttribute('aria-hidden');
    strip.appendChild(btn);
  } else {
    var bar = d.createElement('div');
    bar.className = 'wy-index-bar';
    bar.appendChild(btn);
    /* Same courtesy the register strip gets: an opaque strip at top:0 covers
       the dateline in the printer slot on first paint (measured at 390×844:
       14.1px of an 18.4px line), so it does not paint until the masthead has
       gone. An arrival already below the mast gets it immediately.
       A CLASS, not `style.visibility`: the bar holds the only in-page
       navigation a reduced-motion phone reader has, and a visibility-hidden
       control cannot be tabbed to at all. `.is-out` is opacity + pointer-events
       only, and why-base.css paints it in full on :focus-within — so the ring
       is always visible where it lands (WCAG 2.4.7), exactly as on the
       register strip. */
    var mast = d.querySelector('.wy-mast');
    if (mast && typeof IntersectionObserver === 'function') {
      bar.className = 'wy-index-bar is-out';
      var bo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) return;
          bar.classList.remove('is-out');
          bo.disconnect();
        });
      }, { threshold: 0 });
      bo.observe(mast);
    }
    /* Same placement rule as the register strip: a fixed control at the top of
       the viewport belongs at the top of the tab order, after the skip link. */
    var skipL = d.querySelector('.skip-link');
    if (skipL && skipL.parentNode === d.body) d.body.insertBefore(bar, skipL.nextSibling);
    else d.body.insertBefore(bar, d.body.firstChild);
  }
  /* The panel goes immediately AFTER its trigger, so tabbing out of the last
     row lands on the page rather than at the end of the document. */
  var trigHost = strip || btn.parentNode;
  if (trigHost && trigHost.parentNode) trigHost.parentNode.insertBefore(menu, trigHost.nextSibling);
  else d.body.appendChild(menu);
  var cue = d.createElement('span');
  cue.className = 'wy-index-cue';
  cue.setAttribute('aria-hidden', 'true');
  cue.textContent = 'Index';
  /* Before the tick row, which is right-anchored (margin-left: auto). */
  btn.insertBefore(cue, btn.querySelector('.wy-reg-ticks'));

  /* --- open / close --- */
  var open = false;

  /* ---- HIDE-ON-SCROLL: winning the 24px back ------------------------------
     The trigger bar is `position: fixed; top: 0` over a 15,000–17,500px
     document, so on a phone it sits on top of body copy for a third to a half
     of every resting position (measured on this build, sampling every 40px and
     counting only positions where it is actually painted: 154 of 343 at
     360×640, 144 of 396 at 390×844). Four rounds recorded that and correctly
     declined to fix it with paint — a fixed overlay cannot be answered by
     reserving space, because the document scrolls under it by definition.
     The only real answer is to not be there while the reader is reading.

     So: retract on the way DOWN, come back on the way UP. Down is reading;
     up is looking for the index, which is the only thing this bar carries.
     It also comes back near the top of the document, whenever the panel is
     open, and whenever it holds the keyboard ring (CSS :focus-within) — so it
     is never unreachable, and the tab stop never moves.

     A DATA ATTRIBUTE, not a class: the retirement watcher below observes this
     same element with attributeFilter: ['class'], and a class toggled on every
     scroll reversal would fire it hundreds of times per read.

     THRESH stops jitter (a 1px rubber-band must not flip the bar), and TOP is
     "close enough to the top that retracting reads as broken". */
  var HID_THRESH = 8, HID_TOP = 200;
  var hidden = false, lastY = w.scrollY || w.pageYOffset || 0, hidTick = false;
  var hidHost = strip || (btn.parentNode && btn.parentNode.classList.contains('wy-index-bar') ? btn.parentNode : null);
  /* Truth is the ATTRIBUTE, not a cached boolean: `hidden` is only a cheap
     read, so anything else that ever needs to reveal the bar can simply drop
     the attribute and this stays in step instead of silently disagreeing. */
  function setHidden(next) {
    if (!hidHost || next === hidHost.hasAttribute('data-hid')) return;
    hidden = next;
    if (next) hidHost.setAttribute('data-hid', '');
    else hidHost.removeAttribute('data-hid');
  }
  if (hidHost) {
    addEventListener('scroll', function () {
      if (hidTick) return;
      hidTick = true;
      requestAnimationFrame(function () {
        hidTick = false;
        var y = w.scrollY || w.pageYOffset || 0;
        var dy = y - lastY;
        if (Math.abs(dy) < HID_THRESH) return;
        lastY = y;
        /* Never retract out from under an open panel or a focused control. */
        if (open || hidHost.contains(d.activeElement)) { setHidden(false); return; }
        setHidden(dy > 0 && y > HID_TOP);
      });
    }, { passive: true });
    /* A jump from the index lands with focus on the target section, i.e. NOT
       inside the bar, and the browser's own scroll to the fragment is a single
       large downward delta — which would retract the bar the moment the reader
       arrives somewhere new. Show it on arrival instead; the next real scroll
       decides from there. */
    addEventListener('hashchange', function () { lastY = w.scrollY || 0; setHidden(false); });
  }

  function place() {
    /* The STRIP's bottom, not the button's. The strip carries a 2px yellow
       bottom rule and the button sits inside the ink above it, so anchoring to
       the button would slide the panel up over the rule and the trigger and
       the panel would stop reading as one object. */
    var r = (btn.parentNode && btn.parentNode.getBoundingClientRect ? btn.parentNode : btn).getBoundingClientRect();
    menu.style.setProperty('--wy-index-top', Math.max(0, Math.round(r.bottom)) + 'px');
  }
  function setOpen(next, restoreFocus) {
    if (next === open) return;
    open = next;
    btn.setAttribute('aria-expanded', String(next));
    if (next) {
      /* The panel hangs off the trigger's bottom edge, so the trigger has to
         be where the reader can see it before place() measures it. */
      setHidden(false);
      place();
      menu.hidden = false;
      markCurrent();
      var first = menu.querySelector('a');
      if (first) first.focus();
    } else {
      menu.hidden = true;
      if (restoreFocus) btn.focus();
    }
  }
  btn.addEventListener('click', function () { setOpen(!open, false); });

  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false, true); }
  });
  d.addEventListener('pointerdown', function (e) {
    if (!open) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    setOpen(false, false);
  });

  /* --- the jump: close, then hand focus to the section itself --- */
  menu.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var target = d.getElementById(a.getAttribute('href').slice(1));
    setOpen(false, false);
    if (!target) return;
    /* The browser still performs the fragment navigation (and the CSS
       scroll-margin-top keeps the landing clear of the strip). This only
       moves FOCUS there, which is what makes the jump work for a keyboard
       or screen-reader user — and it is what completes an unprinted zone,
       via the controller's focusin handler, before the reader sees it. */
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    setTimeout(function () { target.focus({ preventScroll: true }); }, 0);
  });

  /* --- which row the reader is in: the same section markers the desktop
         rail uses, so the two stay in step with no second source. --- */
  function markCurrent() {
    var cur = null, best = -Infinity;
    d.querySelectorAll('[data-rail-sec]').forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= w.innerHeight * 0.5 && r.top > best) { best = r.top; cur = s.getAttribute('data-rail-sec'); }
    });
    menu.querySelectorAll('a[data-rail-row]').forEach(function (a) {
      a.classList.toggle('is-current', !!cur && a.getAttribute('data-rail-row') === cur);
      if (a.classList.contains('is-current')) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  /* Park focus on the section under the reader's eye. Used when the panel has
     to close from underneath the keyboard (see the retirement observer). */
  function focusCurrentSection() {
    var cur = null, best = -Infinity;
    d.querySelectorAll('[data-rail-sec]').forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= w.innerHeight * 0.5 && r.top > best) { best = r.top; cur = s; }
    });
    if (!cur) cur = d.getElementById('main');
    if (!cur) return;
    if (!cur.hasAttribute('tabindex')) cur.setAttribute('tabindex', '-1');
    cur.focus({ preventScroll: true });
  }

  /* The strip is faded out over the masthead, and RETIRED once the audit is
     reconciled (why.js's recon slam: the register has counted 4 of 4, so it
     stands down for the tear-off). Two consequences to handle:
       1. a panel hanging off an invisible trigger would be orphaned — close it;
       2. the retirement is permanent, so a reader who reaches the end and
          then scrolls back up to re-read had no index again, which is the
          dead end this whole block exists to close. So: once the reader is
          back ABOVE the reconciliation, the strip comes back. The tear-off
          keeps its clean finish; the audit keeps its navigation. */
  if (strip && typeof MutationObserver === 'function') {
    var revealed = false, retired = false;
    new MutationObserver(function () {
      var out = strip.classList.contains('is-out');
      if (!out) { revealed = true; retired = false; return; }
      if (revealed) retired = true;
      if (open) {
        /* Closing while the reader's ring is INSIDE the panel would drop
           document.activeElement to <body>, so the next Tab restarts at the
           top of a 17,000px document — the exact dead end this block exists to
           close. The trigger is going away (`.wy-reg.is-out` is
           visibility: hidden, so it is no longer focusable), so hand focus to
           the section the reader is actually looking at instead. */
        var held = menu.contains(d.activeElement);
        setOpen(false, false);
        if (held) focusCurrentSection();
      }
    }).observe(strip, { attributes: true, attributeFilter: ['class'] });

    /* Watch the sections ABOVE the reconciliation, not the reconciliation
       itself: an IntersectionObserver only reports threshold CROSSINGS, and a
       reader who jumps from the end back up to item 2 never crosses the recon
       boundary — measured, the strip stayed retired and its trigger stayed
       pointer-events:none. Any earlier section coming back into view is the
       unambiguous signal that the reader is re-reading. */
    if (typeof IntersectionObserver === 'function') {
      var back = new IntersectionObserver(function (entries) {
        if (!retired) return;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            retired = false;
            strip.classList.remove('is-out');
            return;
          }
        }
      }, { threshold: 0 });
      d.querySelectorAll('[data-rail-sec]').forEach(function (s) {
        var k = s.getAttribute('data-rail-sec');
        if (k !== 'recon' && k !== 'tear') back.observe(s);
      });
    }
  }
  addEventListener('resize', function () { if (open) place(); }, { passive: true });
})();
