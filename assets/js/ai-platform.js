/* Flagship AI policy page (/artificial-intelligence) behaviour.
   Progressive enhancement only — the page is complete without this file.
   Everything except the chapter scrollspy is disabled under
   prefers-reduced-motion. */
(function () {
  'use strict';

  var page = document.getElementById('aiPage');
  if (!page) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Chapter rail scrollspy (works regardless of motion prefs) -------- */
  var rail = document.getElementById('aiRail');
  if (rail && 'IntersectionObserver' in window) {
    var links = {};
    rail.querySelectorAll('a[data-chapter]').forEach(function (a) {
      links[a.getAttribute('data-chapter')] = a;
    });
    var current = null;
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = e.target.id;
          if (current === id || !links[id]) return;
          if (current && links[current]) links[current].removeAttribute('aria-current');
          links[id].setAttribute('aria-current', 'true');
          current = id;
          // keep the active pill in view on narrow screens
          links[id].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
        });
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    page.querySelectorAll('.ai-section').forEach(function (s) { spy.observe(s); });
  }

  if (reduce || !('IntersectionObserver' in window)) return;

  /* ---- Section reveals --------------------------------------------------- */
  var revealer = new IntersectionObserver(
    function (entries) {
      var delay = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('ai-in');
        el.addEventListener('transitionend', function () { el.style.transitionDelay = ''; }, { once: true });
        delay = Math.min(delay + 80, 320);
        revealer.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );
  page.querySelectorAll('.ai-reveal').forEach(function (el) { revealer.observe(el); });

  /* ---- Stat count-ups (server renders final values) ---------------------- */
  var ease = function (p) { return 1 - Math.pow(1 - p, 3); };
  var counter = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        counter.unobserve(e.target);
        var el = e.target;
        var target = parseInt(el.getAttribute('data-target'), 10);
        if (!Number.isFinite(target)) return;
        var start = null;
        var step = function (ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / 1200, 1);
          el.textContent = String(Math.round(target * ease(p)));
          if (p < 1) requestAnimationFrame(step);
          else el.classList.add('ai-counted'); // gold pop on landing
        };
        requestAnimationFrame(step);
      });
    },
    { threshold: 0.6 }
  );
  page.querySelectorAll('.ai-num[data-target]').forEach(function (n) { counter.observe(n); });

  /* ---- Pointer glow + 3D tilt on cards ------------------------------------ */
  page.querySelectorAll('.ai-glow').forEach(function (card) {
    var tilts = card.classList.contains('ai-tilt');
    card.addEventListener('pointermove', function (ev) {
      var r = card.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width;
      var py = (ev.clientY - r.top) / r.height;
      card.style.setProperty('--mx', px * 100 + '%');
      card.style.setProperty('--my', py * 100 + '%');
      // Tilt only for mouse pointers, and only once the card has revealed so
      // the entry transition's transform is never stomped mid-flight.
      if (tilts && ev.pointerType === 'mouse' && card.classList.contains('ai-in')) {
        card.style.transform =
          'perspective(60rem) rotateX(' + ((0.5 - py) * 3.5).toFixed(2) + 'deg)' +
          ' rotateY(' + ((px - 0.5) * 4.5).toFixed(2) + 'deg) translateY(-2px)';
      }
    });
    card.addEventListener('pointerleave', function () { card.style.transform = ''; });
  });

  /* ---- Scroll engine ------------------------------------------------------
     One passive listener + one rAF loop drives: the reading-progress beam,
     the hero choreography (copy sinks + fades, backdrop zooms, grid floor
     glides, orbs drift), the ambient scene lighting (gold peaks through the
     Compact, teal toward the deal), and the depth-parallax image frames.
     Transform/opacity only — nothing here animates layout or paint. */
  var doc = document.documentElement;
  var bar = document.getElementById('aiProgress');
  var sceneGold = document.getElementById('aiSceneGold');
  var sceneTeal = document.getElementById('aiSceneTeal');
  var heroInner = page.querySelector('.ai-hero-inner');
  var heroImg = page.querySelector('.ai-hero-img');
  var floor = page.querySelector('.ai-grid-floor');
  var orbs = page.querySelectorAll('.ai-orb[data-orb]');
  var depthEls = page.querySelectorAll('[data-depth]');
  var pledge = document.getElementById('aiPledge');
  var pledgeWords = pledge ? pledge.querySelectorAll('.ai-w') : [];
  var pledgeLit = -1;

  // the CTA hall lights up the first time it comes into view
  var cta = document.getElementById('join');
  if (cta) {
    var lighter = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cta.classList.add('ai-lit');
        lighter.disconnect();
      });
    }, { threshold: 0.3 });
    lighter.observe(cta);
  }

  function bell(p, centre, width) {
    var d = (p - centre) / width;
    return Math.exp(-d * d);
  }

  // grid-floor scan pulse: fires one sweep at a time, only on downward scroll
  var lastY = window.scrollY;
  var scanBusy = false;

  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight || 1;
    var max = Math.max(doc.scrollHeight - vh, 1);
    var p = Math.min(y / max, 1);

    if (y > lastY + 4 && !scanBusy && y < vh) {
      scanBusy = true;
      page.classList.add('ai-scan-go');
      window.setTimeout(function () {
        page.classList.remove('ai-scan-go');
        scanBusy = false;
      }, 2300);
    }
    lastY = y;

    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';

    // hero choreography across the first ~90vh of travel
    var hp = Math.min(y / (vh * 0.9), 1);
    if (heroInner) {
      heroInner.style.transform =
        'translateY(' + (hp * -48).toFixed(1) + 'px) scale(' + (1 - hp * 0.05).toFixed(3) + ')';
      heroInner.style.opacity = (1 - hp * 0.9).toFixed(3);
    }
    if (heroImg) {
      heroImg.style.transform =
        'scale(' + (1 + hp * 0.12).toFixed(3) + ') translateY(' + (hp * 42).toFixed(1) + 'px)';
    }
    if (floor) {
      floor.style.transform =
        'perspective(52rem) rotateX(64deg) translateY(' + (y * 0.16).toFixed(1) + 'px)';
    }
    orbs.forEach(function (o) {
      o.style.transform =
        'translateY(' + (y * parseFloat(o.getAttribute('data-orb')) * 0.3).toFixed(1) + 'px)';
    });

    // ambient scene lighting
    if (sceneGold) sceneGold.style.opacity = (bell(p, 0.38, 0.16) * 0.55).toFixed(3);
    if (sceneTeal) sceneTeal.style.opacity = (bell(p, 0.78, 0.2) * 0.6).toFixed(3);

    // the pledge lights up word by word as it crosses the middle of the view
    if (pledge && pledgeWords.length) {
      var pr = pledge.getBoundingClientRect();
      var pp = Math.max(0, Math.min(1, (vh * 0.85 - pr.top) / (vh * 0.55)));
      var lit = Math.round(pp * pledgeWords.length);
      if (lit !== pledgeLit) {
        pledgeLit = lit;
        pledgeWords.forEach(function (w, i) { w.classList.toggle('ai-w-lit', i < lit); });
      }
    }

    // depth parallax: framed media drifts slower than the page around it.
    // The scale over-scans the frame; the shift stays inside the head-room
    // that scale buys, so the frame edge is never exposed.
    depthEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var offset = r.top + r.height / 2 - vh / 2;
      var shift = Math.max(-16, Math.min(16, -offset * parseFloat(el.getAttribute('data-depth'))));
      el.style.transform = 'scale(1.14) translateY(' + shift.toFixed(1) + 'px)';
    });
  }
  function queue() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  queue();
})();
