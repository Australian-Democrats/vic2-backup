/* Campaign homepage (src/components/home/campaign/CampaignHero.astro).
   Small jobs, and the page is complete without any of them:
   1. The "N days to go" count beside the election date. The page is
      prerendered and cached at the edge, so a count baked into the HTML would
      be wrong by the next morning; it is worked out here, against today's date
      in Melbourne, and stays hidden on and after election day.
   2. ENDING the opening (html.cp-settled) — this script never starts it. The
      opening is decided by campaign-home.css alone, from the first frame the
      browser draws (see its section 6 for why a script cannot safely switch
      it on: this file runs after that first frame). Here it is ended:
        - at once on a second visit to the homepage in the same tab;
        - on the first key press, tap, wheel or scroll, so nobody tabbing to
          a button waits for it;
        - when its last animation finishes, so the page drops to its plain
          resting styles (identical to each animation's final frame).
   3. THE BACKGROUND — photographs only (the owner, November 2026), which
      start moving only once the opening has settled.
        - Computer screens (1024px and up) keep the three-panel contact sheet.
          With three photos all three are on show and nothing moves; with more
          (an editor's choice), ONE panel every four seconds — the one that
          has held its picture longest — cross-fades to the next photo waiting
          its turn. Never under prefers-reduced-motion.
        - Phones are a SLIDESHOW of the photos ticked "Use on phones": a new
          photo every four seconds, its cross-fade included (the owner, 16
          November 2026), and a sideways swipe on the photograph to go on or
          back (touch and pen only; the hero is touch-action: pan-y, so a
          vertical scroll is never taken over, and a swipe never starts on a
          button or link). Nothing on the screen marks which photo is showing
          — the owner took the progress line away. Under
          prefers-reduced-motion it keeps going — it is the only way a phone
          shows the other people — as a calmer, plain dissolve on a six-second
          turn.
        - The Pause button (WCAG 2.2.2) stops either; its choice is
          remembered for the next visit (localStorage, inside try/catch — a
          browser that refuses storage just forgets). On a phone it is not on
          show (the owner asked for no visible Pause): it stays the hero's
          first control for keyboards and screen readers, and CSS draws it
          only while it has focus. On a computer screen it shows only while
          something rotates.
        - It also waits, by itself, while the hero is off-screen, the tab is
          hidden, a finger is on the photograph, or the Get Involved menu is
          open — and carries on afterwards.
   4. GET INVOLVED, the menu its button opens. The menu is a <details> and
      works with JavaScript off; this adds what a details element lacks:
      aria-expanded on the button, Escape (focus back on the button), a tap
      or click anywhere else, and closing once focus has moved on past the
      last item. It also keeps the sheet on the screen: its height is capped
      to the room above the button (it scrolls inside itself beyond that),
      and it stands on the button's right edge instead if it would run off
      the right of the screen. Opening it never moves focus or the page. */
