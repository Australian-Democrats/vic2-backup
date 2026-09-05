/* Second-ballot district picker (upper-house candidate profiles).

   Progressive enhancement only. The server ships the jump list and EVERY
   district result panel visible and complete, so with JS off the page is
   whole: no dead controls, no hidden content, no "enable JavaScript" copy.
   This script swaps that long list for a choose-one control.

   THE `change` EVENT MUST NEVER MOVE FOCUS. On Windows Firefox and several AT
   configurations `change` fires on EVERY arrow key while a collapsed <select>
   has focus; revealing AND focusing on change would yank the user out of the
   list on the first ArrowDown, making option 3 unreachable, and it is a WCAG
   3.2.2 On Input context change without warning. Focus moves only on explicit
   activation of "Show this district", "Find", or a multi-match button.

   The status message is set FIRST and focus moves on the NEXT animation frame:
   setting role="status" content and moving focus in the same tick drops or
   double-speaks the announcement in NVDA/VoiceOver. There is deliberately no
   aria-live on the element — it is redundant with role="status" and the pair
   double-announces.

   No animation, no height transition: reveal is a `hidden` attribute toggle,
   so there is nothing for prefers-reduced-motion to switch off. No scroll,
   resize or touchmove listeners. */
(function () {
  'use strict';

  var section = document.querySelector('[data-district-picker]');
  if (!section) return;
  var dataEl = document.getElementById('candDistrictData');
  var pick = section.querySelector('[data-pick]');
  var jump = section.querySelector('[data-jump]');
  var select = section.querySelector('select');
  var msg = section.querySelector('[data-msg]');
  var showBtn = section.querySelector('[data-show]');
  var pcInput = section.querySelector('input[type="text"]');
  var pcBtn = section.querySelector('[data-pcgo]');
  var panels = Array.prototype.slice.call(section.querySelectorAll('.cand-htv2-result'));
  if (!dataEl || !pick || !select || !msg || !panels.length) return;

  var data;
  try { data = JSON.parse(dataEl.textContent || '{}'); } catch (e) { return; }
  var districts = data.districts || [];
  var elsewhere = data.elsewhere || [];
  var regionName = data.region || '';

  /* Enhance: the picker appears, the jump list and every panel go away. */
  pick.hidden = false;
  if (jump) jump.hidden = true;
  panels.forEach(function (p) { p.hidden = true; });

  function panelFor(slug) {
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].getAttribute('data-district') === slug) return panels[i];
    }
    return null;
  }
  function nameFor(slug) {
    for (var i = 0; i < districts.length; i++) {
      if (districts[i].slug === slug) return districts[i].name;
    }
    return '';
  }
  function clearMsg() {
    while (msg.firstChild) msg.removeChild(msg.firstChild);
  }
  function say(text) {
    clearMsg();
    msg.appendChild(document.createTextNode(text));
  }
  function sayWithLink(text, href, label) {
    say(text + ' ');
    var a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    msg.appendChild(a);
  }

  /* Reveal one district's panel. moveFocus is true ONLY for explicit
     activation — never for a <select> change. */
  function show(slug, moveFocus) {
    if (!slug) {
      panels.forEach(function (p) { p.hidden = true; });
      clearMsg();
      return;
    }
    var panel = panelFor(slug);
    if (!panel) return;
    panels.forEach(function (p) { p.hidden = p !== panel; });
    if (select.value !== slug) select.value = slug;
    /* Only claim a ballot paper when one is actually drawn. The panel says so
       itself (data-haspaper): for most districts we have no published card, and
       "Showing the Bendigo East District ballot paper." above an empty state
       was simply false. */
    say(
      panel.getAttribute('data-haspaper') === '1'
        ? 'Showing the ' + nameFor(slug) + ' District ballot paper.'
        : nameFor(slug) + ' — we have not published a how-to-vote card for this district yet.'
    );
    /* A replica inside a hidden subtree measures 0 wide, so its coach bubble
       and gold-column centring both early-return. Re-run them now it is
       visible, before anything moves focus. */
    if (typeof window.__ballotReplicaRefresh === 'function') window.__ballotReplicaRefresh(panel);
    try {
      history.replaceState(null, '', '?district=' + encodeURIComponent(slug) + '#ballot-other');
    } catch (e) { /* file:// and some privacy modes reject replaceState */ }
    if (moveFocus) {
      requestAnimationFrame(function () { panel.focus(); });
    }
  }

  select.addEventListener('change', function (e) {
    /* Reveal + announce only. Never focus (see the file header). */
    if (!e.isTrusted && document.activeElement !== select) return;
    show(select.value, false);
  });

  if (showBtn) {
    showBtn.addEventListener('click', function () {
      if (!select.value) { say('Choose your district from the list first.'); return; }
      show(select.value, true);
    });
  }

  /* ---- postcode lookup ---------------------------------------------------
     Same rule and the same wording as the hub's electorate finder
     (public/assets/js/electorate-finder.js) so the two lookups can never
     contradict each other. The finder's "or a suburb name" clauses are
     dropped: there is no suburb box here, and a dead instruction is worse
     than a short one. */
  function lookup() {
    var q = (pcInput && pcInput.value ? pcInput.value : '').trim();
    if (!/^\d{4}$/.test(q)) {
      say('Enter a four-digit Victorian postcode (3000–3999).');
      return;
    }
    if (q[0] !== '3') {
      say('That doesn’t look like a Victorian postcode — Victorian postcodes start with 3.');
      return;
    }
    var hits = districts.filter(function (dd) {
      return (dd.postcodes || []).indexOf(q) !== -1;
    });
    if (hits.length === 1) {
      show(hits[0].slug, true);
      return;
    }
    if (hits.length > 1) {
      say(q + ' covers more than one district in ' + regionName + ' Region. Choose yours:');
      var row = document.createElement('span');
      row.className = 'cand-htv2-choices';
      hits.forEach(function (h) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn--ghost btn--sm';
        b.textContent = h.name;
        b.addEventListener('click', function () { show(h.slug, true); });
        row.appendChild(b);
      });
      msg.appendChild(row);
      return;
    }
    /* Never silently show a paper from another region. */
    var out = elsewhere.filter(function (dd) {
      return (dd.postcodes || []).indexOf(q) !== -1;
    });
    if (out.length) {
      sayWithLink(
        q + ' is in ' + out[0].name + ', which is in the ' + out[0].region +
          ' Region — not ' + regionName + ' Region.',
        '/how-to-vote',
        'See every how-to-vote card →'
      );
      return;
    }
    sayWithLink(
      'No match for ' + q + ' in ' + regionName + ' Region — our postcode lists are indicative.',
      '/how-to-vote',
      'See every how-to-vote card →'
    );
  }

  if (pcBtn) pcBtn.addEventListener('click', lookup);
  if (pcInput) {
    pcInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); lookup(); }
    });
  }

  /* Deep link: ?district=<slug> preselects and reveals, without moving focus
     (the visitor did not activate anything on this page load). */
  try {
    var want = new URLSearchParams(location.search).get('district');
    if (want && panelFor(want)) {
      select.value = want;
      show(want, false);
    }
  } catch (e) { /* no URLSearchParams → skip the deep link */ }
})();
