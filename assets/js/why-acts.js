/* /why — THE FOUR FULL-SCREEN ACTS. This file is the page's ONE scroll reader.

   Progressive enhancement only: without it every act renders its completed
   static picture, because .wy-act defaults to --p: 1 and every motion
   pre-state in why-acts.css is nested under html.wy-acts-live. It is gated on
   the SAME html.js-motion switch why.js sets, so the page has ONE motion
   contract, not two — reduced motion means why.js never adds the class and
   this file returns on line one.

   THE PERFORMANCE CONTRACT (do not break any of these):
   - exactly one scroll listener, { passive: true }, rAF-throttled;
   - frame() reads window.pageYOffset and NOTHING else. Every rect, offset and
     scrollHeight is cached by measure(), which runs only on load, resize,
     ResizeObserver and fonts.ready;
   - the only per-frame writes are one custom property per on-screen act
     (quantised to 3dp, skipped below a 0.002 delta) and one scaleX;
   - scrollIntoView is BANNED on this page. The rail handler uses
     window.scrollTo({top}) with a cached number and never targets a sticky
     element — that combination is what produced 13-15 backwards scroll jerks
     earlier in this page's life. */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement;
  if (!root.classList.contains('js-motion')) return;
  if (!('IntersectionObserver' in w)) return;
  var acts = [].slice.call(d.querySelectorAll('.wy-act'));
  if (!acts.length) return;

  function deb(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* KEYBOARD focus, not pointer focus. A click sets document.activeElement
     exactly as Tab does, but only the keyboard case paints a ring the reader
     can lose, and only it can land a stop on copy the scroll has not
     assembled (zero-width copy is not clickable). Anything that reacts to
     focus by CHANGING THE STORY asks this first. No :focus-visible → treat
     every focus as keyboard focus, the conservative side. */
  function kbFocus(el) {
    if (!el || !el.matches) return false;
    try { return el.matches(':focus-visible'); } catch (e) { return true; }
  }

  /* ---- model: no geometry yet ---------------------------------------- */
  var model = [];
  acts.forEach(function (el) {
    var track = el.querySelector('.wy-act-track');
    var pin = el.querySelector('.wy-act-pin');
    if (track && pin) {
      model.push({
        el: el, track: track, pin: pin,
        n: +el.getAttribute('data-n') || 0,
        top: 0, h: 1, len: 1, last: -1, hooks: null
      });
    }
  });
  if (!model.length) return;

  var dirty = true, ticking = false, vh = 0, docMax = 1, stopped = false;
  var bar = d.querySelector('.wy-progress > i');

  function measure() {
    dirty = false;
    vh = w.innerHeight;
    docMax = Math.max(root.scrollHeight - root.clientHeight, 1);
    var y = w.pageYOffset;
    for (var i = 0; i < model.length; i++) {
      var m = model[i], r = m.track.getBoundingClientRect();
      m.top = r.top + y;
      m.h = r.height;
      m.len = Math.max(r.height - m.pin.offsetHeight, 1);
    }
  }

  function set(m, q) {
    if (m.last >= 0 && Math.abs(q - m.last) < 0.002) return;
    m.last = q;
    m.el.style.setProperty('--p', q);
    if (m.hooks) m.hooks(q);
  }

  function frame() {
    ticking = false;
    if (dirty) measure();
    var y = w.pageYOffset;                       /* the only scroll-path read */
    for (var i = 0; i < model.length; i++) {
      var m = model[i];
      /* An act that is off screen is parked at the edge it left through, so a
         fast flick can never strand one half-assembled. At most two are ever
         doing work. */
      if (y + vh < m.top) { set(m, 0); continue; }
      if (y > m.top + m.h) { set(m, 1); continue; }
      var p = (y - m.top) / m.len;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      set(m, ((p * 1000) | 0) / 1000);
    }
    if (bar) bar.style.transform = 'scaleX(' + (y / docMax).toFixed(4) + ')';
  }
  /* `stopped` is the reduced-motion kill switch, and it belongs HERE rather
     than only on the scroll listener. off() below drops that listener, but
     resize, load, fonts.ready and the ResizeObserver all still reach frame()
     through invalidate() — so a reader who turns reduced motion on keeps a
     live rAF pipeline writing a custom property per act (and the progress
     bar's scaleX) for the rest of the session. The PICTURE was never at risk:
     why-acts.css's `@media (prefers-reduced-motion) { .wy-act { --p: 1
       !important } }` outranks the inline value — MEASURED, on the shipped
     build and on this one, --p stays 1 through a scroll-then-rotate. This is
     the work, not the outcome: a page that has declared it does no motion
     should not still be running a scroll driver. */
  function queue() { if (!stopped && !ticking) { ticking = true; requestAnimationFrame(frame); } }
  function invalidate() { dirty = true; queue(); }

  /* ---- THE SHIP (act 1) ----------------------------------------------
     State is classes and custom properties, never per-frame work. The static
     page already shows what gets tried and what actually happens; JS upgrades
     each label into a real button, so a non-functional-looking control is
     never shipped. The act NEVER blocks on interaction — the scroll path
     tells the whole story on its own. */
  function ship(m) {
    var host = m.el.querySelector('.wy-ship');
    if (!host) return null;
    var before = host.querySelector('[data-slot="before"]');
    var after = host.querySelector('[data-slot="after"]');
    var status = host.querySelector('#wyShipStatus');
    var rows = [].slice.call(host.querySelectorAll('.wy-attempt'));
    var patches = [].slice.call(host.querySelectorAll('.wy-patch'));
    var labels = [].slice.call(host.querySelectorAll('.wy-patch-lab'));
    var verdicts = [].slice.call(host.querySelectorAll('.wy-patch-ot'));
    var modes = [].slice.call(host.querySelectorAll('.wy-modes input[type="radio"]'));
    var readout = host.querySelector('.wy-quota-out');
    var used = 0, told = 0, said = false, arrived = false, slot = '', late = false;

    function say(t) { if (status) status.textContent = t; }

    if (after) after.hidden = true;

    /* THE SLOT SWAP.
       The two halves of act 1 cannot both be on screen: the pin is one 100svh
       clipped box and together they overflow a phone. So they swap — and the
       swap has to be reachable by keyboard, which it was NOT. Measured before
       this: three independent full-page tab sweeps (1440 and 390, and one
       begun with the slot already open) reached the quota picker ZERO times,
       because tabbing onto a patch button scrolls act 1 back to its pin, which
       drops q below 0.9, which re-hid the picker before focus could get there.
       The first answer was a PERMANENT latch (everLate): once q had passed 0.9
       even once, the picker owned act 1 for the rest of the session. Measured
       cost: at 390×844 a reader who thumbs past act 1 and scrolls back finds
       the patch buttons gone — `{"w":0,"h":0}` where they had measured
       128.3×48 — with no affordance saying anything is missing, and at q=0 the
       panel offered the REMEDY above a ship that has not been holed yet. On a
       19.6-viewport page that is the ordinary reading pattern, not an edge
       case. Pointer users had no way back at all; only Shift+Tab off the first
       radio restored it.
       Three things hold it open now, none of them permanent:
         1. showSlot() is the only writer, so there is one state, not two;
         2. the scroll path is symmetric, with hysteresis (open at q ≥ 0.9,
            close below 0.85) so a slot cannot flutter at the boundary;
         3. focus is CARRIED ACROSS the swap rather than pinning it — see the
            note on slotTo(). Tab off the last patch button still hands focus
            straight to the picker, and Shift+Tab off the first radio back. */
    function showSlot(a) {
      if (slot === (a ? 'a' : 'b')) return;
      slot = a ? 'a' : 'b';
      if (before) before.hidden = a;
      if (after) after.hidden = !a;
    }

    /* THE FOCUS GUARD — WHAT IT PROTECTS, AND WHY IT NO LONGER COSTS THE
       READER THE PAYOFF.
       PROTECTS: the halves swap with the real `hidden` attribute, so hiding
       the one holding document.activeElement DELETES the focused element out
       from under the reader — focus drops to <body>, the ring goes, the next
       Tab restarts at the top of a twenty-viewport page and a screen reader
       loses its place. Nothing focusable may ever be hidden, clipped or
       scrolled away while it holds focus. That invariant stands.
       USED TO: refuse the swap, which a POINTER made permanent — a click or
       tap leaves the patch button as activeElement. Measured before: untouched,
       the picker opens at q=0.90 (3 radios) at 1440×900 and 390×844; after one
       tap on why-ship-patch-1 at q=0.45, every sample q=0.50→1.00 read
       after=HIDDEN, radios=0 — ~2,400px of scroll with the picker, the quota
       readout and the citizens'-assembly caveat suppressed, and no self-heal.
       Engaging cost the reader the act's second half; ignoring it did not.
       NOW: it CARRIES FOCUS ACROSS instead of refusing. Show the arriving half
       first (hidden elements cannot take focus), then move focus to its
       counterpart control — the same handoff the Tab and Shift+Tab handlers
       already perform, so the swap has one grammar however it is triggered.
       Four cases, and the invariant holds in all of them (focus is never left
       in a hidden slot, never leaves the on-screen act, and every move is
       preventScroll so it cannot fight the scroll driver):
         · focus is not in the leaving half        → just swap;
         · leaving the patches, going forward      → swap, focus the checked
           radio (focus follows the story, exactly as Tab would);
         · leaving the picker on POINTER focus     → swap, focus the last patch
           button. A click leaves no ring to lose, so nothing is taken away;
         · leaving the picker on KEYBOARD focus    → REFUSE. This is the one
           case the guard is really for, and it is not hypothetical: measured
           here, Tab off the last patch button opens the picker at whatever q
           the reader is at, the browser scrolls the (1px, .wy-vh) radio into
           view, and that scroll can drop q back under 0.85 — so a symmetric
           handoff yanked the reader straight back out of the control they had
           just tabbed into. Shift+Tab is the documented way back, and the
           focusout below re-syncs the moment focus leaves the ship.
       Refusing also when the arriving half has nothing to land on: hiding
       focus for nothing is the one thing worse than not swapping. */
    function afterStop() {
      if (!after) return null;
      return after.querySelector('input[type="radio"]:checked')
        || after.querySelector('input[type="radio"]');
    }
    function beforeStop() {
      if (!before) return null;
      var bs = before.querySelectorAll('.wy-attempt-b');
      return bs.length ? bs[bs.length - 1] : null;
    }
    function slotTo(a) {
      if (slot === (a ? 'a' : 'b')) return;          /* nothing to swap */
      var leaving = a ? before : after;
      var el = d.activeElement;
      if (!(leaving && el && el !== d.body && leaving.contains(el))) { showSlot(a); return; }
      if (!a && kbFocus(el)) return;                 /* never yank a ring out of the picker */
      var landing = a ? afterStop() : beforeStop();
      if (!landing) return;                          /* nowhere safe to put focus */
      showSlot(a);
      landing.focus({ preventScroll: true });
    }

    if (before && after) {
      before.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        var bs = before.querySelectorAll('.wy-attempt-b');
        if (!bs.length || e.target !== bs[bs.length - 1]) return;
        var r = after.querySelector('input[type="radio"]');
        if (!r) return;
        e.preventDefault();
        late = true;
        showSlot(true);
        /* The radios are .wy-vh by design (TESTIDS.md) — the visible focus
           indicator is on the label, via `input:focus-visible + label`. */
        r.focus();
      });
      after.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
        var rs = after.querySelectorAll('input[type="radio"]');
        if (!rs.length || e.target !== rs[0]) return;
        var bs = before.querySelectorAll('.wy-attempt-b');
        if (!bs.length) return;
        e.preventDefault();
        late = false;                  /* or the next scroll frame snaps forward */
        showSlot(false);
        bs[bs.length - 1].focus();
      });
    }

    /* Belt and braces: focus landing anywhere inside the picker opens it, the
       same rescue the acts already do for clipped copy. */
    host.addEventListener('focusin', function (e) {
      if (after && after.contains(e.target)) { late = true; showSlot(true); }
      else if (before && before.contains(e.target)) { late = false; showSlot(false); }
    });

    /* Self-heal: the scroll path cannot retry a refusal (set() skips hooks(q)
       below a 0.002 delta, q clamps at 1), so one would stick for the rest of
       the act. When focus leaves the ship the refusal protects nothing —
       re-apply whatever the scroll last asked for. Focus moving BETWEEN the
       ship's own controls is the focusin handler's business, not this one's. */
    host.addEventListener('focusout', function (e) {
      if (e.relatedTarget && host.contains(e.relatedTarget)) return;
      slotTo(late);
    });

    /* The readouts are swapped with CSS `display`, which mutates nothing — so
       .wy-quota-out cannot be a live region (it carries no role="status"; see
       the note in ShipStage.astro). Announce through the region that works. */
    if (modes.length && readout) {
      modes.forEach(function (r) {
        r.addEventListener('change', function () {
          if (!r.checked) return;
          var out = readout.querySelector('[data-mode="' + r.value + '"]');
          if (out) say(out.textContent.replace(/\s+/g, ' ').trim());
        });
      });
    }

    rows.forEach(function (li, i) {
      var lab = li.querySelector('.wy-attempt-l');
      if (!lab) return;
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'wy-attempt-b';
      b.setAttribute('data-testid', 'why-ship-patch-' + (i + 1));
      b.textContent = lab.textContent;
      lab.parentNode.replaceChild(b, lab);
      b.addEventListener('click', function () {
        /* aria-disabled, NOT the `disabled` property: disabling an element
           inside its own click handler drops document.activeElement to <body>,
           so a keyboard user loses the focus ring and their place on a
           20-viewport page. This keeps the button focusable and reads as
           unavailable; the guard below is what makes it unusable. */
        if (b.getAttribute('aria-disabled') === 'true') return;
        b.setAttribute('aria-disabled', 'true');
        li.classList.add('is-done');
        if (patches[i]) patches[i].classList.add('is-manual');
        if (labels[i]) labels[i].classList.add('is-manual');
        if (verdicts[i]) verdicts[i].classList.add('is-manual');
        used += 1;
        host.style.setProperty('--patchN', used);   /* the water rises a notch */
        if (w.navigator && w.navigator.vibrate) w.navigator.vibrate(8);
        say(b.textContent + ' — patch applied. It held, then tore away. The water is higher than before.');
      });
    });

    return function (q) {
      while (told < rows.length && q > 0.36 + told * 0.07) {
        rows[told].classList.add('is-done');
        told += 1;
      }
      if (!said && told > 1) { said = true; say('The patches are failing.'); }
      /* Hysteresis, not a latch: 0.9 opens the picker, 0.85 gives the patches
         back, so the swap follows the reader in BOTH directions and cannot
         flutter at a single boundary. */
      if (q >= 0.9) late = true;
      else if (q < 0.85) late = false;
      slotTo(late);
      if (!arrived && q > 0.985) { arrived = true; host.classList.add('is-arrived'); }
    };
  }

  /* ---- go live: class, measure, first frame, all before the next paint -- */
  root.classList.add('wy-acts-live');
  model.forEach(function (m) { if (m.el.getAttribute('data-mech') === 'ship') m.hooks = ship(m); });
  measure();

  /* ---- an act's own URL must restore the act ---------------------------
     The rail writes #wyItemN into the address bar with replaceState, which
     makes it the page's shareable / bookmarkable / reloadable state. Loading
     it landed the reader on the TRACK TOP, where --p is 0: every piece of
     copy in the act still clipped to zero width, the heading at opacity 0,
     and one legible string on the screen (the kicker chip). Measured recovery
     cost from a fresh load of /why/#wyItem3 at 1440×900: 1,300px of scrolling
     before the heading was readable; #wyItem1 and #wyItem2 needed more than
     2,500px at both viewports.
     So an anchor arrival lands on the SAME beat the rail's click handler
     targets — identical arithmetic, from the geometry measure() just cached.
     Runs once, before the first frame(), and only for a hash that names an
     act, so it can never fight a browser scroll restore on an ordinary load. */
  var hashTarget = null;
  if (w.location.hash.length > 1) {
    var hid = w.location.hash.slice(1);
    for (var hi = 0; hi < model.length; hi++) if (model[hi].el.id === hid) hashTarget = model[hi];
  }
  function landOnHash() {
    if (!hashTarget) return;
    if (dirty) measure();
    w.scrollTo({ top: Math.round(hashTarget.top + hashTarget.len * 0.74), behavior: 'auto' });
  }
  if (hashTarget) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    landOnHash();
    /* This file is a parser-blocking <script src> at the end of <body>, so the
       UA's own "scroll to the fragment" step can run AFTER it and put the
       reader straight back on the track top — measured: --p still 0 with the
       jump in place. So it is applied again on load, and then released. Any
       real input from the reader releases it first, so it can never fight a
       gesture or a browser scroll restore. */
    var releaseHash = function () { hashTarget = null; };
    w.addEventListener('load', function () {
      landOnHash();
      requestAnimationFrame(function () { requestAnimationFrame(releaseHash); });
    });
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
      w.addEventListener(ev, releaseHash, { passive: true, once: true });
    });
  }

  frame();

  w.addEventListener('scroll', queue, { passive: true });
  w.addEventListener('resize', deb(invalidate, 150), { passive: true });
  w.addEventListener('load', invalidate);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(invalidate);
  if ('ResizeObserver' in w) {
    try { new ResizeObserver(deb(invalidate, 150)).observe(d.body); } catch (e) { /* no-op */ }
  }

  /* ---- only the on-screen stage pays for will-change and the sea ------- */
  var lo = new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); });
  }, { rootMargin: '10% 0px 10% 0px', threshold: 0 });
  d.querySelectorAll('.wy-act .wy-stage-fit').forEach(function (s) { lo.observe(s); });

  /* ---- the tail: the docket prints as it arrives, the stamp slams, and the
         audit rail / register tick over. why.js owns those fixtures; the
         six-line window.wyLedger bridge is the whole interface. ---------- */
  var tio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var sec = e.target.parentNode;
      sec.classList.add('is-tail');
      var st = e.target.querySelector('.wy-stamp');
      if (st) setTimeout(function () { st.classList.add('is-slammed'); }, 620);
      if (w.wyLedger) w.wyLedger.markItem(+sec.getAttribute('data-n'));
      tio.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  d.querySelectorAll('.wy-act-detail').forEach(function (t) { tio.observe(t); });

  /* ---- focus rescue: no focus stop ever rests on unassembled content ---
     Gated on KEYBOARD focus. is-complete un-clips every [data-p] in the pin
     AND the whole docket and paints the verdict sweep — a sledgehammer,
     justified only by what it prevents: a keyboard ring resting on copy still
     clipped to zero width. A pointer press paints no ring and can only land on
     something already drawn, so honouring it bought nothing and cost the act:
     measured before the gate, one click on a patch button at q=0.45 put
     `is-complete is-tail` on act 1 at both viewports, taking its heading from
     clip-path inset(0px -3% 0px 0px) to none and printing the whole docket at
     once — playing the minigame handed the reader act 1's paperwork early,
     while ignoring it printed line by line. */
  d.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t || !t.closest || !kbFocus(t)) return;
    var s = t.closest('.wy-act');
    if (s) { s.classList.add('is-complete', 'is-tail'); }
  });

  /* ---- rail clicks land on the policy beat, from CACHED geometry ------- */
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.wy-rail a[href^="#wyItem"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1), m = null;
    for (var i = 0; i < model.length; i++) if (model[i].el.id === id) m = model[i];
    if (!m) return;
    e.preventDefault();
    if (dirty) measure();
    /* Smooth is asked for HERE, per interaction — `html { scroll-behavior:
       smooth }` applied it to every programmatic scroll on a 16.5k-px
       document, and a driver that writes position every frame raced the
       in-flight animation (measured: 5 of 8 rAF-driver runs at 390×844 showed
       backwards motion, worst −136px). */
    w.scrollTo({ top: Math.round(m.top + m.len * 0.74), behavior: 'smooth' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ---- reduced motion turned on mid-session --------------------------- */
  var mq = w.matchMedia('(prefers-reduced-motion: reduce)');
  var off = function () {
    if (!mq.matches) return;
    stopped = true;
    w.removeEventListener('scroll', queue);
    root.classList.remove('wy-acts-live');
    model.forEach(function (m) {
      m.el.style.removeProperty('--p');
      m.el.classList.add('is-complete', 'is-tail');
    });
  };
  if (mq.addEventListener) mq.addEventListener('change', off);
  else if (mq.addListener) mq.addListener(off);
})();
