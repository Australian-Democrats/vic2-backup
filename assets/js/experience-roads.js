/* "THE REPAIR TASK" — behaviour for the Roads experience
   (template: experience-roads). Loaded as an external file from the page's
   scripts slot: the site's CSP has no 'unsafe-inline', so nothing here may
   ever move into the document.

   Everything is progressive enhancement over the server-rendered page. With JS
   off: the policy reads as a plain document, the rail is plain anchors, every
   view of every figure is shown at once (the switches ship `hidden`), the
   return chart shows its full horizon and the footnote markers stay literal
   [N] text.

   Motion is gated on html.js-motion (set by effects.js only when the visitor
   has not asked for reduced motion); without it every state change is instant
   and the footnote landings use a calm static wash instead of the sweep. */
(function () {
  'use strict';

  var page = document.getElementById('rdPage');
  if (!page) return;

  var motion = document.documentElement.classList.contains('js-motion');

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the entrance on repeat presses
    el.classList.add(cls);
  }

  /* ------------------------------ progress ------------------------------ */
  var fill = document.getElementById('rdProgress');
  if (fill) {
    var ticking = false;
    var paint = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      fill.style.width = (p * 100).toFixed(2) + '%';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  /* --------------------------- reveal on scroll -------------------------- */
  if (motion && 'IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        revealIO.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    page.querySelectorAll('.rd-reveal').forEach(function (el) { revealIO.observe(el); });
  } else {
    page.querySelectorAll('.rd-reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------- the rail ------------------------------
     The anchors are server-rendered. The script only moves aria-current and
     slides the rail's OWN scrollLeft — never Element.scrollIntoView(), which
     would make the browser "correct" the document scroll against the sticky
     header's scroll-padding band (the stop-start reading reported on the
     sibling experience pages). */
  var rail = document.getElementById('rdRail');
  var railIn = rail ? rail.querySelector('.rd-rail-in') : null;
  var railLinks = rail ? Array.prototype.slice.call(rail.querySelectorAll('a[data-rail]')) : [];
  if (railLinks.length && 'IntersectionObserver' in window) {
    var current = null;
    var setCurrent = function (id) {
      if (id === current) return;
      current = id;
      railLinks.forEach(function (a) {
        var on = a.getAttribute('data-rail') === id;
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
        if (on && railIn) {
          var r = a.getBoundingClientRect();
          var rr = railIn.getBoundingClientRect();
          if (r.left < rr.left + 8) railIn.scrollLeft += r.left - rr.left - 16;
          else if (r.right > rr.right - 8) railIn.scrollLeft += r.right - rr.right + 16;
        }
      });
    };
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var h = en.target.querySelector('h2[id]');
          if (h) setCurrent(h.id);
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    page.querySelectorAll('.rd-sec').forEach(function (s) { secIO.observe(s); });
  }

  /* ------------------------------ the switches ---------------------------
     One behaviour for the road report, "today / with our plan" and the
     package. Each group names its views container; the views inside it carry
     data-rd-view. Without this file the container shows every view
     (data-mode="all") and the group stays hidden. Here the group is revealed,
     one view is shown at a time (the others get `hidden`, so a screen reader
     skips them too) and the chosen view's summary — the button's data-read —
     is announced through the figure's own polite live region. */
  page.querySelectorAll('[data-rd-switch]').forEach(function (group) {
    var box = document.getElementById(group.getAttribute('data-rd-switch'));
    if (!box) return;
    var btns = Array.prototype.slice.call(group.querySelectorAll('button[data-view]'));
    var views = Array.prototype.slice.call(box.querySelectorAll('[data-rd-view]'));
    var mod = group.closest('.rd-mod');
    var live = mod ? mod.querySelector('[data-rd-live]') : null;
    if (!btns.length || !views.length) return;

    var show = function (v, announce) {
      box.setAttribute('data-mode', v);
      btns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-view') === v ? 'true' : 'false');
      });
      views.forEach(function (el) {
        var on = el.getAttribute('data-rd-view') === v;
        el.hidden = !on;
        if (on && announce && motion) restart(el, 'rd-in');
      });
      if (announce && live) {
        var b = btns.filter(function (x) { return x.getAttribute('data-view') === v; })[0];
        live.textContent = b ? b.getAttribute('data-read') || '' : '';
      }
    };
    btns.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-view'), true); });
    });
    group.hidden = false;
    show(group.getAttribute('data-rd-default') || btns[0].getAttribute('data-view'), false);
  });

  /* ------------------------------ the return -----------------------------
     The waterfall's numbers are the return table's own (read at build time
     into data-vals / data-raw). A horizon button picks the column; the
     switch adds the illustrative-upside step and swaps the net line. Every
     step starts where the last one ended; the net bars run from zero to the
     table's stated net, which is why a step chain may land a rounding unit
     away from it — the chart says so beneath. The table above lights the
     column the chart is showing. */
  var ret = document.getElementById('rdReturn');
  if (ret) {
    var d0 = parseFloat(ret.getAttribute('data-d0'));
    var d1 = parseFloat(ret.getAttribute('data-d1'));
    var ctl = document.getElementById('rdReturnCtl');
    var hBtns = ctl ? Array.prototype.slice.call(ctl.querySelectorAll('button[data-h]')) : [];
    var upBtn = document.getElementById('rdUpside');
    var note = document.getElementById('rdUpsideNote');
    var read = document.getElementById('rdReturnRead');
    var table = document.getElementById('rdReturnTable');
    var rows = {};
    Array.prototype.forEach.call(ret.querySelectorAll('.rd-wf-row[data-key]'), function (row) {
      rows[row.getAttribute('data-key')] = {
        el: row,
        bar: row.querySelector('.rd-wf-bar'),
        v: row.querySelector('.rd-wf-v'),
        label: (row.querySelector('.rd-wf-l') || {}).textContent || '',
        vals: (row.getAttribute('data-vals') || '').split('|').map(parseFloat),
        raw: (row.getAttribute('data-raw') || '').split('|'),
      };
    });
    var ready = isFinite(d0) && isFinite(d1) && d1 > d0 && hBtns.length && upBtn &&
      ['savings', 'interest', 'wear', 'upside', 'net', 'netUp'].every(function (k) { return rows[k]; });

    if (ready) {
      var state = { h: parseInt(ret.getAttribute('data-h'), 10) || 0, up: false };
      var pct = function (v) { return ((v - d0) / (d1 - d0)) * 100; };
      var place = function (r, from, to) {
        r.bar.style.left = pct(Math.min(from, to)).toFixed(2) + '%';
        r.bar.style.width = Math.abs(pct(to) - pct(from)).toFixed(2) + '%';
      };
      var cols = hBtns.map(function (b) { return b.textContent.trim(); });

      var render = function () {
        var h = state.h;
        var run = 0;
        ['savings', 'interest', 'wear'].forEach(function (k) {
          var r = rows[k];
          place(r, run, run + r.vals[h]);
          run += r.vals[h];
          r.v.textContent = r.raw[h];
        });
        place(rows.upside, run, run + rows.upside.vals[h]);
        rows.upside.v.textContent = rows.upside.raw[h];
        ['net', 'netUp'].forEach(function (k) {
          var r = rows[k];
          place(r, 0, r.vals[h]);
          r.v.textContent = r.raw[h];
          if (r.vals[h] < 0) r.el.setAttribute('data-neg', '');
          else r.el.removeAttribute('data-neg');
        });

        var wasUp = !rows.upside.el.hidden;
        rows.upside.el.hidden = !state.up;
        rows.netUp.el.hidden = !state.up;
        rows.net.el.hidden = state.up;
        if (motion && state.up && !wasUp) {
          restart(rows.upside.el, 'rd-in');
          restart(rows.netUp.el, 'rd-in');
        }
        if (note) note.hidden = !state.up;

        hBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === h ? 'true' : 'false'); });
        upBtn.setAttribute('aria-checked', state.up ? 'true' : 'false');
        if (table) {
          table.setAttribute('data-col', String(h + 1));
          table.setAttribute('data-upside', state.up ? '1' : '0');
        }
        // The read-out is itself the polite live region. On load it is set to
        // the text the server already printed, so nothing is announced.
        var net = state.up ? rows.netUp : rows.net;
        if (read) {
          read.textContent = 'After ' + cols[h] + ': net ' + net.raw[h] + ' ($ million, cumulative), ' +
            (state.up ? 'with the illustrative upside.' : 'efficiency savings only.');
        }
      };

      hBtns.forEach(function (b, i) {
        b.addEventListener('click', function () { state.h = i; render(); });
      });
      upBtn.addEventListener('click', function () { state.up = !state.up; render(); });
      if (ctl) ctl.hidden = false;
      render();
    }
  }

  /* ============================ two-way footnotes ========================
     Literal "[N]" runs in the policy text become superscript badges linking
     to the matching References entry, and every entry whose number appears
     in the text gets a REAL back-link numeral in place of its CSS-counter
     plate. Entries whose number never appears keep the plain plate — no dead
     back-links. Text-node surgery only: the marker characters come from the
     document itself and are replaced by a link carrying the same number, so
     the policy text is never rewritten. Only the policy text is walked — the
     figures between its parts carry no markers. */
  var refItems = {};
  var fnFirst = {};

  page.querySelectorAll('.rd-sec').forEach(function (sec) {
    var kind = sec.getAttribute('data-kind');
    var bodies = sec.querySelectorAll('.rd-sec-body');
    if (!bodies.length) return;

    if (kind === 'references') {
      var ol = sec.querySelector('.rd-sec-body ol');
      if (ol) {
        Array.prototype.forEach.call(ol.children, function (li, i) {
          if (!li.id) li.id = 'rd-ref-' + (i + 1);
          refItems[String(i + 1)] = li;
        });
      }
      return; // the numbers in here are the entries, not markers
    }

    if (!document.createTreeWalker) return;
    Array.prototype.forEach.call(bodies, function (body) {
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!/\[\d{1,2}\]/.test(n.nodeValue || '')) return NodeFilter.FILTER_REJECT;
          if (n.parentElement && n.parentElement.closest('sup, a')) return NodeFilter.FILTER_REJECT;
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
          sup.className = 'rd-fn';
          var a = document.createElement('a');
          a.href = '#rd-ref-' + m[1];
          a.textContent = m[1];
          a.setAttribute('aria-label', 'Reference ' + m[1]);
          sup.appendChild(a);
          if (!fnFirst[m[1]]) {
            fnFirst[m[1]] = sup;
            sup.id = 'rd-fnref-' + m[1];
          }
          frag.appendChild(sup);
          rest = rest.slice(m.index + m[0].length);
        }
        if (rest) frag.appendChild(document.createTextNode(rest));
        node.parentNode.replaceChild(frag, node);
      });
    });
  });

  Object.keys(refItems).forEach(function (n) {
    var li = refItems[n];
    li.setAttribute('tabindex', '-1');
    if (!fnFirst[n]) return;
    var back = document.createElement('a');
    back.className = 'rd-fn-back';
    back.href = '#rd-fnref-' + n;
    back.textContent = n;
    back.setAttribute('aria-label', 'Back to reference ' + n + ' in the text');
    li.classList.add('rd-ref--linked');
    li.insertBefore(back, li.firstChild);
  });

  function fnEffect(el, cls) {
    if (!el) return;
    var timers = el._rdT || (el._rdT = {});
    if (timers[cls]) window.clearTimeout(timers[cls]);
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation cleanly on repeat clicks
    el.classList.add(cls);
    timers[cls] = window.setTimeout(function () {
      el.classList.remove(cls);
    }, cls === 'rd-fn-hit' ? 450 : 2800);
  }

  function fnTravel(origin, target, lands, focusEl) {
    fnEffect(origin, 'rd-fn-hit');
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
    if (a.classList.contains('rd-fn-back')) {
      var sup = document.getElementById(id);
      if (!sup) return;
      ev.preventDefault();
      var line = sup.closest('p, li') || sup.parentElement;
      fnTravel(a, sup, [[line, 'rd-fn-landline'], [sup, 'rd-fn-land']], sup.querySelector('a') || sup);
    } else if (a.parentElement && a.parentElement.classList && a.parentElement.classList.contains('rd-fn')) {
      var li = document.getElementById(id);
      if (!li) return;
      ev.preventDefault();
      fnTravel(a, li, [[li, 'rd-fn-land']], li);
    }
  });
})();
