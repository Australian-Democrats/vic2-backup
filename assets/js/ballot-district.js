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
   resize or touchmove listeners.

   "Tap a district" chips ([data-district-chip], ADR-74) are links to the
   panels, so with JS off they jump there. Here a tap is an explicit
   activation, exactly like "Show this district": the panel is revealed and
   focus moves to it; the chip for the district on show carries
   aria-current="true" (whichever control chose it). */
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
  var chips = Array.prototype.slice.call(section.querySelectorAll('[data-district-chip]'));
  if (!dataEl || !pick || !select || !msg || !panels.length) return;

  var data;
  try { data = JSON.parse(dataEl.textContent || '{}'); } catch (e) { return; }
  var districts = data.districts || [];
  var elsewhere = data.elsewhere || [];
  var regions = data.regions || {};
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
  /* A line of its own in the status message, with an optional link. */
  function addLine(text, href, label) {
    var line = document.createElement('span');
    line.className = 'cand-htv2-line';
    line.appendChild(document.createTextNode(text));
    if (href && label) {
      line.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      line.appendChild(a);
    }
    msg.appendChild(line);
  }

  /* Reveal one district's panel. moveFocus is true ONLY for explicit
     activation — never for a <select> change. */
  function markChips(slug) {
    chips.forEach(function (c) {
      if (c.getAttribute('data-district-chip') === slug) c.setAttribute('aria-current', 'true');
      else c.removeAttribute('aria-current');
    });
  }
  function show(slug, moveFocus) {
    if (!slug) {
      panels.forEach(function (p) { p.hidden = true; });
      markChips('');
      clearMsg();
      return;
    }
    var panel = panelFor(slug);
    if (!panel) return;
    panels.forEach(function (p) { p.hidden = p !== panel; });
    markChips(slug);
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

  chips.forEach(function (c) {
    c.addEventListener('click', function (e) {
      var slug = c.getAttribute('data-district-chip');
      if (!panelFor(slug)) return; /* no panel: let the link do its job */
      e.preventDefault();
      show(slug, true);
    });
  });

  if (showBtn) {
    showBtn.addEventListener('click', function () {
      if (!select.value) { say('Choose your district from the list first.'); return; }
      show(select.value, true);
    });
  }

  /* ---- postcode, suburb or district lookup ------------------------------
     The same rule and the same wording as the hub's electorate finder
     (public/assets/js/electorate-finder.js) so the two lookups can never
     contradict each other: a four-digit postcode matches exactly; text
     matches a suburb exactly, else the suburbs that start with it followed
     by those that contain it — here a district's own name counts as one of
     its suburbs, because twenty districts are not named after a suburb in
     them. It is a little more forgiving than the hub about address-style
     entries: punctuation, a trailing "VIC", a postcode typed after the
     suburb.

     Only an EXACT match (a postcode, or a whole suburb or district name) is
     treated as the reader's place. A place in ANOTHER Council region is never
     shown this region's paper: the panels close, and the message names every
     region it falls in, each with the link the page worked out for it
     (ADR-77) — that region's candidate, or its ticket, or "nobody standing
     there yet". A place split between this region and another shows this
     region's district, then says where the rest of it votes. A PARTIAL match
     ("Glen") opens nothing by itself: like the hub, it lists the places
     matching it — ours as buttons to choose from, the rest with their
     region's link. */
  var MAX_TEXT_HITS = 6;
  /* Case, accents, spacing — and the punctuation people type in an
     address ("St. Albans", "South West Coast" for South-West Coast). Applied
     to the data and the input alike, so they always compare like with like. */
  function fold(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-.,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function placesOf(d) { return [d.name].concat(d.suburbs || []); }
  /* The place in district d that the text matched, when it is not the
     district's own name — "Pascoe Vale (Glenroy)" says why it is listed. */
  function via(d, q) {
    if (!q || fold(d.name).indexOf(q) !== -1) return '';
    var hit = (d.suburbs || []).filter(function (p) { return fold(p) === q; })[0] ||
      (d.suburbs || []).filter(function (p) { return fold(p).indexOf(q) !== -1; })[0];
    return hit ? ' (' + hit + ')' : '';
  }
  /* A whole place name as the data spells it ("Box Hill", not "box hill"). */
  function properName(list, q) {
    for (var i = 0; i < list.length; i++) {
      var p = placesOf(list[i]).filter(function (x) { return fold(x) === q; })[0];
      if (p) return p;
    }
    return '';
  }
  /* { exact, list }: exact = a postcode or a whole place name. */
  function matches(list, q, numeric) {
    if (numeric) {
      return { exact: true, list: list.filter(function (d) { return (d.postcodes || []).indexOf(q) !== -1; }) };
    }
    var exact = list.filter(function (d) {
      return placesOf(d).some(function (p) { return fold(p) === q; });
    });
    if (exact.length) return { exact: true, list: exact };
    var starts = list.filter(function (d) {
      return placesOf(d).some(function (p) { return fold(p).indexOf(q) === 0; });
    });
    var contains = list.filter(function (d) {
      return starts.indexOf(d) === -1 && placesOf(d).some(function (p) { return fold(p).indexOf(q) !== -1; });
    });
    return { exact: false, list: starts.concat(contains) };
  }
  function choices(list, q) {
    var row = document.createElement('span');
    row.className = 'cand-htv2-choices';
    list.forEach(function (h) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--ghost btn--sm';
      b.textContent = h.name + via(h, q);
      b.addEventListener('click', function () { show(h.slug, true); });
      row.appendChild(b);
    });
    msg.appendChild(row);
  }
  /* Close every panel, and forget the district in the select and the URL —
     a place elsewhere must never leave this region's paper on screen. */
  function closePanels() {
    panels.forEach(function (p) { p.hidden = true; });
    markChips('');
    select.value = '';
    try { history.replaceState(null, '', location.pathname + '#ballot-other'); } catch (e) { /* see show() */ }
  }
  function regionOf(id) { return regions[id] || { name: id, href: '', label: '' }; }
  /* "Footscray District (Western Metropolitan Region)" — one per region,
     each followed by that region's link. */
  function tellElsewhere(out, lead, q) {
    var byRegion = [];
    out.forEach(function (d) {
      var g = null;
      for (var i = 0; i < byRegion.length; i++) if (byRegion[i].id === d.region) g = byRegion[i];
      if (!g) { g = { id: d.region, names: [] }; byRegion.push(g); }
      var label = d.name + ' District' + via(d, q);
      if (g.names.indexOf(label) === -1) g.names.push(label);
    });
    if (lead) addLine(lead);
    byRegion.forEach(function (g) {
      var r = regionOf(g.id);
      var where = g.names.join(' and ') + ' — ' + r.name + ' Region.';
      if (r.href) addLine(where, r.href, r.label);
      else addLine(where + ' We don’t have a candidate standing in ' + r.name + ' Region yet.', '/candidates', 'See all our candidates →');
    });
  }

  function lookup() {
    var raw = (pcInput && pcInput.value ? pcInput.value : '').trim();
    /* Address-style entries: drop a trailing "VIC"/"Victoria", and when a
       Victorian postcode sits inside the text ("Coburg 3058") use the place
       if it is an exact name, else the postcode. */
    var noState = function (t) { return t.replace(/(^|\s)(vic|victoria)$/, '').trim(); };
    var typed = noState(fold(raw));
    var pcIn = /(^|\s)(3\d{3})(\s|$)/.exec(typed);
    if (pcIn && !/^\d+$/.test(typed)) {
      var rest = noState(typed.replace(pcIn[2], ' ').replace(/\s+/g, ' ').trim());
      var restExact = rest && matches(districts.concat(elsewhere), rest, false).exact;
      typed = restExact ? rest : pcIn[2];
    }
    var numeric = /^\d+$/.test(typed);
    var q = typed;
    if (numeric) raw = typed;
    if (numeric) {
      if (!/^\d{4}$/.test(q)) { closePanels(); say('Enter a four-digit Victorian postcode (3000–3999), or a suburb name.'); return; }
      if (q[0] !== '3') { closePanels(); say('That doesn’t look like a Victorian postcode — Victorian postcodes start with 3. You can also search by suburb.'); return; }
    } else if (q.length < 3) {
      closePanels();
      say('Type at least three letters of your suburb or town, or a four-digit postcode.');
      return;
    }
    /* One ranking over every district, so an exact match anywhere beats a
       partial one here (and the other way round). */
    var found = matches(districts.concat(elsewhere), q, numeric);
    var hits = found.list.filter(function (d) { return districts.indexOf(d) !== -1; });
    var tq = numeric ? '' : q;
    if (!numeric && found.exact) raw = properName(found.list, q) || raw;
    var out = found.list.filter(function (d) { return districts.indexOf(d) === -1; });
    if (!numeric && hits.length + out.length > MAX_TEXT_HITS) {
      closePanels();
      say('“' + raw + '” matches too many places — keep typing your suburb or town.');
      return;
    }
    /* Part of a name: nothing opens by itself; list what matches. */
    if (!found.exact && hits.length + out.length) {
      closePanels();
      clearMsg();
      if (hits.length) {
        addLine('Places matching “' + raw + '” in ' + regionName + ' Region — choose yours:');
        choices(hits, tq);
      }
      if (out.length) {
        tellElsewhere(out, hits.length ? 'In other regions:' : 'Places matching “' + raw + '” are in other regions:', tq);
      }
      return;
    }
    if (hits.length === 1) {
      show(hits[0].slug, true);
      if (out.length) tellElsewhere(out, 'Part of ' + raw + ' is in another region:', tq);
      return;
    }
    if (hits.length > 1) {
      closePanels();
      say(raw + ' covers more than one district in ' + regionName + ' Region. Choose yours:');
      choices(hits, tq);
      if (out.length) tellElsewhere(out, 'Part of ' + raw + ' is in another region:', tq);
      return;
    }
    /* Never silently show a paper from another region. */
    closePanels();
    if (out.length) {
      clearMsg();
      tellElsewhere(out, raw + ' is not in ' + regionName + ' Region — it votes in:', tq);
      return;
    }
    say(numeric
      ? 'No match for ' + raw + ' in our lookup — try your suburb instead, or check the VEC.'
      : 'No match for “' + raw + '” in our lookup — try a four-digit postcode, or check the VEC.');
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