(function () {
  'use strict';

  var root = document.documentElement;

  // --- 1. The countdown ----------------------------------------------------
  var slot = document.querySelector('[data-cp-countdown]');
  var m = slot && /^(\d{4})-(\d{2})-(\d{2})$/.exec(slot.getAttribute('data-election') || '');
  if (m) {
    try {
      var parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne', year: 'numeric', month: 'numeric', day: 'numeric'
      }).formatToParts(new Date());
      var get = function (type) {
        for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return Number(parts[i].value);
        return NaN;
      };
      var today = Date.UTC(get('year'), get('month') - 1, get('day'));
      var poll = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      var days = Math.round((poll - today) / 86400000);
      if (days >= 1) {
        slot.textContent = days === 1 ? '1 day to go' : days + ' days to go';
        slot.hidden = false;
      }
    } catch (e) { /* no Intl time zones: the date alone still reads correctly */ }
  }

  var hero = document.querySelector('.cp');
  if (!hero) return;

  involvedMenu();

  var media = function (q) {
    try { return window.matchMedia(q); } catch (e) { return null; }
  };
  var mqMotion = media('(prefers-reduced-motion: no-preference)');

  // --- 2. Ending the opening ------------------------------------------------
  // The class goes on <html> because the shared header's entrance is part of
  // the opening too, and the header is not inside the hero.
  var events = ['keydown', 'pointerdown', 'wheel', 'scroll'];
  var settled = false;
  var settle = function () {
    if (settled) return;
    settled = true;
    root.classList.add('cp-settled');
    events.forEach(function (ev) { window.removeEventListener(ev, settle, true); });
    rotation();
  };

  // Is the opening running? The same question the stylesheet asks.
  var playing = false;
  var pm = media('(prefers-reduced-motion: no-preference) and (scripting: enabled)');
  playing = !!(pm && pm.matches);

  // Seen already in this tab? Straight to the finished page.
  var SEEN = 'cp-intro-seen';
  var seen = false;
  try { seen = window.sessionStorage.getItem(SEEN) === '1'; } catch (e) { /* no storage: nothing to remember */ }

  // The opening's own animations (all named cp-*).
  var ours = [];

  if (!playing || seen || root.classList.contains('cp-settled')) {
    // No opening to wait for (reduced motion, an older browser that cannot
    // answer the stylesheet's question, or a second visit): settle now, and
    // the background (section 3) decides for itself what may move.
    settle();
  } else {
    try { window.sessionStorage.setItem(SEEN, '1'); } catch (e) { /* fine */ }
    events.forEach(function (ev) { window.addEventListener(ev, settle, { capture: true, passive: true }); });
    try {
      ours = (document.getAnimations ? document.getAnimations() : []).filter(function (a) {
        return typeof a.animationName === 'string' && a.animationName.indexOf('cp-') === 0;
      });
    } catch (e) { ours = []; }
    // Settle when the last one has ended; a backstop timer covers a browser
    // that cannot list animations (the opening is about 2.3s long).
    var fallback = setTimeout(settle, 4000);
    if (ours.length && typeof Promise === 'function') {
      Promise.all(ours.map(function (a) {
        return a.finished.then(null, function () { return null; });
      })).then(function () {
        clearTimeout(fallback);
        settle();
      });
    }
  }

  // --- 3. The background: the contact sheet, and the phone slideshow ---------
  function rotation() {
    var strip = hero.querySelector('.cp-frames');
    var control = hero.querySelector('[data-cp-pause]');
    if (!strip || !control || !mqMotion) return;
    var frames = Array.prototype.slice.call(strip.querySelectorAll('.cp-frame'));
    var menu = hero.querySelector('details[data-cp-involved]');
    var mqDesk = media('(min-width: 1024px)');
    var canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

    // Computer screens (more than three photos only).
    var HOLD = 4000;      // one panel changes every four seconds (the owner)
    var FADE = 1200;      // its cross-fade (campaign-home.css: --cp-fade)
    var GAP = 2000;       // the least wait after carrying on from a pause
    // Phones: [motion allowed, reduced motion].
    var STEP = [4000, 6000];       // one photo's turn, cross-fade included (the owner: four seconds)
    var DISSOLVE = [1200, 2000];   // the cross-fade between two photos
    var QUICK = [450, 700];        // …after a swipe, which should feel immediate
    var SWIPE = 40;                // px a finger must travel sideways
    // After this many full rounds the slideshow comes to rest on the first
    // photo (about 48 seconds with four photos), so a phone reader with no
    // visible Pause (the owner's choice) is never left with a loop that runs
    // for ever (WCAG 2.2.2); a swipe still moves it by hand.
    var ROUNDS = 3;
    var KEY = 'cp-background';

    var items = frames.map(function (el) {
      return { el: el, img: el.querySelector('img'), phone: el.hasAttribute('data-phone') };
    });

    // The reader's choice, remembered.
    var userPaused = false;
    try { userPaused = window.localStorage.getItem(KEY) === 'paused'; } catch (e) { /* no storage */ }
    var offscreen = false;
    var tabHidden = document.visibilityState === 'hidden';
    var touching = false;     // a finger is on the photograph
    var menuOpen = !!(menu && menu.open);

    var state = null;     // the running layout, or null
    var timer = 0;        // computer screens' next change
    var lastChange = 0;
    var gen = 0;          // bumped on every reset: late callbacks from an old layout are ignored

    var running = function () { return !!state && !userPaused && !offscreen && !tabHidden && !touching && !menuOpen; };
    var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

    // A photograph in hand (loaded and decoded), or a refusal for a broken one.
    function ready(it) {
      var img = it.img;
      if (!img) return Promise.reject(new Error('no image'));
      // A photo waiting its turn is loading="lazy" and display:none, so it has
      // not been fetched: ask for it now.
      if (img.loading === 'lazy') img.loading = 'eager';
      var loaded = img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise(function (resolve, reject) {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', reject, { once: true });
          });
      return loaded.then(function () {
        if (!(img.naturalWidth > 0)) throw new Error('no image');
        return typeof img.decode === 'function' ? img.decode().then(null, function () { return null; }) : null;
      });
    }

    // ---- Computer screens: three panels, one change at a time --------------
    function schedule(ms) {
      clearTimeout(timer);
      timer = 0;
      if (running()) timer = setTimeout(tick, Math.max(0, ms));
    }
    function tick() {
      timer = 0;
      if (!running() || state.mode !== 'desk') return;
      var panels = state.panels;
      // The panel that has held its picture longest; right to left on a tie.
      var pick = null;
      for (var i = panels.length - 1; i >= 0; i--) {
        var p = panels[i];
        if (p.busy) continue;
        if (!pick || p.since < pick.since) pick = p;
      }
      var next = -1;
      for (var j = 0; pick && j < state.queue.length; j++) {
        if (!items[state.queue[j]].broken) { next = state.queue.splice(j, 1)[0]; break; }
      }
      if (next >= 0) deskShow(pick, next);
      schedule(HOLD);
    }
    function deskShow(panel, idx) {
      var it = items[idx];
      var outIdx = panel.item;
      var my = gen;
      panel.busy = true;
      panel.item = idx;
      panel.since = now();
      lastChange = now();
      it.el.style.setProperty('--cp-slot', String(panel.slot));
      it.el.classList.add('is-in');   // over the panel's photo, transparent
      ready(it).then(function () {
        if (my !== gen) return;
        requestAnimationFrame(function () {
          if (my !== gen) return;
          void it.el.offsetWidth;     // the transparent start is styled, so the fade runs
          it.el.classList.add('is-on');
          setTimeout(function () {
            if (my !== gen) return;
            it.el.classList.remove('is-in');
            items[outIdx].el.classList.remove('is-on', 'is-in');
            panel.busy = false;
            state.queue.push(outIdx);
          }, FADE + 50);
        });
      }, function () {
        // A photograph that will not load leaves the rotation for good.
        if (my !== gen) return;
        it.el.classList.remove('is-in');
        it.broken = true;
        panel.busy = false;
        panel.item = outIdx;
      });
    }

    // ---- Phones: the slideshow -----------------------------------------------
    // The clock: one photo's turn, which a pause stops and resumes where it
    // left off. At rest (after its rounds) it no longer runs.
    var clock = { left: 0, end: 0, t: 0 };
    function clockStart(ms) {
      clearTimeout(clock.t);
      clock.t = 0;
      clock.left = ms;
      clockRun();
    }
    function clockRun() {
      if (clock.t || state.rested) return;
      if (!running()) { clockHold(); return; }
      clock.end = now() + clock.left;
      clock.t = setTimeout(function () {
        clock.t = 0;
        clock.left = 0;
        if (!running()) return;
        // The last automatic change of the last round lands on the first
        // photo and stays there.
        state.auto += 1;
        if (state.auto >= ROUNDS * state.list.length) state.rested = true;
        step(1, false);
      }, clock.left);
    }
    function clockHold() {
      if (clock.t) {
        clock.left = Math.max(0, clock.end - now());
        clearTimeout(clock.t);
        clock.t = 0;
      }
    }

    // The photos either side of this one, fetched ahead of their turn (and of
    // a swipe), so a change never waits on the network.
    function warm(at) {
      var n = state.list.length;
      [1, -1].forEach(function (d) {
        var img = items[state.list[(at + d + n) % n]].img;
        if (img && img.loading === 'lazy') img.loading = 'eager';
      });
    }

    // On (1) or back (-1) to the next photo that is not broken.
    function step(dir, quick) {
      var n = state.list.length;
      var to = state.at;
      for (var k = 0; k < n; k++) {
        to = (to + dir + n) % n;
        if (!items[state.list[to]].broken) break;
      }
      if (to === state.at) { clockStart(STEP[state.ri]); return; }
      show(to, (quick ? QUICK : DISSOLVE)[state.ri]);
    }

    // Cross-fade to the photo at `to`. Each incoming photo is laid over the
    // last (a rising z-index), so a quick second swipe simply covers the
    // first; the newest change, once it is fully in, clears every other.
    function show(to, fade) {
      var g = gen;
      var my = ++state.token;
      var from = state.at;
      var it = items[state.list[to]];
      state.at = to;
      clockStart(STEP[state.ri]);
      it.el.style.zIndex = String(++state.z);
      it.el.classList.add('is-in');   // shown, transparent
      var stale = function () { return g !== gen || my !== state.token; };
      ready(it).then(function () {
        if (stale()) return;
        var done = function () {
          if (stale()) return;
          items.forEach(function (o) {
            if (o === it) return;
            o.el.classList.remove('is-on', 'is-in');
            o.el.style.removeProperty('z-index');
          });
          it.el.classList.remove('is-in');
          warm(to);
        };
        it.el.classList.add('is-on');
        // An opacity fade only — the same under reduced motion, just slower.
        // (The Web Animations API, not a CSS transition: the site's global
        // reduced-motion rule cuts every transition to nothing.)
        var a = null;
        if (canAnimate) {
          try { a = it.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing: 'ease' }); } catch (e) { a = null; }
        }
        if (a && a.finished) a.finished.then(done, done);
        else done();
      }, function () {
        // A photograph that will not load leaves the slideshow for good.
        if (stale()) return;
        it.broken = true;
        it.el.classList.remove('is-in');
        it.el.style.removeProperty('z-index');
        state.at = from;
        step(1, false);
      });
    }

    // A sideways swipe on the photograph: on to the next photo (finger to the
    // left) or back. Only touch and pen — a mouse drag over the headline is
    // selecting its words — and never from a control or the open menu.
    var swipe = null;
    var NOT_HERE = 'a, button, summary, input, select, textarea, label, details, [data-cp-pause]';
    hero.addEventListener('pointerdown', function (e) {
      if (!state || state.mode !== 'phone' || !e.isPrimary || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
      if (menuOpen || (e.target && e.target.closest && e.target.closest(NOT_HERE))) return;
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
      touching = true;
      update();
    });
    var lift = function (e, cancelled) {
      if (!swipe || e.pointerId !== swipe.id) return;
      var dx = e.clientX - swipe.x;
      var dy = e.clientY - swipe.y;
      swipe = null;
      touching = false;
      // pointercancel is the browser taking a vertical scroll: never a swipe.
      if (!cancelled && state && state.mode === 'phone' && Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1, true);
      else update();
    };
    window.addEventListener('pointerup', function (e) { lift(e, false); }, true);
    window.addEventListener('pointercancel', function (e) { lift(e, true); }, true);

    // ---- Start, stop, pause --------------------------------------------------
    function reset() {
      gen++;
      clearTimeout(timer);
      timer = 0;
      clearTimeout(clock.t);
      clock.t = 0;
      items.forEach(function (it) {
        it.el.classList.remove('is-in', 'is-on');
        it.el.style.removeProperty('z-index');
        if (typeof it.el.getAnimations === 'function') it.el.getAnimations().forEach(function (a) { a.cancel(); });
      });
      // Back to the server-rendered still: the first three in their panels.
      frames.forEach(function (el, i) {
        if (i < 3) el.style.setProperty('--cp-slot', String(i + 1));
        else el.style.removeProperty('--cp-slot');
      });
      strip.classList.remove('is-rotating', 'is-slides');
      state = null;
    }

    function setup() {
      reset();
      var moving = mqMotion.matches;
      if (mqDesk && mqDesk.matches) {
        var count = Math.min(3, items.length);
        // Three photos are all on show: nothing to rotate, nothing to pause.
        if (!moving || items.length <= count) { control.hidden = true; return; }
        var panels = [];
        for (var i = 0; i < count; i++) panels.push({ slot: i + 1, item: i, since: 0, busy: false });
        state = { mode: 'desk', panels: panels, queue: items.map(function (it, k) { return k; }).slice(count) };
        panels.forEach(function (p) { items[p.item].el.classList.add('is-on'); });
        strip.classList.add('is-rotating');
        control.hidden = false;
        reflect();
        lastChange = now();
        schedule(HOLD);
        return;
      }
      var list = items.map(function (it, k) { return k; }).filter(function (k) { return items[k].phone; });
      if (list.length < 2) { control.hidden = true; return; }
      state = { mode: 'phone', list: list, at: 0, token: 0, z: 2, ri: moving ? 0 : 1, auto: 0, rested: false };
      var lead = items[list[0]];
      lead.el.classList.add('is-on');
      lead.el.style.zIndex = '2';
      strip.classList.add('is-rotating', 'is-slides');
      control.hidden = false;   // on a phone CSS draws it only while it has focus
      reflect();
      warm(0);
      clockStart(STEP[state.ri]);
    }

    function reflect() {
      control.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    }

    // Wait or carry on, after any change to the reasons to wait.
    function update() {
      if (!state) return;
      if (state.mode === 'phone') {
        if (running()) clockRun();
        else clockHold();
      } else if (running()) {
        if (!timer) schedule(Math.min(HOLD, Math.max(GAP, HOLD - (now() - lastChange))));
      } else {
        clearTimeout(timer);
        timer = 0;
      }
    }

    control.addEventListener('click', function () {
      userPaused = !userPaused;
      try { window.localStorage.setItem(KEY, userPaused ? 'paused' : 'playing'); } catch (e) { /* not remembered */ }
      reflect();
      update();
    });

    document.addEventListener('visibilitychange', function () {
      tabHidden = document.visibilityState === 'hidden';
      update();
    });

    if (menu) {
      menu.addEventListener('toggle', function () {
        menuOpen = menu.open;
        update();
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        offscreen = !e.isIntersecting || e.intersectionRatio < 0.2;
        update();
      }, { threshold: [0, 0.2, 0.5] }).observe(hero);
    }

    var onChange = function (mq, fn) {
      if (!mq) return;
      if (mq.addEventListener) mq.addEventListener('change', fn);
      else if (mq.addListener) mq.addListener(fn);
    };
    onChange(mqMotion, setup);
    onChange(mqDesk, setup);

    setup();
  }

  // --- 4. Get Involved: the menu its button opens ------------------------------
  function involvedMenu() {
    var menu = hero.querySelector('details[data-cp-involved]');
    var button = menu && menu.querySelector('summary');
    var panel = menu && menu.querySelector('.cp-involved__panel');
    if (!menu || !button || !panel || !('open' in menu)) return;
    var header = document.getElementById('site-header');
    var CLEAR = 12;   // px kept clear between the sheet and the menu bar above it
    var EDGE = 8;     // px the sheet keeps from the right of the screen

    // Measured from the layout, not the drawn box: while the sheet rises in,
    // its transform would otherwise be measured too.
    function place() {
      menu.classList.remove('cp-involved--end');
      panel.style.removeProperty('--cp-involved-room');
      if (!menu.open) return;
      var anchor = panel.offsetParent;
      if (!anchor) return;
      var a = anchor.getBoundingClientRect();
      var foot = a.top + panel.offsetTop + panel.offsetHeight;
      // Never above the menu bar, the top of the hero, or the top of the
      // screen (a phone held sideways scrolls the hero).
      var floor = Math.max(0, hero.getBoundingClientRect().top, header ? header.getBoundingClientRect().bottom : 0) + CLEAR;
      if (foot - floor < panel.offsetHeight) panel.style.setProperty('--cp-involved-room', Math.max(0, Math.floor(foot - floor)) + 'px');
      if (a.left + panel.offsetLeft + panel.offsetWidth > document.documentElement.clientWidth - EDGE) menu.classList.add('cp-involved--end');
    }
    function sync() {
      button.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
      place();
    }
    function close(refocus) {
      if (!menu.open) return;
      menu.open = false;
      sync();
      if (refocus) {
        try { button.focus({ preventScroll: true }); } catch (e) { button.focus(); }
      }
    }

    menu.addEventListener('toggle', sync);
    sync();
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && menu.open) close(true);
    });
    // A tap or click anywhere but the menu and its button closes it.
    document.addEventListener('pointerdown', function (e) {
      if (menu.open && !menu.contains(e.target)) close(false);
    }, true);
    // Tabbing on past the last item (or back before the button) closes it.
    // Two things this must never do:
    //  - Treat a click on the sheet itself as leaving it. A click on its
    //    frame, padding or the rules between rows (no control there) hands
    //    focus to the nearest focusable ancestor — <main tabindex="-1"> —
    //    which CONTAINS the menu: that is staying, not going.
    //  - Close inside the focus change. Setting details.open = false while
    //    Chromium is moving focus off a mouse click crashed the tab (Chrome
    //    153). So it waits a turn, then looks where focus actually landed.
    menu.addEventListener('focusout', function (e) {
      var to = e.relatedTarget;
      if (!menu.open || !to || menu.contains(to) || to.contains(menu)) return;
      setTimeout(function () {
        if (menu.open && !menu.contains(document.activeElement)) close(false);
      }, 0);
    });
    // An item that opened a new tab leaves this page as it was found.
    panel.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[target="_blank"]') : null;
      if (a) setTimeout(function () { close(false); }, 0);
    });
    // Back to this page from the browser's cache: closed, as it was found.
    window.addEventListener('pageshow', function (e) { if (e.persisted) close(false); });
    window.addEventListener('resize', function () { if (menu.open) place(); }, { passive: true });
  }
})();
