/* Ballot replica (candidate profiles) — functional UI only, no motion garnish:
   reveals the ATL/BTL tab bar (server-rendered hidden so no-JS visitors get
   both panels stacked and complete), wires the full WAI-ARIA tabs pattern,
   shows the one-shot "slide to see the whole paper" coach bubble only when the
   paper actually overflows, and starts each scroller with the gold (ours)
   column in view. Read-only: no export, no editor — those live on the
   /how-to-vote page.

   EACH TAB OWNS ITS DIRECTIONS STRIP AND ITS BALLOT COLUMNS (ADR-49, which
   reverses the earlier both-strips-always-visible rule). select() hides the
   strip and the panel of the method that is not chosen, in the SAME call, so a
   strip can never be hidden without its tab. Everything ships unhidden, so a
   visitor with no JavaScript sees both lawful methods in full, and the lead
   line naming both ways sits ABOVE the tab bar where it is never hidden.
   A card with below-the-line switched off renders one strip, one panel and no
   tab bar at all — this file then leaves it alone (never a dead tab).

   Exposes a refresh entry point so a replica revealed inside a previously
   hidden subtree (the district panels in ballot-district.js) can re-run
   coach() + centreOurs(): in a hidden subtree scrollWidth === clientWidth === 0,
   so both early-return and the gold column would never be centred.
     - dispatch new CustomEvent('ballot-replica:refresh') on the replica root, or
     - call window.__ballotReplicaRefresh(rootOrAncestor). */
