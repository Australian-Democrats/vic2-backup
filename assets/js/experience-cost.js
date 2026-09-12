/* "ITEMISED" — Cost of Living experience behaviour (experience-cost).
   Progressive enhancement over the verbatim policy HTML:
   · classifier: docket captions, Action/Impact markers, price-tag chips
     extracted from the policy's own figures, failure dockets (Issues),
     twin dockets + verdict stamps (Evidence)
   · hero receipt print-in, section reveals, "ON THE BILL" stamps
   · running-tape rail scrollspy with per-pillar action tallies
   · the Bill Decomposer (itemise an opaque total; >10% trigger dial)
   · reading-progress bar
   All motion is gated on html.js-motion (set by effects.js only when JS
   runs and the visitor allows motion); with JS off the page is a clean,
   fully readable document. The policy text itself is never rewritten —
   nodes are tagged, wrapped and annotated only. */
(function () {
  'use strict';

  var page = document.getElementById('colPage');
  if (!page) return;

  var motion = document.documentElement.classList.contains('js-motion');

  // Two-way footnote registries (page-global — reference numbers are unique
  // across the whole document): first in-text marker per number, and the
  // References entry per number.
  var fnFirst = {};
  var refItems = {};

  // Editable chrome (Keystatic → "Cost of living experience") embedded by the
  // component; everything falls back to the shipped defaults if absent.
  var CONF = {};
  try {
    var confEl = document.getElementById('colData');
    if (confEl) CONF = JSON.parse(confEl.textContent || '{}') || {};
  } catch (e) { CONF = {}; }

  /* ================= classifier ================= */
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  // Price-tag extraction: the plan's own figures become chips.
  var CHIP_RES = [
    /up to 100%/i, /\b100%/, /\b40 years?\b/i, /\b25 dwellings\b/i, /\b7 year\b/i,
    /\b99 year\b/i, /\bafter 3 years\b/i, /> ?10%/, /\b4\.85%\b/, /~ ?10%/,
    /\bage of 22\b/i, /\b30 days\b/i, /up to 50%/i, /\$10 million/i, /\b10–15%/,
    /\$200–300 million/i, /up to 30–50%/i, /\$250,000/,
  ];
  function chipFor(liText) {
    if (/^free transport/i.test(liText)) return { text: '$0.00', free: true };
    for (var i = 0; i < CHIP_RES.length; i++) {
      var m = liText.match(CHIP_RES[i]);
      if (m) return { text: m[0].replace(/^after /i, '').replace(/^age of /i, '≤').toUpperCase(), free: false };
    }
    return null;
  }

  function classify(sec) {
    var body = sec.querySelector('.col-sec-body');
    if (!body) return;
    var kind = sec.getAttribute('data-sec') || '';

    // 1) Docket captions + ACTION/IMPACT markers (all sections).
    body.querySelectorAll('p').forEach(function (p) {
      var s = p.querySelector('strong');
      if (!s) return;
      var t = txt(p);
      if (/^(Table|Figure)\s+\d+:/i.test(t)) p.classList.add('col-cap');
      else if (/^(Action\(s\)|Impact\(s\))$/i.test(t)) {
        p.classList.add('col-mark');
        p.setAttribute('data-mark', /impact/i.test(t) ? 'impact' : 'action');
      }
    });
    // Impacts list follows its marker.
    body.querySelectorAll('.col-mark[data-mark="impact"]').forEach(function (mark) {
      var next = mark.nextElementSibling;
      if (next && next.tagName === 'UL') next.classList.add('col-back');
    });

    // 2) Price-tag chips on top-level action line items (pillar sections).
    if (sec.classList.contains('col-sec--pillar')) {
      body.querySelectorAll('.col-mark[data-mark="action"]').forEach(function (mark) {
        var ul = mark.nextElementSibling;
        if (!ul || ul.tagName !== 'UL') return;
        Array.prototype.forEach.call(ul.children, function (li) {
          var first = li.childNodes[0];
          var lead = first ? (first.textContent || '') : '';
          var chip = chipFor(txt(li).slice(0, 160)) || chipFor(lead);
          if (!chip) return;
          var tag = document.createElement('span');
          tag.className = 'col-chip' + (chip.free ? ' col-chip--free' : '');
          tag.textContent = chip.text;
          tag.setAttribute('aria-hidden', 'true');
          li.insertBefore(tag, li.firstChild);
        });
      });
    }

    // 3) The Issues: manifest list + failure dockets.
    if (kind === 'issues') {
      // The five-element manifest (bold-italic "Pillar:" lead-ins).
      body.querySelectorAll('ul').forEach(function (ul) {
        var first = ul.querySelector('li strong em, li em strong');
        if (first && ul.children.length === 5) ul.classList.add('col-manifest');
      });
      // Failure dockets: after the Table 1 caption, pairs of
      // <p><strong>Pillar: problem</strong></p> + <ul>(2 li)</ul>.
      var cap = null;
      body.querySelectorAll('.col-cap').forEach(function (c) { if (/^Table 1:/i.test(txt(c))) cap = c; });
      if (cap) {
        var grid = document.createElement('div');
        grid.className = 'col-fail-grid';
        var node = cap.nextElementSibling;
        var moves = [];
        while (node) {
          var nxt = node.nextElementSibling;
          if (node.tagName === 'P' && node.querySelector('strong') && nxt && nxt.tagName === 'UL') {
            moves.push([node, nxt]);
            node = nxt.nextElementSibling;
          } else break;
        }
        if (moves.length) {
          cap.parentNode.insertBefore(grid, moves[0][0]);
          moves.forEach(function (pair) {
            var card = document.createElement('div');
            card.className = 'col-fail js-reveal';
            grid.appendChild(card);
            card.appendChild(pair[0]);
            card.appendChild(pair[1]);
          });
        }
      }
    }

    // 4) References: anchor each numbered source so the in-text footnote
    //    badges can link to it. (List styling is CSS; ids are all we add.)
    if (kind === 'references') {
      var refOl = body.querySelector('ol');
      if (refOl) {
        Array.prototype.forEach.call(refOl.children, function (li, i) {
          if (!li.id) li.id = 'ref-' + (i + 1);
          refItems[String(i + 1)] = li;
        });
      }
    }

    // 5) Footnote markers: bare "[N]" runs in the text become superscript
    //    badges linking to the matching References entry. Text-node surgery
    //    only — the marker characters come from the document itself and are
    //    replaced with a link containing the same number. Skipped inside the
    //    References list (its numbers are the entries, not markers).
    if (kind !== 'references' && window.document.createTreeWalker) {
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!/\[\d{1,2}\]/.test(n.nodeValue || '')) return NodeFilter.FILTER_REJECT;
          if (n.parentElement && n.parentElement.closest('sup, a, .col-cap')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      var targets = [];
      while (walker.nextNode()) targets.push(walker.currentNode);
      targets.forEach(function (node) {
        var frag = document.createDocumentFragment();
        var rest = node.nodeValue || '';
        var m;
        while ((m = rest.match(/\[(\d{1,2})\]/))) {
          if (m.index > 0) frag.appendChild(document.createTextNode(rest.slice(0, m.index)));
          var sup = document.createElement('sup');
          sup.className = 'col-fn';
          var a = document.createElement('a');
          a.href = '#ref-' + m[1];
          a.textContent = m[1];
          a.setAttribute('aria-label', 'Reference ' + m[1]);
          sup.appendChild(a);
          // First occurrence of each number anchors the numeral back-link
          // from the References entry (the two-way jump lands here).
          if (!fnFirst[m[1]]) {
            fnFirst[m[1]] = sup;
            sup.id = 'fnref-' + m[1];
          }
          frag.appendChild(sup);
          rest = rest.slice(m.index + m[0].length);
        }
        if (rest) frag.appendChild(document.createTextNode(rest));
        node.parentNode.replaceChild(frag, node);
      });
    }

    // 6) The Evidence: twin dockets + verdict stamps.
    if (kind === 'evidence') {
      var uls = body.querySelectorAll(':scope > ul, :scope ul');
      uls = Array.prototype.filter.call(uls, function (u) { return !u.closest('.col-twins'); });
      if (uls.length >= 2) {
        var lead1 = uls[0].previousElementSibling;
        var lead2 = uls[1].previousElementSibling;
        var twins = document.createElement('div');
        twins.className = 'col-twins';
        var anchor = lead1 && lead1.tagName === 'P' ? lead1 : uls[0];
        anchor.parentNode.insertBefore(twins, anchor);
        var mk = function (cls, label, lead, ul) {
          var d = document.createElement('div');
          d.className = 'col-twin ' + cls + ' js-reveal';
          d.setAttribute('data-label', label);
          twins.appendChild(d);
          if (lead && lead.tagName === 'P') d.appendChild(lead);
          d.appendChild(ul);
        };
        mk('col-twin--cost', CONF.twinCostLabel || 'IF LEFT UNADDRESSED', lead1, uls[0]);
        mk('col-twin--gain', CONF.twinGainLabel || 'IF REFORMED', lead2, uls[1]);
      }
      // Verdict: trailing bold-italic paragraphs.
      body.querySelectorAll('p').forEach(function (p) {
        var em = p.querySelector('em strong, strong em');
        if (em && txt(em).length > txt(p).length * 0.8) p.classList.add('col-verdict');
      });
    }
  }
  page.querySelectorAll('.col-sec').forEach(classify);

  /* ========== two-way footnotes — "the highlighter draw" ==========
     Badge → entry and numeral → marker share one travel routine: the origin
     plate acknowledges the press (a till-key dip), the page makes ONE smooth
     scroll (browser-driven — never hijacked), and the destination draws a
     highlighter sweep across itself, holds, and settles clean. Without
     js-motion the jump is instant and the destination gets a calm static
     wash instead. Focus always lands on the destination for keyboard/AT.
     Each References entry whose number appears in the text gets a REAL
     back-link numeral (replacing the CSS-counter plate); entries whose
     number never appears keep the plain counter — no dead back-links. */
  Object.keys(refItems).forEach(function (n) {
    var li = refItems[n];
    li.setAttribute('tabindex', '-1');
    if (!fnFirst[n]) return;
    var back = document.createElement('a');
    back.className = 'col-fn-back';
    back.href = '#fnref-' + n;
    back.textContent = n;
    back.setAttribute('aria-label', 'Back to reference ' + n + ' in the text');
    li.classList.add('col-ref--linked');
    li.insertBefore(back, li.firstChild);
  });

  function fnEffect(el, cls) {
    if (!el) return;
    var timers = el._fnT || (el._fnT = {});
    if (timers[cls]) window.clearTimeout(timers[cls]);
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation cleanly on repeat clicks
    el.classList.add(cls);
    timers[cls] = window.setTimeout(function () { el.classList.remove(cls); }, cls === 'col-fn-hit' ? 450 : 2800);
  }

  function fnTravel(origin, target, lands, focusEl) {
    fnEffect(origin, 'col-fn-hit');
    try { history.pushState(null, '', '#' + target.id); } catch (e) { /* sandboxed */ }
    target.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' });
    lands.forEach(function (pair) { fnEffect(pair[0], pair[1]); });
    window.setTimeout(function () {
      if (focusEl && focusEl.focus) focusEl.focus({ preventScroll: true });
    }, motion ? 700 : 0);
  }

  page.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if (!a) return;
    var id = (a.getAttribute('href') || '').slice(1);
    if (a.classList.contains('col-fn-back')) {
      // UP: numeral → the first in-text marker; sweep its line, pop the badge.
      var sup = document.getElementById(id);
      if (!sup) return;
      ev.preventDefault();
      var line = sup.closest('p, li') || sup.parentElement;
      fnTravel(a, sup, [[line, 'col-fn-landline'], [sup, 'col-fn-land']], sup.querySelector('a') || sup);
    } else if (a.parentElement && a.parentElement.classList && a.parentElement.classList.contains('col-fn')) {
      // DOWN: badge → the References entry; sweep the entry, stamp its plate.
      var li = document.getElementById(id);
      if (!li) return;
      ev.preventDefault();
      fnTravel(a, li, [[li, 'col-fn-land']], li);
    }
  });

  /* ================= section rail (the row under the site menu) =============
     Server-rendered anchors (so it works with JS off); the script only moves
     the aria-current highlight and slides the rail's OWN scrollLeft to keep
     the current pill in view.

     Never Element.scrollIntoView() for that: the rail is sticky inside the
     document's scroll-padding-top band (global.css `html { scroll-padding-top:
     calc(var(--header-h) + 1rem) }`), so asking the browser to reveal a pill
     makes it "correct" the DOCUMENT scroll by ~6px — which is exactly the
     stop-start readers reported on the sibling experience pages. Moving the
     rail's own scroller cannot reach the page scroller.

     Pill geometry is measured off the scroll path and cached; nothing here
     touches layout during a scroll. */
  var rail = document.getElementById('colRail');
  var railLinks = {};
  var railOrder = [];
  var pillPos = [];
  var railW = 0;
  var railMax = 0;
  var railTarget = -1;
  var railDirty = true;
  if (rail) {
    rail.querySelectorAll('a[data-rail]').forEach(function (a) {
      railLinks[a.getAttribute('data-rail')] = a;
      railOrder.push(a);
    });
  }
  function measureRail() {
    railDirty = false;
    if (!rail) return;
    railW = rail.clientWidth;
    railMax = Math.max(rail.scrollWidth - railW, 0);
    pillPos = railOrder.map(function (a) { return [a.offsetLeft, a.offsetWidth]; });
  }
  function markRail(id) {
    if (!rail) return;
    var idx = -1;
    for (var i = 0; i < railOrder.length; i++) {
      var on = railOrder[i] === railLinks[id];
      if (on) { railOrder[i].setAttribute('aria-current', 'true'); idx = i; }
      else railOrder[i].removeAttribute('aria-current');
    }
    if (idx < 0) return;
    if (railDirty) measureRail();
    if (!pillPos[idx] || railMax <= 0) return;
    var left = Math.max(0, Math.min(pillPos[idx][0] - (railW - pillPos[idx][1]) / 2, railMax));
    if (Math.abs(left - railTarget) < 1) return;
    railTarget = left;
    if (rail.scrollTo) rail.scrollTo({ left: left, behavior: motion ? 'smooth' : 'auto' });
    else rail.scrollLeft = left;
  }

  /* ================= tape rail ================= */
  var tape = document.getElementById('colTape');
  var rows = {};
  if (tape) {
    tape.querySelectorAll('.col-tape-row').forEach(function (r) { rows[r.getAttribute('data-tape')] = r; });
    // Initial values: pillar rows show their real action tallies.
    page.querySelectorAll('.col-sec').forEach(function (sec) {
      var key = sec.classList.contains('col-sec--pillar') ? sec.id : sec.getAttribute('data-sec');
      var row = rows[key];
      if (!row) return;
      var val = row.querySelector('[data-val]');
      if (!val) return;
      if (sec.classList.contains('col-sec--pillar')) {
        var mark = sec.querySelector('.col-mark[data-mark="action"]');
        var ul = mark && mark.nextElementSibling;
        var n = ul && ul.tagName === 'UL' ? ul.children.length : 0;
        val.textContent = n ? n + ' ACTIONS' : '—';
        row.setAttribute('data-count', String(n));
      } else if (key === 'issues') {
        var costs = sec.querySelectorAll('.col-fail').length || sec.querySelectorAll('.col-manifest > li').length || 5;
        val.textContent = costs + ' COSTS';
      } else if (key === 'evidence') val.textContent = 'THE CASE';
    });
  }

  /* ================= reveals + spy ================= */
  var revealEls = page.querySelectorAll('.js-reveal, .js-stamp');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });

    // One observer drives BOTH the section rail and the running tape, so the
    // two can never disagree about which section the reader is in — and the
    // arrival cue costs no scroll-time geometry at all.
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var sec = e.target;
        markRail(sec.id);
        var key = sec.classList.contains('col-sec--pillar') ? sec.id : sec.getAttribute('data-sec');
        var row = rows[key];
        if (!row) return;
        Object.keys(rows).forEach(function (k) { rows[k].classList.remove('is-here'); });
        row.classList.add('is-here');
        if (!row.classList.contains('is-done')) {
          row.classList.add('is-done');
          var val = row.querySelector('[data-val]');
          if (val) val.textContent = (val.textContent || '').replace(/ ?✓?$/, '') + ' ✓';
        }
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    page.querySelectorAll('.col-sec').forEach(function (s) { spy.observe(s); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ================= hero print-in ================= */
  var printLines = page.querySelectorAll('.js-print');
  if (motion) {
    printLines.forEach(function (l, i) {
      l.style.transitionDelay = 180 + i * 140 + 'ms';
      requestAnimationFrame(function () { requestAnimationFrame(function () { l.classList.add('is-in'); }); });
      l.addEventListener('transitionend', function () { l.style.transitionDelay = ''; }, { once: true });
    });
  } else {
    printLines.forEach(function (l) { l.classList.add('is-in'); });
  }

  /* ================= "tear here" — rip the stub, land on the plan ========= */
  var hint = document.getElementById('colHint');
  var firstSec = page.querySelector('.col-sec');
  if (hint && firstSec) {
    var tearing = false;
    hint.addEventListener('click', function () {
      if (tearing) return;
      var land = function () {
        firstSec.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'start' });
        // Move reading focus to the section heading for keyboard/AT users.
        var h = firstSec.querySelector('h2');
        if (h) {
          h.setAttribute('tabindex', '-1');
          window.setTimeout(function () { h.focus({ preventScroll: true }); }, motion ? 700 : 0);
        }
      };
      if (!motion) { land(); return; }
      tearing = true;
      page.classList.add('col-tearing');
      window.setTimeout(land, 420); // scissors mid-run when the scroll starts
      window.setTimeout(function () {
        page.classList.remove('col-tearing');
        tearing = false;
      }, 1700);
    });
  }

  /* ================= progress bar =================
     Compositor-only: the bar is full width and slides left by the remaining
     fraction. It used to animate `width` from a value recomputed out of
     document.documentElement.scrollHeight on every scroll frame — a forced
     synchronous layout AND a relayout+repaint of the strip, every frame.
     The document height is now measured off the scroll path and re-measured
     only when the page can actually have changed size. */
  var fill = document.getElementById('colProgress');
  var docEl = document.documentElement;
  var scrollTicking = false;
  var scrollDirty = true;
  var scrollMax = 1;

  function measureScroll() {
    scrollDirty = false;
    scrollMax = Math.max(docEl.scrollHeight - docEl.clientHeight, 1);
  }
  function scrollFrame() {
    scrollTicking = false;
    if (scrollDirty) measureScroll();
    // read (cheap, no geometry API) …
    var p = Math.max(0, Math.min(window.pageYOffset / scrollMax, 1));
    // … then write.
    if (fill) fill.style.transform = 'translateX(' + ((p - 1) * 100).toFixed(3) + '%)';
  }
  function queueScroll() {
    if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(scrollFrame); }
  }
  function invalidateMetrics() { scrollDirty = true; railDirty = true; queueScroll(); }
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', invalidateMetrics, { passive: true });
  window.addEventListener('load', invalidateMetrics);
  if ('ResizeObserver' in window) {
    // Catches late-loading images and the font swap changing the page height.
    try { new ResizeObserver(invalidateMetrics).observe(document.body); } catch (e) { /* older engines */ }
  }
  queueScroll();

  /* ================= the Bill Decomposer ================= */
  // Bills come from the editable config; a shipped default keeps the module
  // alive if the singleton is ever emptied.
  var BILLS = (Array.isArray(CONF.bills) && CONF.bills.length ? CONF.bills : [
    {
      tab: '⚡ Energy bill',
      stamp: 'TRIGGERED — repricing review: quarterly updates, not annual',
      parts: [
        { name: 'Wholesale energy cost', share: '46%', highlight: true },
        { name: 'Network charges', share: '34%' },
        { name: 'Environmental cost', share: '8%' },
        { name: 'Retail margin', share: '12%' },
      ],
    },
  ]).map(function (b) {
    return {
      stamp: b.stamp || '',
      parts: Array.isArray(b.parts) ? b.parts : [],
    };
  });
  var bill = document.getElementById('colBill');
  var partsEl = document.getElementById('colBillParts');
  var itemiseBtn = document.getElementById('colItemise');
  var current = 0;

  function renderParts(idx) {
    if (!partsEl || !BILLS[idx]) return;
    partsEl.innerHTML = '';
    BILLS[idx].parts.forEach(function (p, i) {
      var d = document.createElement('div');
      d.className = 'col-part';
      if (p.highlight) d.setAttribute('data-w', '1');
      d.style.transitionDelay = motion ? i * 90 + 'ms' : '';
      var label = document.createElement('span');
      label.textContent = p.name || '';
      var share = document.createElement('i');
      share.textContent = p.share || '';
      d.appendChild(label);
      d.appendChild(share);
      partsEl.appendChild(d);
    });
  }
  function seal() {
    if (bill) bill.setAttribute('data-state', 'sealed');
    if (itemiseBtn) { itemiseBtn.removeAttribute('aria-disabled'); itemiseBtn.textContent = 'ITEMISE'; }
  }
  var decomp = document.getElementById('colDecomp');
  if (decomp) decomp.classList.add('is-live');
  if (bill && partsEl && itemiseBtn) {
    renderParts(current);
    itemiseBtn.addEventListener('click', function () {
      // aria-disabled + guard (not disabled=true): keyboard focus must not be
      // stranded on a disabled control mid-widget.
      if (itemiseBtn.getAttribute('aria-disabled') === 'true') return;
      bill.setAttribute('data-state', 'open');
      itemiseBtn.setAttribute('aria-disabled', 'true');
      itemiseBtn.textContent = 'ITEMISED ✓';
    });
    page.querySelectorAll('.col-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        current = Number(tab.getAttribute('data-bill')) || 0;
        page.querySelectorAll('.col-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-pressed', t === tab ? 'true' : 'false');
        });
        renderParts(current);
        seal();
        updateTrigger();
      });
    });
  }

  var dial = document.getElementById('colDial');
  var dialVal = document.getElementById('colDialVal');
  var triggerStamp = document.getElementById('colTriggerStamp');
  function updateTrigger() {
    if (!dial || !dialVal || !triggerStamp) return;
    var v = Number(dial.value);
    dialVal.textContent = v + '%';
    if (v > 10 && BILLS[current]) {
      triggerStamp.textContent = BILLS[current].stamp;
      triggerStamp.classList.add('is-armed');
    } else {
      triggerStamp.textContent = v === 0 ? '' : (CONF.triggerUnder || 'Under the 10% threshold — no trigger yet.');
      triggerStamp.classList.remove('is-armed');
    }
  }
  if (dial) {
    dial.addEventListener('input', updateTrigger);
    updateTrigger();
  }
})();
