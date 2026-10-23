/* "THE SYSTEM" — behaviour for the Public Safety experience
   (template: experience-safety). Loaded as an external file from the page's
   scripts slot: the site's CSP has no 'unsafe-inline', so nothing here may
   ever move into the document.

   Everything is progressive enhancement over the server-rendered page. With JS
   off: the policy reads as a plain document, the rail is plain anchors, the
   handoff diagram shows the "Victoria today" state, the ten hubs read as the
   policy's own bulleted list and the footnote markers stay literal [N] text.

   Motion is gated on html.js-motion (set by effects.js only when the visitor
   has not asked for reduced motion); without it every state change is instant
   and the footnote landings use a calm static wash instead of the sweep. */
(function () {
  'use strict';

  var page = document.getElementById('sfPage');
  if (!page) return;

  var motion = document.documentElement.classList.contains('js-motion');

  /* ------------------------------ progress ------------------------------ */
  var fill = document.getElementById('sfProgress');
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
    page.querySelectorAll('.sf-reveal').forEach(function (el) { revealIO.observe(el); });
  } else {
    page.querySelectorAll('.sf-reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ----------------------------- the counters ----------------------------
     The figures are server-rendered at their final value; this only rolls
     them up once, when the tile first scrolls in, and only when motion is
     allowed. Years carry no data-target — a year must never roll from zero. */
  var nums = Array.prototype.slice.call(page.querySelectorAll('.sf-num[data-target]'));
  if (nums.length && motion && 'IntersectionObserver' in window) {
    var roll = function (el) {
      var target = parseFloat(el.getAttribute('data-target'));
      if (!isFinite(target)) return;
      var dp = parseInt(el.getAttribute('data-decimals'), 10) || 0;
      var start = 0;
      var dur = 900;
      var step = function (now) {
        if (!start) start = now;
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (target * eased).toFixed(dp);
        if (t < 1) window.requestAnimationFrame(step);
        else el.textContent = target.toFixed(dp);
      };
      window.requestAnimationFrame(step);
    };
    var numIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        numIO.unobserve(en.target);
        roll(en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    nums.forEach(function (el) { numIO.observe(el); });
  }

  /* ------------------------------- the rail ------------------------------
     The anchors are server-rendered. The script only moves aria-current and
     slides the rail's OWN scrollLeft — never Element.scrollIntoView(), which
     would make the browser "correct" the document scroll against the sticky
     header's scroll-padding band and produce the stop-start readers reported
     on the sibling experience pages. */
  var rail = document.getElementById('sfRail');
  var railIn = rail ? rail.querySelector('.sf-rail-in') : null;
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
    page.querySelectorAll('.sf-sec').forEach(function (s) { secIO.observe(s); });
  }

  /* ------------------------- the handoff (Figure 1) ----------------------
     One switch drives the diagram and its readout: "Victoria today" leaves
     the nine services unconnected, "With hubs" wires them to a single lead
     agency. The copy for both states is server-rendered into data-now /
     data-hub so this file holds no policy text of its own. */
  var hand = document.getElementById('sfHand');
  var sysBtns = Array.prototype.slice.call(page.querySelectorAll('.sf-switch button[data-sys]'));
  if (hand && sysBtns.length) {
    var reads = ['sfHandK', 'sfHandV', 'sfHandN']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    var setSys = function (mode) {
      hand.setAttribute('data-mode', mode);
      sysBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-sys') === mode ? 'true' : 'false');
      });
      reads.forEach(function (p) {
        var next = p.getAttribute('data-' + mode);
        if (next == null || p.textContent.trim() === next) return;
        p.textContent = next;
        if (!motion) return;
        p.classList.remove('sf-hand-swap');
        void p.offsetWidth; // restart the fade cleanly on repeat presses
        p.classList.add('sf-hand-swap');
      });
      if (!motion) return;
      // Re-run the wire-up draw each time "With hubs" is chosen.
      hand.querySelectorAll('.sf-spoke').forEach(function (l, i) {
        l.style.transitionDelay = mode === 'hub' ? (i * 55) + 'ms' : '0ms';
      });
    };
    sysBtns.forEach(function (b) {
      b.addEventListener('click', function () { setSys(b.getAttribute('data-sys')); });
    });
    setSys(hand.getAttribute('data-mode') || 'now');
  }

  /* ---------------------------- the hub explorer -------------------------
     Built from the policy's OWN list so the text is never duplicated here:
     in the plan section markdoc renders each hub as a one-item list holding
     the place name, followed by a list whose first item starts "Why here:".
     Those pairs become a selectable list + panel; the original nodes are
     MOVED (never copied), so the editor's words are what you read. If the
     shape isn't found the prose is left exactly as written. */
  var planBody = page.querySelector('.sf-sec--plan .sf-sec-body');
  if (planBody) buildHubs(planBody);

  function detailParts(li) {
    var label = '';
    var frag = document.createDocumentFragment();
    var taken = false;
    Array.prototype.slice.call(li.childNodes).forEach(function (n) {
      if (!taken && n.nodeType === 3 && (n.nodeValue || '').indexOf(':') > -1) {
        var k = n.nodeValue.indexOf(':');
        label = n.nodeValue.slice(0, k).trim();
        var rest = n.nodeValue.slice(k + 1);
        if (rest.trim()) frag.appendChild(document.createTextNode(rest));
        taken = true;
        return;
      }
      frag.appendChild(n); // moves the node, which is what we want
    });
    return { label: label, frag: frag };
  }

  function buildHubs(body) {
    var kids = Array.prototype.slice.call(body.children);
    var hubs = [];
    for (var i = 0; i < kids.length - 1; i++) {
      var head = kids[i];
      var detail = kids[i + 1];
      if (head.tagName !== 'UL' || detail.tagName !== 'UL') continue;
      if (head.children.length !== 1) continue;
      var strong = head.children[0].querySelector('strong, b');
      if (!strong) continue;
      if (!/^\s*why\s+here/i.test(detail.textContent || '')) continue;
      hubs.push({ head: head, detail: detail, name: strong.textContent.trim() });
      i++; // the detail list belongs to this hub
    }
    if (hubs.length < 3) return; // not the expected shape — leave the prose alone

    var note = document.createElement('p');
    note.className = 'sf-hub-note';
    note.textContent =
      'Select a location to see why it was identified and what its hub would focus on.';

    var wrap = document.createElement('div');
    wrap.className = 'sf-hubs';
    var list = document.createElement('ul');
    list.className = 'sf-hub-list';
    var panels = document.createElement('div');
    panels.className = 'sf-hub-panels';
    wrap.appendChild(list);
    wrap.appendChild(panels);
    body.insertBefore(note, hubs[0].head);
    body.insertBefore(wrap, hubs[0].head);

    var buttons = [];
    hubs.forEach(function (hub, n) {
      var pid = 'sf-hub-p' + (n + 1);
      var hid = 'sf-hub-h' + (n + 1);

      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-n', String(n + 1));
      btn.setAttribute('aria-pressed', n === 0 ? 'true' : 'false');
      btn.setAttribute('aria-controls', pid);
      btn.textContent = hub.name;
      li.appendChild(btn);
      list.appendChild(li);
      buttons.push(btn);

      var panel = document.createElement('div');
      panel.className = 'sf-hub-panel';
      panel.id = pid;
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', hid);
      if (n !== 0) panel.hidden = true;

      var h4 = document.createElement('h4');
      h4.id = hid;
      h4.textContent = hub.name;
      panel.appendChild(h4);

      Array.prototype.slice.call(hub.detail.children).forEach(function (row) {
        var parts = detailParts(row);
        if (parts.label) {
          var k = document.createElement('p');
          k.className = 'sf-hub-k';
          k.textContent = parts.label;
          panel.appendChild(k);
        }
        var ul = document.createElement('ul');
        var hasEl = false;
        Array.prototype.slice.call(parts.frag.childNodes).forEach(function (n2) {
          if (n2.nodeType === 1) hasEl = true;
        });
        if (hasEl) {
          // Something richer than plain text (a link, emphasis) — keep it whole.
          var one = document.createElement('li');
          one.appendChild(parts.frag);
          ul.appendChild(one);
        } else {
          var text = parts.frag.textContent || '';
          text.split(/\s*[·•]\s*/).forEach(function (bit) {
            var t = bit.trim();
            if (!t) return;
            var item = document.createElement('li');
            item.textContent = t;
            ul.appendChild(item);
          });
        }
        if (ul.children.length) panel.appendChild(ul);
      });

      panels.appendChild(panel);
      hub.head.parentNode.removeChild(hub.head);
      hub.detail.parentNode.removeChild(hub.detail);
    });

    var show = function (n) {
      buttons.forEach(function (b, i) {
        b.setAttribute('aria-pressed', i === n ? 'true' : 'false');
      });
      Array.prototype.slice.call(panels.children).forEach(function (p, i) {
        p.hidden = i !== n;
        if (i !== n || !motion) return;
        p.classList.remove('sf-hub-swap');
        void p.offsetWidth; // restart the fade cleanly on repeat presses
        p.classList.add('sf-hub-swap');
      });
    };
    buttons.forEach(function (b, n) {
      b.addEventListener('click', function () { show(n); });
    });
  }

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

  page.querySelectorAll('.sf-sec').forEach(function (sec) {
    var kind = sec.getAttribute('data-kind');
    var body = sec.querySelector('.sf-sec-body');
    if (!body) return;

    if (kind === 'references') {
      var ol = body.querySelector('ol');
      if (ol) {
        Array.prototype.forEach.call(ol.children, function (li, i) {
          if (!li.id) li.id = 'sf-ref-' + (i + 1);
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
        sup.className = 'sf-fn';
        var a = document.createElement('a');
        a.href = '#sf-ref-' + m[1];
        a.textContent = m[1];
        a.setAttribute('aria-label', 'Reference ' + m[1]);
        sup.appendChild(a);
        if (!fnFirst[m[1]]) {
          fnFirst[m[1]] = sup;
          sup.id = 'sf-fnref-' + m[1];
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
    back.className = 'sf-fn-back';
    back.href = '#sf-fnref-' + n;
    back.textContent = n;
    back.setAttribute('aria-label', 'Back to reference ' + n + ' in the text');
    li.classList.add('sf-ref--linked');
    li.insertBefore(back, li.firstChild);
  });

  function fnEffect(el, cls) {
    if (!el) return;
    var timers = el._sfT || (el._sfT = {});
    if (timers[cls]) window.clearTimeout(timers[cls]);
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation cleanly on repeat clicks
    el.classList.add(cls);
    timers[cls] = window.setTimeout(function () {
      el.classList.remove(cls);
    }, cls === 'sf-fn-hit' ? 450 : 2800);
  }

  function fnTravel(origin, target, lands, focusEl) {
    fnEffect(origin, 'sf-fn-hit');
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
    if (a.classList.contains('sf-fn-back')) {
      var sup = document.getElementById(id);
      if (!sup) return;
      ev.preventDefault();
      var line = sup.closest('p, li') || sup.parentElement;
      fnTravel(a, sup, [[line, 'sf-fn-landline'], [sup, 'sf-fn-land']], sup.querySelector('a') || sup);
    } else if (a.parentElement && a.parentElement.classList && a.parentElement.classList.contains('sf-fn')) {
      var li = document.getElementById(id);
      if (!li) return;
      ev.preventDefault();
      fnTravel(a, li, [[li, 'sf-fn-land']], li);
    }
  });
})();
