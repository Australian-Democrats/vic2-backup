/* Candidate profile — the twenty local-priority treatments.
   Loaded ONLY when the profile has priorities and the Candidates page's
   "Scroll-reveal animations" switch is on.

   THE CONTRACT. The server renders a complete, readable, ordered list. This
   file is the only thing that ever adds `.is-live`, and every preset rule in
   src/styles/candidate-priorities.css is gated on it. So:
     · JavaScript off      → this file never runs → the full list;
     · reduced motion      → the early return below → the full list;
     · animations switch off → the file is never loaded → the full list.
   Nothing here may hide content before `.is-live` is added, and nothing may
   hide content that the visitor has no visible, keyboard-reachable control to
   bring back.

   Deliberately NOT part of candidates-motion.js: that file is at its 8,192-byte
   cap with the last 8 bytes reserved, and this is not reveal grammar.

   No inline script bodies anywhere — public/_headers ships a script-src with
   no 'unsafe-inline'. */
(function () {
  'use strict';

  var mods = Array.prototype.slice.call(document.querySelectorAll('[data-prios-mod]'));
  if (!mods.length) return;
  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq && mq.matches) return;

  /* ---------- tiny builders ---------------------------------------------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function btnEl(cls, txt) {
    var b = el('button', cls, txt);
    b.type = 'button';
    return b;
  }
  function titleOf(li) {
    var t = li.querySelector('.cprio-t');
    return t ? (t.textContent || '').trim() : '';
  }
  function bodyOf(li) {
    return li.querySelector('.cprio-body');
  }
  /* A control row, before the list (default) or after it. */
  function ctlRow(mod, list, after) {
    var d = el('div', 'cprios-ctl' + (after ? ' cprios-ctl--after' : ''));
    if (after) mod.appendChild(d);
    else mod.insertBefore(d, list);
    return d;
  }
  /* Turn a card's head into a button, keeping the heading element around it
     (the accessible accordion pattern: <h3><button>…</button></h3>). */
  function headButton(li, id) {
    var h = li.querySelector('.cprio-t');
    var num = li.querySelector('.cprio-num');
    if (!h) return null;
    var b = btnEl('cprio-btn');
    b.id = id;
    if (num) b.appendChild(num);
    b.appendChild(el('span', 'cprio-btn-t', (h.textContent || '').trim()));
    var chev = el('span', 'cprio-chev', '+');
    chev.setAttribute('aria-hidden', 'true');
    b.appendChild(chev);
    h.textContent = '';
    h.appendChild(b);
    return b;
  }
  function setOpen(btn, body, open) {
    btn.setAttribute('aria-expanded', String(open));
    var chev = btn.querySelector('.cprio-chev');
    if (chev) chev.textContent = open ? '–' : '+';
    if (body) body.hidden = !open;
  }
  /* Reveal-on-scroll for the decoration-only presets. Everything is readable
     before and after; only a marker, a numeral or a sweep changes. If there is
     no observer, or it never fires, a timer lights them all. */
  function whenSeen(items, cb) {
    var done = false;
    function all() {
      if (done) return;
      done = true;
      items.forEach(function (li, i) { cb(li, i); });
    }
    if (!('IntersectionObserver' in window)) { all(); return; }
    var left = items.length;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        left--;
        cb(en.target, items.indexOf(en.target));
      });
      if (left <= 0) io.disconnect();
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    items.forEach(function (li) { io.observe(li); });
    window.setTimeout(function () { io.disconnect(); all(); }, 4000);
  }

  /* ---------- engines ----------------------------------------------------- */

  /* Disclosure — accordion (exclusive) and inline (independent). */
  function disclosure(mod, list, items, base, exclusive) {
    var pairs = [];
    items.forEach(function (li, i) {
      var body = bodyOf(li);
      var b = headButton(li, base + '-b' + i);
      if (!b) return;
      if (body) {
        body.id = base + '-p' + i;
        body.setAttribute('role', 'region');
        body.setAttribute('aria-labelledby', b.id);
        b.setAttribute('aria-controls', body.id);
      }
      pairs.push({ btn: b, body: body });
      setOpen(b, body, i === 0);
      b.addEventListener('click', function () {
        var next = b.getAttribute('aria-expanded') !== 'true';
        if (exclusive && next) {
          pairs.forEach(function (p) { if (p.btn !== b) setOpen(p.btn, p.body, false); });
        }
        setOpen(b, body, next);
      });
    });
  }

  /* One-at-a-time selector, shared by tabs / pager / split (a real tablist)
     and by carousel / ticker (Back + Next + a live counter). */
  function selector(mod, list, items, base, opts) {
    var i0 = 0;
    var tabs = [];
    var row;
    var status;

    function show(i, moveFocus) {
      i0 = i;
      items.forEach(function (li, j) { li.hidden = i !== j; });
      tabs.forEach(function (t, j) {
        t.setAttribute('aria-selected', String(i === j));
        t.tabIndex = i === j ? 0 : -1;
      });
      if (status) status.textContent = (i + 1) + ' of ' + items.length;
      if (moveFocus && tabs[i]) tabs[i].focus();
    }

    if (opts.chrome === 'nav') {
      /* carousel / ticker */
      list.setAttribute('aria-live', 'polite');
      row = ctlRow(mod, list, true);
      var back = btnEl('cpbtn', '← Back');
      var next = btnEl('cpbtn', 'Next →');
      status = el('span', 'cpstatus');
      status.setAttribute('role', 'status');
      back.addEventListener('click', function () { show((i0 - 1 + items.length) % items.length, false); stop(); });
      next.addEventListener('click', function () { show((i0 + 1) % items.length, false); stop(); });
      row.appendChild(back);
      row.appendChild(status);
      row.appendChild(next);

      var timer = null;
      var play = null;
      function stop() {
        if (!play) return;
        if (timer) { window.clearInterval(timer); timer = null; }
        play.textContent = 'Play';
        play.setAttribute('aria-pressed', 'false');
      }
      function start() {
        if (!play || timer) return;
        timer = window.setInterval(function () { show((i0 + 1) % items.length, false); }, 5000);
        play.textContent = 'Pause';
        play.setAttribute('aria-pressed', 'true');
      }
      if (opts.auto) {
        play = btnEl('cpbtn', 'Pause');
        play.addEventListener('click', function () { if (timer) stop(); else start(); });
        row.appendChild(play);
        start();
        list.addEventListener('focusin', stop);
        list.addEventListener('pointerenter', stop);
      }
      show(0, false);
      return;
    }

    /* tabs / pager / split — the WAI-ARIA tabs pattern. */
    var wrap = null;
    if (opts.chrome === 'split') {
      wrap = el('div', 'cprios-split');
      mod.insertBefore(wrap, list);
      row = el('div', 'cprios-ctl');
      wrap.appendChild(row);
      wrap.appendChild(list);
    } else {
      row = ctlRow(mod, list, false);
    }
    row.setAttribute('role', 'tablist');
    row.setAttribute('aria-label', 'Priorities');
    if (opts.chrome === 'split') row.setAttribute('aria-orientation', 'vertical');
    list.setAttribute('role', 'presentation');

    items.forEach(function (li, i) {
      var t = btnEl('cpbtn' + (opts.chrome === 'pager' ? ' cpbtn--num' : ''),
        opts.chrome === 'pager' ? String(i + 1) : titleOf(li));
      t.id = base + '-t' + i;
      t.setAttribute('role', 'tab');
      if (opts.chrome === 'pager') t.setAttribute('aria-label', 'Priority ' + (i + 1) + ': ' + titleOf(li));
      li.id = li.id || base + '-p' + i;
      li.setAttribute('role', 'tabpanel');
      li.setAttribute('aria-labelledby', t.id);
      li.tabIndex = 0;
      t.setAttribute('aria-controls', li.id);
      t.addEventListener('click', function () { show(i, false); });
      t.addEventListener('keydown', function (e) {
        var last = items.length - 1;
        var to = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i === last ? 0 : i + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i === 0 ? last : i - 1;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = last;
        if (to < 0) return;
        e.preventDefault();
        show(to, true);
      });
      tabs.push(t);
      row.appendChild(t);
    });
    show(0, false);
  }

  /* ---------- the twenty ------------------------------------------------- */
  var PRESETS = {
    /* CARDS — the default. It used to be CSS-only, and the CSS was a :hover
       rule on an element with no focusable child, so on touch it was a
       completely static grid and no keyboard user could reach the state at
       all. It is now a real toggle: tap, Enter or Space marks the card you are
       reading, and Tab moves the mark. The words never move and nothing is
       ever hidden — the same contract every other preset keeps. */
    cards: function (mod, list, items) { focusable(items, true); },

    accordion: function (mod, list, items, base) { disclosure(mod, list, items, base, true); },
    inline: function (mod, list, items, base) { disclosure(mod, list, items, base, false); },

    tabs: function (mod, list, items, base) { selector(mod, list, items, base, { chrome: 'tabs' }); },
    pager: function (mod, list, items, base) { selector(mod, list, items, base, { chrome: 'pager' }); },
    split: function (mod, list, items, base) { selector(mod, list, items, base, { chrome: 'split' }); },
    carousel: function (mod, list, items, base) { selector(mod, list, items, base, { chrome: 'nav' }); },
    ticker: function (mod, list, items, base) { selector(mod, list, items, base, { chrome: 'nav', auto: true }); },

    flip: function (mod, list, items, base) {
      items.forEach(function (li, i) {
        var head = li.querySelector('.cprio-head');
        var body = bodyOf(li);
        if (!head) return;
        var flip = el('div', 'cprio-flipper');
        var front = el('div', 'cprio-face cprio-face--front');
        var back = el('div', 'cprio-face cprio-face--back');
        front.appendChild(head);
        if (body) back.appendChild(body);
        var open = btnEl('cpbtn cprio-flip', 'Show the detail');
        var close = btnEl('cpbtn cprio-flip', 'Back to the priority');
        if (body) { body.id = base + '-p' + i; open.setAttribute('aria-controls', body.id); }
        open.setAttribute('aria-expanded', 'false');
        close.setAttribute('aria-expanded', 'true');
        front.appendChild(open);
        back.appendChild(close);
        flip.appendChild(front);
        flip.appendChild(back);
        li.appendChild(flip);
        open.addEventListener('click', function () {
          li.classList.add('is-flipped');
          open.setAttribute('aria-expanded', 'true');
          window.setTimeout(function () { close.focus(); }, 380);
        });
        close.addEventListener('click', function () {
          li.classList.remove('is-flipped');
          open.setAttribute('aria-expanded', 'false');
          window.setTimeout(function () { open.focus(); }, 380);
        });
      });
    },

    deck: function (mod, list, items, base) {
      function front(i) {
        items.forEach(function (li, j) {
          var on = i === j;
          li.classList.toggle('is-front', on);
          li.style.setProperty('--d', (j - i + items.length) % items.length);
          var b = li.querySelector('.cprio-btn');
          if (b) setOpen(b, null, on);
        });
      }
      items.forEach(function (li, i) {
        var body = bodyOf(li);
        var b = headButton(li, base + '-b' + i);
        if (!b) return;
        if (body) { body.id = base + '-p' + i; b.setAttribute('aria-controls', body.id); }
        b.addEventListener('click', function () { front(i); });
      });
      front(0);
    },

    spotlight: function (mod, list, items) { focusable(items); },
    magnify: function (mod, list, items) { focusable(items); },

    reveal: function (mod, list, items, base) {
      items.forEach(function (li, i) {
        var body = bodyOf(li);
        var b = btnEl('cpbtn cprio-more', 'Read more');
        b.setAttribute('aria-expanded', 'false');
        if (body) { body.id = base + '-p' + i; b.setAttribute('aria-controls', body.id); }
        /* The panel needs an OUTER box of its own to collapse against: the
           slot is the 0fr↔1fr grid track, the body is the clipped item inside
           it. Without the wrapper the panel had to be positioned to slide,
           and a positioned panel contributes no height — which is exactly how
           the card came to clip away its own title (see .cprio-slot in
           src/styles/candidate-priorities.css). */
        var slot = null;
        if (body) {
          slot = el('div', 'cprio-slot');
          li.insertBefore(slot, body);
          slot.appendChild(body);
        }
        li.insertBefore(b, slot || null);
        b.addEventListener('click', function () {
          var on = !li.classList.contains('is-on');
          li.classList.toggle('is-on', on);
          b.setAttribute('aria-expanded', String(on));
          b.textContent = on ? 'Hide' : 'Read more';
        });
      });
    },

    drift: function (mod, list, items) {
      var row = ctlRow(mod, list, true);
      var stopBtn = btnEl('cpbtn', 'Stop the drift');
      row.appendChild(stopBtn);
      var span = list.scrollWidth - list.clientWidth;
      if (span <= 4) { stopBtn.remove(); return; }
      var t0 = null;
      var raf = 0;
      var DUR = 4200; /* under five seconds — WCAG 2.2.2 needs no more, and the
                         Stop button is there anyway. */
      function halt() {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        stopBtn.remove();
      }
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / DUR);
        list.scrollLeft = span * k;
        if (k < 1) raf = window.requestAnimationFrame(step);
        else halt();
      }
      stopBtn.addEventListener('click', halt);
      list.addEventListener('pointerdown', halt);
      list.addEventListener('focusin', halt);
      list.addEventListener('wheel', halt, { passive: true });
      raf = window.requestAnimationFrame(step);
    },

    steps: function (mod, list, items) {
      if (items.length < 2) return;
      items.forEach(function (li, i) { if (i > 0) li.hidden = true; });
      var row = ctlRow(mod, list, true);
      var b = btnEl('cpbtn', 'Show the next priority');
      var status = el('span', 'cpstatus', '1 of ' + items.length);
      status.setAttribute('role', 'status');
      row.appendChild(b);
      row.appendChild(status);
      var shown = 1;
      b.addEventListener('click', function () {
        if (shown >= items.length) return;
        var li = items[shown];
        li.hidden = false;
        li.tabIndex = -1;
        li.focus();
        shown++;
        status.textContent = shown + ' of ' + items.length;
        if (shown >= items.length) {
          b.disabled = true;
          b.textContent = 'That’s all of them';
        }
      });
    },

    timeline: function (mod, list, items) { whenSeen(items, lit); },
    stagger: function (mod, list, items) { whenSeen(items, lit); },
    highlighter: function (mod, list, items) { whenSeen(items, lit); },

    counter: function (mod, list, items) {
      whenSeen(items, function (li, i) {
        lit(li);
        var n = li.querySelector('.cprio-num');
        if (!n) return;
        var to = parseInt((n.textContent || '').trim(), 10);
        if (!to || !window.requestAnimationFrame) return;
        var t0 = null;
        n.textContent = '0';
        window.requestAnimationFrame(function tick(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / 620);
          n.textContent = String(Math.max(0, Math.round(to * k)));
          if (k < 1) window.requestAnimationFrame(tick);
          else n.textContent = String(to);
        });
        /* Belt and braces: whatever happens to the frame loop, the ordinal is
           back to its real value well inside a second and a half. */
        window.setTimeout(function () { n.textContent = String(to); }, 1500);
      });
    },

    stack: function () { /* CSS only — position: sticky per card. */ },
  };

  function lit(li) { if (li && li.classList) li.classList.add('is-lit'); }
  /* The pointer presets need a keyboard and a TOUCH equivalent: make each card
     a focus stop so Tab moves the spotlight / the magnifier / the card lift,
     and — with `tap` — let a pointer or Enter/Space mark one and keep it
     marked, which is the only thing a touch visitor can do. They are visible
     cards, so this adds no focus stop on hidden content, and nothing is hidden
     either way: the mark is a highlight, not a disclosure. */
  function focusable(items, tap) {
    items.forEach(function (li) {
      li.tabIndex = 0;
      li.addEventListener('focus', function () { li.classList.add('is-on'); });
      li.addEventListener('blur', function () { if (!li.dataset.held) li.classList.remove('is-on'); });
      if (!tap) return;
      function hold() {
        var on = li.dataset.held !== '1';
        items.forEach(function (o) {
          if (o === li) return;
          delete o.dataset.held;
          o.classList.remove('is-on');
        });
        if (on) { li.dataset.held = '1'; li.classList.add('is-on'); }
        else { delete li.dataset.held; li.classList.remove('is-on'); }
      }
      li.addEventListener('click', hold);
      li.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.preventDefault();
        hold();
      });
    });
  }

  /* ---------- wire them up ------------------------------------------------ */
  var uid = 0;
  mods.forEach(function (mod) {
    var list = mod.querySelector('[data-prios]');
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-prio]'));
    if (!items.length) return;
    var preset = list.getAttribute('data-prios-preset') || 'cards';
    var run = PRESETS[preset] || PRESETS.cards;
    var base = 'cp' + ++uid;
    items.forEach(function (li, i) { li.style.setProperty('--d', String(i)); });
    try {
      run(mod, list, items, base);
    } catch (err) {
      /* A broken preset must never cost the visitor the list: undo nothing,
         add nothing, leave the server's markup exactly as it was. */
      return;
    }
    list.classList.add('is-live');
    mod.setAttribute('data-prios-live', preset);
  });
})();
