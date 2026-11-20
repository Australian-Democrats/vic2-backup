/* Paste-up Night — the one motion+functional script for candidate surfaces.
   Two entry points (a11y A1/C2): the functional half ALWAYS runs, no motion
   guards; the motion half (bottom) keeps all four. CSS cm-autoreveal (3.5s)
   backstops a dead script — JS is never load-bearing for visibility. Census:
   0 scroll/resize listeners; 1 setTimeout; 1 reveal IO + 2 bar IOs + 1
   MutationObserver (+1 rail IO on the hub, which has no bar). ES6: browsers
   without it also lack IO and get the complete static page, untouched. */
(() => {
  'use strict';
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const on = (el, t, f) => el.addEventListener(t, f);
  const surface = $('candProfile') || $('candPage');
  if (!surface) return;
  const hasIO = 'IntersectionObserver' in window;
  const raf = window.requestAnimationFrame;

  /* ---- functional: always ---- */

  const fringe = $('soonFringe'), tab = $('fringeTab'), tabs = $('fringeTabs');
  const openFringe = () => {
    fringe.classList.add('is-open');
    fringe.classList.remove('is-collapsed');
    tab.setAttribute('aria-expanded', 'true');
  };
  if (fringe && tab && tabs) {
    on(tab, 'click', () => {
      openFringe();
      const em = $('fringe-email');
      if (em) em.focus();
    });
    on(doc, 'cand:fringe-open', openFringe);
    tabs.hidden = false;
    fringe.classList.add('is-collapsed');
    tab.setAttribute('aria-expanded', 'false');
  }

  const fform = $('fringeForm');
  if (fform) {
    on(fform, 'submit', (e) => {
      e.preventDefault();
      const em = $('fringe-email'), st = $('fringeStatus');
      const hp = fform.querySelector('input[name="website"]');
      if (hp && hp.value) return;
      if (!em || !em.checkValidity()) { st.textContent = 'Enter a valid email address.'; return; }
      st.textContent = 'Signing you up…';
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em.value }),
      }).then((res) => res.json().then((d) => {
        if (!res.ok) throw new Error(d.error || 'Sign-up failed.');
        st.textContent = "You're on the list — thanks!";
        fform.querySelector('button[type="submit"]').disabled = true;
        em.disabled = true;
      })).catch(() => {
        st.textContent = 'Something went wrong at our end. Try again in a moment.';
      });
    });
  }

  const bar = $('candBar');
  let barCount = 0, barTyping = false, barShown = false, barArmed = false;
  const barUpdate = () => {
    const show = barArmed && barCount === 0 && !barTyping;
    if (show === barShown) return;
    barShown = show;
    bar.classList.toggle('is-on', show);
  };
  if (bar && hasIO) {
    bar.hidden = false; // absent without JS
    const seen = [];
    const heroCtas = surface.querySelector('.cand-hero .hero-actions');
    const barCb = (entries) => {
      entries.forEach((en) => {
        // Arm only once the hero CTA cluster has EXITED above the viewport.
        if (en.target === heroCtas && !en.isIntersecting && en.boundingClientRect.top < 0) barArmed = true;
        const i = seen.indexOf(en.target);
        if (en.isIntersecting && i === -1) { seen.push(en.target); barCount++; }
        else if (!en.isIntersecting && i !== -1) { seen.splice(i, 1); barCount--; }
      });
      barUpdate();
    };
    const ioHero = new IntersectionObserver(barCb, { threshold: 0 });
    const ioTail = new IntersectionObserver(barCb, { threshold: 0 });
    if (heroCtas) ioHero.observe(heroCtas);
    ['.cand-help', '.cand-plate', '#site-footer'].forEach((sel) => {
      const el = doc.querySelector(sel);
      if (el) ioTail.observe(el);
    });
  }

  on(doc, 'focusin', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const beat = t.closest('[data-beat]');
    if (beat && !beat.classList.contains('in-view')) beat.classList.add('is-instant', 'in-view');
    if (bar && t.matches('input, textarea')) { barTyping = true; barUpdate(); }
  });
  on(doc, 'focusout', (e) => {
    const t = e.target;
    if (bar && t && t.matches && t.matches('input, textarea')) { barTyping = false; barUpdate(); }
  });

  on(doc, 'animationend', (ev) => {
    const n = ev.animationName || '';
    if (!n.startsWith('cm-') || n.startsWith('cm-autoreveal')) return;
    const t = ev.target;
    if (!t || !t.classList) return;
    if (ev.pseudoElement) {
      if (n === 'cm-ringout') t.classList.add('cm-ringdone');
      else if (n === 'cm-sweep') t.classList.add('cm-done');
    } else if (n !== 'cm-nudge' && n !== 'cm-railnudge') t.classList.add('cm-done');
  });

  const out = $('efinderOut');
  if (out && 'MutationObserver' in window) {
    const lift = () => {
      const cards = out.querySelectorAll('.efr:not(.efr-in)');
      if (!cards.length) return;
      raf(() => cards.forEach((card, i) => {
        card.style.setProperty('--efi', Math.min(i, 4));
        card.classList.add('efr-in');
      }));
    };
    out.classList.add('efr-anim');
    new MutationObserver(lift).observe(out, { childList: true });
    lift();
  }
  const firstResult = () => raf(() => {
    const el = out.querySelector('.efr');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  });
  const fGo = $('efinderGo'), fIn = $('efinderInput');
  if (out && fGo) on(fGo, 'click', firstResult);
  if (out && fIn) on(fIn, 'keydown', (e) => { if (e.key === 'Enter') firstResult(); });

  const rail = doc.querySelector('[data-rail-dots] .poster-wall--rail');
  const railScrolls = rail && rail.scrollWidth > rail.clientWidth + 16;
  if (railScrolls && hasIO) {
    const posters = [...rail.querySelectorAll('.person.poster')];
    if (posters.length > 1) {
      const dots = doc.createElement('div');
      dots.className = 'rail-dots';
      const btns = posters.map((p, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'rail-dot';
        b.setAttribute('aria-label', `Poster ${i + 1} of ${posters.length}`);
        on(b, 'click', () => p.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' }));
        dots.appendChild(b);
        return b;
      });
      rail.parentElement.appendChild(dots); // inside .poster-rail's reserved row — no CLS
      const dotIo = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const i = posters.indexOf(en.target);
          btns.forEach((b, j) => b.classList.toggle('is-active', i === j));
        });
      }, { root: rail, threshold: 0.6 });
      posters.forEach((p) => dotIo.observe(p));
    }
  }

  /* ---- motion: four guards ---- */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!hasIO) return;
  if (!doc.documentElement.classList.contains('js-motion')) return;
  if (!surface.hasAttribute('data-cand-motion')) return;

  const mobile = window.matchMedia('(max-width: 899px)').matches;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in-view');
      io.unobserve(en.target); // one-shot, always
    });
  }, mobile
    ? { rootMargin: '0px 0px 15% 0px', threshold: 0 } // pre-arm
    : { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  const beats = [...surface.querySelectorAll('[data-beat]')];
  const vh = window.innerHeight;
  const rects = beats.map((b) => b.getBoundingClientRect());
  raf(() => {
    beats.forEach((b, i) => {
      if (b.getAttribute('data-beat') === 'load') b.classList.add('in-view');
      else if (rects[i].top < vh && rects[i].bottom > 0) b.classList.add('is-instant', 'in-view');
      else io.observe(b);
    });
    if (railScrolls) rail.classList.add('rail-nudged');
  });

  setTimeout(() => raf(() => {
    const pend = beats.filter((b) => !b.classList.contains('in-view'));
    const pr = pend.map((b) => b.getBoundingClientRect());
    const h = window.innerHeight;
    pend.forEach((b, i) => {
      if (pr[i].top < h && pr[i].bottom > 0) b.classList.add('is-instant', 'in-view');
    });
  }), 2500);
})();
