/* "The Watchdog" experience (template: experience-integrity).
   Progressive enhancement only — the page is complete without this file:
   the full policy text renders in clean case-file prose and the oversight
   board shows today's arrangement. This script classifies the dossier
   typography (tabs, ledger lines, stamped verdicts, sources), drives the
   Today/VIIPA oversight board, builds the heading rail, and adds counters,
   reveals and the progress beam. Decorative motion is disabled under
   prefers-reduced-motion; the controls keep working. */
(function () {
  'use strict';

  var page = document.getElementById('cxPage');
  if (!page) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Case-file typography classifier ------------------------------------ */
  // The source document uses recurring patterns: "1.1." bold lead-ins,
  // "·" bullet paragraphs, bold-italic verdict lines, "…:" group lead-ins,
  // and an <hr> before each section's sources. Tag them so the stylesheet
  // can set them as tabs, ledger lines, stamps, groups and source columns.
  function stripLeadingDot(el) {
    var tn = el.firstChild;
    while (tn && tn.nodeType !== 3 && tn.firstChild) tn = tn.firstChild;
    if (tn && tn.nodeType === 3) tn.textContent = tn.textContent.replace(/^\s*·\s*/, '');
  }
  page.querySelectorAll('.cx-sec-body').forEach(function (body) {
    var kids = [].slice.call(body.children);
    var srcWrap = null;
    var seenHr = false;
    var prevWasLine = false;
    kids.forEach(function (el, idx) {
      if (el.tagName === 'HR') {
        seenHr = true;
        srcWrap = document.createElement('div');
        srcWrap.className = 'cx-src-wrap';
        body.insertBefore(srcWrap, el.nextSibling);
        return;
      }
      if (seenHr && srcWrap) {
        if (el !== srcWrap) {
          srcWrap.appendChild(el);
          if (el.tagName === 'P') el.classList.add('cx-src');
        }
        return;
      }
      if (el.tagName !== 'P') return;
      var text = (el.textContent || '').trim();
      var kidsEls = [].slice.call(el.children);
      var bareText = [].slice.call(el.childNodes).some(function (n) {
        return n.nodeType === 3 && n.textContent.trim().length > 1;
      });
      var allEmphasis = kidsEls.length > 0 && !bareText && kidsEls.every(function (c) {
        return c.tagName === 'STRONG' || c.tagName === 'EM';
      });
      var next = kids[idx + 1];
      var nextIsBullet = next && next.tagName === 'P' && (next.textContent || '').trim().charAt(0) === '·';
      var wasLine = prevWasLine;
      prevWasLine = false;

      if (text.charAt(0) === '·') {
        // proper marker comes from CSS — drop the literal glyph
        el.classList.add('cx-line');
        stripLeadingDot(el);
        prevWasLine = true;
      } else if (wasLine && nextIsBullet && text.length < 160 && !allEmphasis) {
        // a list line whose "·" was lost in the source — sandwiched
        // between bullets, so keep it in the ledger
        el.classList.add('cx-line');
        prevWasLine = true;
      } else if (allEmphasis && /^\d+\.\d+/.test(text)) {
        el.classList.add('cx-tab');
      } else if (allEmphasis) {
        el.classList.add('cx-verdict');
        if (!el.querySelector('em') && text.length > 120) el.classList.add('cx-verdict--big');
      } else if ((/:$/.test(text) && text.length < 120) || (nextIsBullet && text.length < 120)) {
        el.classList.add('cx-group');
      } else {
        el.classList.add('cx-flow');
      }
    });
    if (srcWrap) {
      body.classList.add('cx-has-src');
      var srcHead = document.createElement('p');
      srcHead.className = 'cx-src-head';
      srcHead.textContent = 'Paper trail · sources';
      srcWrap.insertBefore(srcHead, srcWrap.firstChild);
    }
  });

  /* ---- Build units: each numbered sub-part becomes a construction card ---- */
  // A "1.2."-style tab plus everything under it (until the next tab or the
  // sources rule) is wrapped into a .cx-unit: ink header beam with a yellow
  // number plate, hazard stripe, and a body whose blocks stack in with a
  // stagger when the card scrolls into view. Without JS the flow reads as
  // plain tabs + prose.
  page.querySelectorAll('.cx-sec-body').forEach(function (body) {
    var kids = [].slice.call(body.children);
    var unit = null;
    var ubody = null;
    var count = 0;
    kids.forEach(function (el) {
      if (el.classList && el.classList.contains('cx-tab')) {
        unit = document.createElement('section');
        unit.className = 'cx-unit cx-reveal';
        var head = document.createElement('div');
        head.className = 'cx-unit-head';
        var text = (el.textContent || '').trim();
        var m = text.match(/^(\d+\.\d+)\.?\s*(.*)$/);
        var n = document.createElement('span');
        n.className = 'cx-unit-n';
        n.textContent = m ? m[1] : '§';
        var t = document.createElement('span');
        t.className = 'cx-unit-t';
        t.textContent = m ? m[2] : text;
        head.appendChild(n);
        head.appendChild(t);
        var stripe = document.createElement('div');
        stripe.className = 'cx-unit-stripe';
        stripe.setAttribute('aria-hidden', 'true');
        ubody = document.createElement('div');
        ubody.className = 'cx-unit-body';
        unit.appendChild(head);
        unit.appendChild(stripe);
        unit.appendChild(ubody);
        body.insertBefore(unit, el);
        el.remove();
        count = 0;
        return;
      }
      if (el.tagName === 'HR' || (el.classList && el.classList.contains('cx-src-wrap'))) {
        unit = null;
        ubody = null;
        return;
      }
      if (unit && ubody) {
        el.style.setProperty('--i', count++);
        ubody.appendChild(el);
      }
    });
  });

  /* ---- Footnote markers: wrap "[i]"-style citations as badges ------------- */
  page.querySelectorAll('.cx-sec-body').forEach(function (body) {
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    var targets = [];
    var node;
    while ((node = walker.nextNode())) {
      if (/\[[ivxlc]+\]/.test(node.textContent)) targets.push(node);
    }
    targets.forEach(function (tn) {
      var text = tn.textContent;
      var re = /\[([ivxlc]+)\]/g;
      var frag = document.createDocumentFragment();
      var last = 0;
      var m;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var sup = document.createElement('sup');
        sup.className = 'cx-fn';
        sup.textContent = m[1];
        frag.appendChild(sup);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    });
  });

  /* ---- Two-way footnotes: badges ↔ the paper trail ------------------------ */
  // The numerals restart in every part, so links are scoped to each section's
  // own sources block. In-text badges become links DOWN to the matching
  // source; each cited source's leading numeral becomes a back-link UP to the
  // first in-text marker. Both journeys use "the highlighter draw": the origin
  // plate dips (a stamp press), one smooth browser scroll, and the destination
  // draws a yellow sweep across itself and settles. Without js-motion the jump
  // is instant with a calm static wash. Sources whose numeral never appears in
  // the text keep a plain plate — no dead back-links.
  var fnMotion = document.documentElement.classList.contains('js-motion');
  page.querySelectorAll('.cx-sec-body').forEach(function (body, bi) {
    var sec = body.closest('.cx-sec');
    var tag = (sec && sec.getAttribute('data-n')) || String(bi + 1);
    var wrap = body.querySelector('.cx-src-wrap');
    if (!wrap) return;
    var srcByNum = {};
    [].slice.call(wrap.querySelectorAll('.cx-src')).forEach(function (p) {
      var lead = p.querySelector('sup.cx-fn');
      if (!lead || lead.parentElement !== p) return;
      var before = lead.previousSibling;
      if (before && !(before.nodeType === 3 && !before.textContent.trim())) return; // numeral must open the entry
      var key = (lead.textContent || '').trim();
      if (!key || srcByNum[key]) return;
      p.id = 'cx-src-' + tag + '-' + key;
      p.setAttribute('tabindex', '-1');
      srcByNum[key] = { p: p, lead: lead };
    });
    var firstMark = {};
    [].slice.call(body.querySelectorAll('sup.cx-fn')).forEach(function (sup) {
      if (sup.closest('.cx-src-wrap')) return;
      var key = (sup.textContent || '').trim();
      var src = srcByNum[key];
      if (!src) return;
      var a = document.createElement('a');
      a.href = '#' + src.p.id;
      a.textContent = key;
      a.setAttribute('aria-label', 'Reference ' + key);
      sup.textContent = '';
      sup.classList.add('cx-fn--link');
      sup.appendChild(a);
      if (!firstMark[key]) {
        firstMark[key] = sup;
        sup.id = 'cx-fn-' + tag + '-' + key;
      }
    });
    Object.keys(firstMark).forEach(function (key) {
      var src = srcByNum[key];
      var back = document.createElement('a');
      back.className = 'cx-fn-back';
      back.href = '#' + firstMark[key].id;
      back.textContent = key;
      back.setAttribute('aria-label', 'Back to reference ' + key + ' in the text');
      src.lead.textContent = '';
      src.lead.classList.add('cx-fn--link');
      src.lead.appendChild(back);
      src.p.classList.add('cx-src--linked');
    });
  });

  function fnEffect(el, cls) {
    if (!el) return;
    var timers = el._fnT || (el._fnT = {});
    if (timers[cls]) window.clearTimeout(timers[cls]);
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation cleanly on repeat clicks
    el.classList.add(cls);
    timers[cls] = window.setTimeout(function () { el.classList.remove(cls); }, cls === 'cx-fn-hit' ? 450 : 2800);
  }

  function fnTravel(origin, target, lands, focusEl) {
    fnEffect(origin, 'cx-fn-hit');
    try { history.pushState(null, '', '#' + target.id); } catch (e) { /* sandboxed */ }
    target.scrollIntoView({ behavior: fnMotion ? 'smooth' : 'auto', block: 'center' });
    lands.forEach(function (pair) { fnEffect(pair[0], pair[1]); });
    window.setTimeout(function () {
      if (focusEl && focusEl.focus) focusEl.focus({ preventScroll: true });
    }, fnMotion ? 700 : 0);
  }

  page.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if (!a) return;
    var id = (a.getAttribute('href') || '').slice(1);
    if (a.classList.contains('cx-fn-back')) {
      // UP: numeral → first in-text marker; sweep its line, pop the badge.
      var sup = document.getElementById(id);
      if (!sup) return;
      ev.preventDefault();
      var line = sup.closest('p, li') || sup.parentElement;
      fnTravel(a, sup, [[line, 'cx-fn-landline'], [sup, 'cx-fn-land']], sup.querySelector('a') || sup);
    } else if (a.parentElement && a.parentElement.classList && a.parentElement.classList.contains('cx-fn')) {
      // DOWN: badge → the source entry; sweep the entry, stamp its plate.
      var src = document.getElementById(id);
      if (!src) return;
      ev.preventDefault();
      fnTravel(a, src, [[src, 'cx-fn-land']], src);
    }
  });

  /* ---- Section rail from the page's own headings -------------------------- */
  var rail = document.getElementById('cxRail');
  var heads = [];
  var boardH = document.getElementById('oversight-h');
  if (boardH) heads.push(boardH);
  page.querySelectorAll('.cx-sec h2, .cx-prose h2').forEach(function (h) { heads.push(h); });
  if (rail && heads.length) {
    heads.forEach(function (h, i) {
      if (!h.id) {
        h.id = 'cx-' + (h.textContent || 's' + i).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
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

  /* ---- The oversight board ------------------------------------------------- */
  // Schematic of the policy's own findings (section 01/03) and the three
  // VIIPA powers (section 02) — captions quote the case file.
  var MODES = {
    today: {
      big: 'Front-end only',
      cap: 'independent scrutiny today, before a project is "too big to stop"',
      note: 'Reporting is inconsistent across departments, problems are escalated too late, review bodies lack intervention powers — and there is no real-time reporting, despite the public funding.',
      stages: [
        ['is-partial', 'reviewed early'],
        ['is-partial', 'front-end approval'],
        ['is-gap', 'little independent rigour'],
        ['is-gap', '"too big to stop"'],
        ['is-gap', 'post-hoc accountability'],
      ],
    },
    viipa: {
      big: 'Whole-of-life',
      cap: 'independent, empowered oversight across the full project lifecycle',
      note: 'Power 1: no procurement without an independently reviewed business case. Power 2: standardised quarterly reporting and deep-dive reviews during delivery. Power 3: pause or stop when value for money collapses — with final termination authority sitting with Parliament.',
      stages: [
        ['is-covered', 'independent business case'],
        ['is-covered', 'public approval statement'],
        ['is-covered', '$500m threshold · PPPs in scope'],
        ['is-covered', 'quarterly reporting · pause power'],
        ['is-covered', 'dashboards & lessons published'],
      ],
    },
  };
  var stages = [].slice.call(page.querySelectorAll('.cx-stage'));
  var bigEl = document.getElementById('cxBig');
  var capEl = document.getElementById('cxBigCap');
  var noteEl = document.getElementById('cxNote');
  var modesEl = document.getElementById('cxModes');

  function applyMode(name, animate) {
    var m = MODES[name];
    if (!m) return;
    stages.forEach(function (li, i) {
      var shield = li.querySelector('.cx-shield');
      var cap = li.querySelector('.cx-stage-cap');
      if (shield) shield.style.transitionDelay = animate && !reduce ? (i * 70) + 'ms' : '0ms';
      li.classList.remove('is-partial', 'is-gap', 'is-covered');
      li.classList.add(m.stages[i][0]);
      if (cap) cap.textContent = m.stages[i][1];
    });
    if (bigEl) bigEl.textContent = m.big;
    if (capEl) capEl.textContent = m.cap;
    if (noteEl) noteEl.textContent = m.note;
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
  applyMode('today', false);

  /* ---- Reveals + counters (motion only) ------------------------------------ */
  if (!reduce && 'IntersectionObserver' in window) {
    page
      .querySelectorAll(
        '.cx-sec-head, .cx-sec-body > *, ' +
          '.cx-prose h2, .cx-prose h3, .cx-prose p, .cx-prose ul, .cx-prose ol'
      )
      .forEach(function (el) { el.classList.add('cx-reveal'); });
    var revealer = new IntersectionObserver(
      function (entries) {
        var delay = 0;
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          el.style.transitionDelay = delay + 'ms';
          el.classList.add('cx-in');
          el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
          delay = Math.min(delay + 60, 240);
          revealer.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    page.querySelectorAll('.cx-reveal').forEach(function (el) { revealer.observe(el); });

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
          var start = null;
          var stepFn = function (ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / 1100, 1);
            var v = target * ease(p);
            el.textContent = decimals ? v.toFixed(decimals) : String(Math.round(v));
            if (p < 1) requestAnimationFrame(stepFn);
          };
          requestAnimationFrame(stepFn);
        });
      },
      { threshold: 0.6 }
    );
    page.querySelectorAll('.cx-num[data-target]').forEach(function (n) { counter.observe(n); });
  }

  /* ---- Scroll loop: progress beam + rail spy --------------------------------
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
  var bar = document.getElementById('cxProgress');
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