(function () {
  'use strict';

  /* THE HINT RETIRES, ONCE, FOR THE WHOLE PAGE. It used to hang around at
     opacity 1 forever, and on a phone it was an opaque pill sitting on the
     party names (it is now a caption above the scroller — see .bs-bubble in
     src/styles/htv-replica.css — so even while it shows it covers nothing).
     A hint that never leaves is not a hint: the first real slide, the first
     touch, or ~4.5 seconds retires it, and a page with two papers does not
     ask twice. */
  var hintDone = false;
  function retire(bub) {
    if (!bub || bub.dataset.done) return;
    bub.dataset.done = '1';
    hintDone = true;
    bub.classList.add('is-going');
    window.setTimeout(function () { bub.hidden = true; }, 300);
  }

  document.querySelectorAll('[data-ballot-replica]').forEach(function (root) {
    var tabbar = root.querySelector('[data-replica-tabs]');
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-replica-tab]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-replica-panel]'));
    /* The Directions strips, in tab order. Two of them = a two-method card. */
    var strips = Array.prototype.slice.call(root.querySelectorAll('[data-replica-instr]'));
    /* The take-away advice printed with the print/save button. It lives on the
       PAGE, outside the paper (it is site copy, not ballot furniture), so it is
       found by this replica's id rather than by descent. It travels with the
       tab for the same reason the Directions strip does: advice for the other
       method, under the ballot you are looking at, is a wrong instruction. */
    var rid = root.getAttribute('data-ballot-replica') || '';
    var advice = rid
      ? Array.prototype.slice.call(document.querySelectorAll('[data-replica-advice-for="' + rid + '"]'))
      : [];
    function adviceFor(method) {
      advice.forEach(function (p) { p.hidden = p.getAttribute('data-replica-advice') !== method; });
    }

    /* coach bubble: only when the paper overflows; gone forever on first slide */
    function coach() {
      panels.forEach(function (panel) {
        if (panel.hidden) return;
        var sc = panel.querySelector('[data-bscroll]');
        var bub = panel.querySelector('[data-bubble]');
        if (!sc || !bub || bub.dataset.done) return;
        if (hintDone) { bub.hidden = true; bub.dataset.done = '1'; return; }
        bub.hidden = !(sc.scrollWidth > sc.clientWidth + 12);
        if (!bub.hidden && !sc.dataset.coached) {
          sc.dataset.coached = '1';
          /* NOT { once: true }. centreOurs() scrolls the paper programmatically
             to bring the gold column into view, and that fires `scroll` — so a
             once-listener consumed its own side effect and the bubble was
             dismissed before any visitor saw it, on every load. The flag lets
             exactly the programmatic scroll through; the first REAL slide is
             what retires the hint. */
          sc.addEventListener('scroll', function onSlide() {
            if (sc.dataset.autoscroll) { delete sc.dataset.autoscroll; return; }
            retire(bub);
            sc.removeEventListener('scroll', onSlide);
          }, { passive: true });
          sc.addEventListener('pointerdown', function () { retire(bub); }, { passive: true });
          window.setTimeout(function () { retire(bub); }, 4500);
        }
      });
    }

    /* start with the gold column in view (progressive enhancement) */
    function centreOurs() {
      panels.forEach(function (panel) {
        var sc = panel.querySelector('[data-bscroll]');
        var ours = panel.querySelector('.bs-col.ours');
        if (!sc || !ours || sc.dataset.centred) return;
        if (sc.scrollWidth <= sc.clientWidth + 12) return;
        sc.dataset.centred = '1';
        var to = Math.max(0, ours.offsetLeft - (sc.clientWidth - ours.offsetWidth) / 2);
        /* Flag it only when it will actually move, or the flag would linger and
           swallow the visitor's own first slide (see onSlide in coach()). */
        if (Math.round(to) !== Math.round(sc.scrollLeft)) sc.dataset.autoscroll = '1';
        sc.scrollLeft = to;
      });
    }

    /* A single-method card (below-the-line switched off), or any shape this
       file does not recognise: leave the markup exactly as the server sent it
       — every method on screen — and still run the scroller helpers. */
    if (!tabbar || tabs.length !== 2 || panels.length !== 2) {
      root.addEventListener('ballot-replica:refresh', function () { coach(); centreOurs(); });
      root.__ballotReplicaRefresh = function () { coach(); centreOurs(); };
      coach();
      centreOurs();
      window.addEventListener('resize', coach, { passive: true });
      return;
    }

    /* Automatic activation (selection follows focus) — correct for two tabs
       whose panels are already rendered. tabindex is set on BOTH tabs BEFORE
       .focus(), or Safari drops the focus. The strip moves WITH its panel:
       one lawful method on screen at a time (ADR-49). */
    function select(i, moveFocus) {
      tabs.forEach(function (t, j) {
        t.setAttribute('aria-selected', String(i === j));
        t.tabIndex = i === j ? 0 : -1;
      });
      panels.forEach(function (p, j) { p.hidden = i !== j; });
      if (strips.length === 2) strips.forEach(function (s, j) { s.hidden = i !== j; });
      if (advice.length > 1) adviceFor(tabs[i].getAttribute('data-replica-tab'));
      if (moveFocus) tabs[i].focus();
      setTimeout(function () { coach(); centreOurs(); }, 60);
    }

    tabbar.hidden = false;
    tabbar.setAttribute('role', 'tablist');
    tabbar.setAttribute('aria-label', 'Ways to vote');
    tabs.forEach(function (tab, i) {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === 0));
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) {
        var last = tabs.length - 1;
        var to = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i === last ? 0 : i + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i === 0 ? last : i - 1;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = last;
        if (to < 0) return;
        e.preventDefault();
        select(to, true);
      });
    });
    panels.forEach(function (panel, i) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabs[i].id);
      panel.hidden = i !== 0;
    });
    /* Same initial state for the strips and the advice: the chosen method's
       Directions and the chosen method's advice, and nothing of the other. */
    if (strips.length === 2) strips.forEach(function (s, i) { s.hidden = i !== 0; });
    if (advice.length > 1) adviceFor(tabs[0].getAttribute('data-replica-tab'));

    root.addEventListener('ballot-replica:refresh', function () { coach(); centreOurs(); });
    root.__ballotReplicaRefresh = function () { coach(); centreOurs(); };

    coach();
    centreOurs();
    window.addEventListener('resize', coach, { passive: true });
  });

  /* Refresh every replica at or inside `el` (used after a hidden panel is
     revealed, before focus moves). Safe to call when there are none. */
  window.__ballotReplicaRefresh = function (el) {
    if (!el || !el.querySelectorAll) return;
    var roots = Array.prototype.slice.call(el.querySelectorAll('[data-ballot-replica]'));
    if (el.hasAttribute && el.hasAttribute('data-ballot-replica')) roots.push(el);
    roots.forEach(function (r) {
      if (typeof r.__ballotReplicaRefresh === 'function') r.__ballotReplicaRefresh();
      else r.dispatchEvent(new CustomEvent('ballot-replica:refresh'));
    });
  };
})();
