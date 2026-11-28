/* "THE RIGHT PLACES" — behaviour for the Data Centres experience
   (template: experience-data-centres). Loaded as an external file from the
   page's scripts slot: the site's CSP has no 'unsafe-inline', so nothing here
   may ever move into the document.

   Everything is progressive enhancement over the server-rendered page. With JS
   off: the policy reads as a plain document, the rail is plain anchors, every
   measure card shows (the sort bars stay hidden) and the footnote markers stay
   literal [N] text.

   Motion is gated on html.js-motion (set by effects.js only when the visitor
   has not asked for reduced motion); without it every state change is instant
   and the footnote landings use a calm static wash instead of the sweep. */
(function () {
  'use strict';

  var page = document.getElementById('dcPage');
  if (!page) return;

  var motion = document.documentElement.classList.contains('js-motion');

  /* ------------------------------ progress ------------------------------ */
  var fill = document.getElementById('dcProgress');
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
    page.querySelectorAll('.dc-reveal').forEach(function (el) { revealIO.observe(el); });
  } else {
    page.querySelectorAll('.dc-reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------- the rail ------------------------------
     The anchors are server-rendered. The script only moves aria-current and
     slides the rail's OWN scrollLeft — never Element.scrollIntoView(), which
     would make the browser "correct" the document scroll against the sticky
     header's scroll-padding band (the stop-start reading reported on the
     sibling experience pages). */
  var rail = document.getElementById('dcRail');
  var railIn = rail ? rail.querySelector('.dc-rail-in') : null;
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
          var h = en.target.querySelector('[id]');
          if (h) setCurrent(h.id);
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    page.querySelectorAll('.dc-sec').forEach(function (s) { secIO.observe(s); });
  }

  /* ------------------------------ the measures ---------------------------
     The cards are server-rendered (they read without this file). Each list's
     sort bar ships `hidden`; here it is revealed and its buttons show only the
     measures for one principle — Social, Environmental or Economic — or all of
     them again. A measure tagged with two principles answers to both. The
     count is announced through the bar's own polite live region. */
  page.querySelectorAll('.dc-filter').forEach(function (bar) {
    var list = bar.nextElementSibling;
    if (!list || !list.classList.contains('dc-measures')) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll('li.dc-m'));
    var btns = Array.prototype.slice.call(bar.querySelectorAll('button[data-cat]'));
    var count = bar.querySelector('.dc-filter-count');
    var label = { social: 'social', environmental: 'environmental', economic: 'economic' };
    var show = function (cat) {
      var n = 0;
      cards.forEach(function (li) {
        var cats = (li.getAttribute('data-cat') || '').split(/\s+/);
        var on = cat === 'all' || cats.indexOf(cat) !== -1;
        if (on) {
          n++;
          if (li.hidden && motion) {
            li.classList.remove('dc-in');
            void li.offsetWidth; // restart the entrance on repeat presses
            li.classList.add('dc-in');
          }
          li.hidden = false;
        } else {
          li.hidden = true;
        }
      });
      btns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-cat') === cat ? 'true' : 'false');
      });
      if (count) {
        count.textContent = cat === 'all'
          ? 'Showing all ' + cards.length + ' measures'
          : 'Showing ' + n + ' of ' + cards.length + ' measures: ' + label[cat];
      }
    };
    btns.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-cat')); });
    });
    bar.hidden = false;
  });

  /* ============================ two-way footnotes ========================
     Literal "[N]" runs in the policy text become superscript badges linking
     to the matching References entry, and every entry whose number appears
     in the text gets a REAL back-link numeral in place of its CSS-counter
     plate. Entries whose number never appears keep the plain plate — no dead
     back-links. Text-node surgery only: the marker characters come from the
     document itself and are replaced by a link carrying the same number, so
     the policy text is never rewritten. */
  var refItems = {};
  var fnFirst = {};

  page.querySelectorAll('.dc-sec').forEach(function (sec) {
    var kind = sec.getAttribute('data-kind');
    var body = sec.querySelector('.dc-sec-body');
    if (!body) return;

    if (kind === 'references') {
      var ol = body.querySelector('ol');
      if (ol) {
        Array.prototype.forEach.call(ol.children, function (li, i) {
          if (!li.id) li.id = 'dc-ref-' + (i + 1);
          refItems[String(i + 1)] = li;
        });
      }
      return; // the numbers in here are the entries, not markers
    }

    if (!document.createTreeWalker) return;
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
        sup.className = 'dc-fn';
        var a = document.createElement('a');
        a.href = '#dc-ref-' + m[1];
        a.textContent = m[1];
        a.setAttribute('aria-label', 'Reference ' + m[1]);
        sup.appendChild(a);
        if (!fnFirst[m[1]]) {
          fnFirst[m[1]] = sup;
          sup.id = 'dc-fnref-' + m[1];
        }
        frag.appendChild(sup);
        rest = rest.slice(m.index + m[0].length);
      }
      if (rest) frag.appendChild(document.createTextNode(rest));
      node.parentNode.replaceChild(frag, node);
    });
  });

  Object.keys(refItems).forEach(function (n) {
    var li = refItems[n];
    li.setAttribute('tabindex', '-1');
    if (!fnFirst[n]) return;
    var back = document.createElement('a');
    back.className = 'dc-fn-back';
    back.href = '#dc-fnref-' + n;
    back.textContent = n;
    back.setAttribute('aria-label', 'Back to reference ' + n + ' in the text');
    li.classList.add('dc-ref--linked');
    li.insertBefore(back, li.firstChild);
  });

  function fnEffect(el, cls) {
    if (!el) return;
    var timers = el._dcT || (el._dcT = {});
    if (timers[cls]) window.clearTimeout(timers[cls]);
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation cleanly on repeat clicks
    el.classList.add(cls);
    timers[cls] = window.setTimeout(function () {
      el.classList.remove(cls);
    }, cls === 'dc-fn-hit' ? 450 : 2800);
  }

  function fnTravel(origin, target, lands, focusEl) {
    fnEffect(origin, 'dc-fn-hit');
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
    if (a.classList.contains('dc-fn-back')) {
      var sup = document.getElementById(id);
      if (!sup) return;
      ev.preventDefault();
      var line = sup.closest('p, li') || sup.parentElement;
      fnTravel(a, sup, [[line, 'dc-fn-landline'], [sup, 'dc-fn-land']], sup.querySelector('a') || sup);
    } else if (a.parentElement && a.parentElement.classList && a.parentElement.classList.contains('dc-fn')) {
      var li = document.getElementById(id);
      if (!li) return;
      ev.preventDefault();
      fnTravel(a, li, [[li, 'dc-fn-land']], li);
    }
  });
})();
