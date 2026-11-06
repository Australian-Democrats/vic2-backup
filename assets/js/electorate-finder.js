/* /candidates — "Enter your postcode or suburb" (ADR-71 addendum), under the
   "Meet the Democrats standing for Victoria" heading and above the list's own
   name search. It does not draw results of its own: it works out which of the
   candidates on the list are on the visitor's ballot and tells the list
   (candidates-hub.js) to show only them — their lower-house candidate first,
   then their upper-house team.

   Only places where we HAVE candidates are ever suggested or offered. The
   dropdown lists a suburb or postcode only when at least one of its districts
   has a Democrat standing for it (in the district, or in its region); the
   hints and the chooser name only the electorates with candidates. A search
   for somewhere we have nobody yet says so plainly and leaves the full list.

   When the place is covered by more than one electorate WITH candidates — two
   districts we stand in, or two regions with teams — all of them are shown,
   the status line says so, and buttons let the visitor choose theirs.
   Districts that would give the same answer (the same region team, no
   district candidate) are one choice, not several.

   Data is baked into the page (#efinderData) at build time: every district's
   postcodes and suburbs, its region, and the ids of the candidates ON THE LIST
   for it — so a held-back candidate cannot be named here. No network.

   Combobox: the ARIA 1.2 pattern — the input owns aria-expanded and
   aria-activedescendant, options are role="option", focus never leaves the
   input while choosing. Everything is built with DOM text nodes, never HTML
   strings, so nothing typed or stored can become markup. Progressive
   enhancement: the tool is [hidden] until this script runs. */
(function () {
  'use strict';

  var dataEl = document.getElementById('efinderData');
  var tool = document.getElementById('efinderTool');
  if (!dataEl || !tool) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    return;
  }
  if (!data.districts || !data.districts.length || !data.regions) return;

  var input = document.getElementById('efinderInput');
  var go = document.getElementById('efinderGo');
  var list = document.getElementById('efinderList');
  var statusEl = document.getElementById('efinderStatus');
  var chooseEl = document.getElementById('efinderChoose');
  var clearBtn = document.getElementById('efinderClear');
  if (!input || !go || !list || !statusEl || !chooseEl || !clearBtn) return;

  var L = data.labels || {};
  var districtNoun = L.districtNoun || 'district';
  var regionNoun = L.regionNoun || 'region';
  var regionSuffix = typeof L.regionSuffix === 'string' ? L.regionSuffix : ' Region';
  var MAX_OPTS = 8;
  var MAX_CHOICES = 6;

  function fold(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Join names the way a person would say them. */
  function sayList(names) {
    if (names.length < 2) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  /* ------------------------------------------------------------ the data */
  function regionOf(d) {
    return d.region && data.regions[d.region] ? data.regions[d.region] : null;
  }
  function lowerIds(d) {
    return d.ids && d.ids.length ? d.ids : [];
  }
  function teamRegion(d) {
    var r = regionOf(d);
    return r && r.ids && r.ids.length ? r : null;
  }
  function hasPeople(d) {
    return lowerIds(d).length > 0 || !!teamRegion(d);
  }
  function districtName(d) {
    return d.name + ' ' + districtNoun;
  }
  function regionName(r) {
    return r.name + regionSuffix;
  }

  /* suburb (folded) → { label, districts[] } and postcode → districts[], over
     EVERY district — so "we have nobody there yet" can be told apart from "we
     don't know that place". Only places with people are ever suggested. */
  var suburbIdx = Object.create(null);
  var postcodeIdx = Object.create(null);
  data.districts.forEach(function (d) {
    (d.suburbs || []).forEach(function (sub) {
      var k = fold(sub);
      if (!k) return;
      var e = suburbIdx[k] || (suburbIdx[k] = { label: sub, districts: [] });
      if (e.districts.indexOf(d) === -1) e.districts.push(d);
    });
    (d.postcodes || []).forEach(function (pc) {
      var e = postcodeIdx[pc] || (postcodeIdx[pc] = []);
      if (e.indexOf(d) === -1) e.push(d);
    });
  });
  var suburbKeys = Object.keys(suburbIdx)
    .filter(function (k) { return suburbIdx[k].districts.some(hasPeople); })
    .sort();
  var postcodeKeys = Object.keys(postcodeIdx)
    .filter(function (pc) { return postcodeIdx[pc].some(hasPeople); })
    .sort();

  /* The distinct answers a set of districts gives, lower-house answers first.
     Districts with nobody standing for them drop out entirely; districts that
     give the SAME answer (no district candidate, the same region team) merge
     into one choice — so the visitor is only ever asked to choose where the
     choice changes who is on their ballot. */
  function choicesFor(hits) {
    var byKey = Object.create(null);
    var out = [];
    hits.forEach(function (d) {
      if (!hasPeople(d)) return;
      var low = lowerIds(d);
      var r = teamRegion(d);
      var key = low.join(',') + '|' + (r ? d.region : '');
      if (byKey[key]) return;
      byKey[key] = {
        district: low.length ? d : null,
        region: r,
        regionKey: r ? d.region : '',
        lower: low,
        ids: low.concat(r ? r.ids : []),
      };
      out.push(byKey[key]);
    });
    out.sort(function (a, b) { return (b.lower.length ? 1 : 0) - (a.lower.length ? 1 : 0); });
    out.forEach(function (c) {
      var names = [];
      if (c.district) names.push(districtName(c.district));
      if (c.region) names.push(regionName(c.region));
      c.names = names;
      var shares = !c.district && out.some(function (o) { return o !== c && o.regionKey === c.regionKey; });
      c.label = names.join(' · ') + (shares ? ' only' : '');
    });
    return out;
  }

  /* The electorates with candidates a set of districts touches, for hints. */
  function electoratesFor(ds) {
    var names = [];
    choicesFor(ds).forEach(function (c) {
      c.names.forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });
    });
    return names;
  }

  /* -------------------------------------------------------- the list filter
     candidates-hub.js listens; `ids` null = show everyone. */
  function tellList(ids, lower) {
    var detail = { ids: ids, lower: lower || [] };
    var ev;
    try {
      ev = new CustomEvent('cand:area', { detail: detail });
    } catch (e) {
      ev = document.createEvent('CustomEvent');
      ev.initCustomEvent('cand:area', false, false, detail);
    }
    document.dispatchEvent(ev);
  }

  /* ------------------------------------------------------------- answering */
  var current = null; // { where, choices, chosen }

  function union(choices, key) {
    var seen = Object.create(null);
    var out = [];
    choices.forEach(function (c) {
      c[key].forEach(function (id) {
        if (!seen[id]) { seen[id] = true; out.push(id); }
      });
    });
    return out;
  }

  function button(cls, text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    return b;
  }

  function renderChooser() {
    chooseEl.textContent = '';
    if (!current || current.choices.length < 2) {
      chooseEl.hidden = true;
      return;
    }
    var group = document.createElement('div');
    group.className = 'efr-choices';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Choose your electorate');
    current.choices.forEach(function (c, i) {
      var b = button('efr-choice', c.label);
      b.setAttribute('data-choose', String(i));
      b.setAttribute('aria-pressed', current.chosen === i ? 'true' : 'false');
      group.appendChild(b);
    });
    if (current.chosen !== null) {
      var n = current.choices.length;
      var all = button('efr-showall', n === 2 ? 'Show both' : 'Show all ' + n);
      all.setAttribute('data-choose', 'all');
      group.appendChild(all);
    }
    chooseEl.appendChild(group);
    chooseEl.hidden = false;
  }

  function coverNote(choices) {
    var districts = choices.filter(function (c) { return c.district; }).length;
    var regions = Object.create(null);
    choices.forEach(function (c) { if (c.regionKey) regions[c.regionKey] = true; });
    var manyRegions = Object.keys(regions).length > 1;
    var manyDistricts = districts > 1 || (!manyRegions && choices.length > 1);
    if (manyDistricts && manyRegions) return 'More than one ' + districtNoun + ' and more than one ' + regionNoun;
    if (manyRegions) return 'More than one ' + regionNoun;
    return 'More than one ' + districtNoun;
  }

  /* "On your ballot" is said only when it is true: one answer, for a whole
     postcode or suburb. Where part of the place lies in electorates we have
     nobody in (they are never named), or the search was a fragment of a name,
     the line says what is shown without claiming it is the visitor's ballot. */
  function paint() {
    var c = current;
    var shown = c.chosen === null ? c.choices : [c.choices[c.chosen]];
    tellList(union(shown, 'ids'), union(shown, 'lower'));
    var where = c.fragment ? 'places matching ' + c.where : c.where;
    var rest = c.partial ? ' Part of ' + c.where + ' has no Democrat candidates yet.' : '';
    if (c.choices.length === 1) {
      var names = sayList(c.choices[0].names);
      statusEl.textContent = c.fragment
        ? 'Showing the Democrats standing for ' + where + ': ' + names + '. Pick your suburb from the list to see your own ballot.'
        : c.partial
          ? 'Part of ' + c.where + ' is in ' + names + ' — showing the Democrats standing there. We don’t have candidates for the rest of ' + c.where + ' yet.'
          : 'Showing the Democrats on your ballot for ' + c.where + ': ' + names + '.';
    } else if (c.chosen === null) {
      statusEl.textContent =
        coverNote(c.choices) + ' with Democrat candidates covers ' + where +
        ', so we’re showing them all.' + rest + ' Choose yours:';
    } else {
      statusEl.textContent =
        coverNote(c.choices) + ' with Democrat candidates covers ' + c.where +
        '. Showing ' + sayList(c.choices[c.chosen].names) + '.';
    }
    renderChooser();
    clearBtn.hidden = false;
  }

  function reset(text) {
    current = null;
    tellList(null);
    statusEl.textContent = text || '';
    chooseEl.textContent = '';
    chooseEl.hidden = true;
    clearBtn.hidden = true;
  }

  function show(where, hits, fragment) {
    var choices = choicesFor(hits);
    if (!choices.length) {
      return reset('We don’t have candidates standing for ' + where + ' yet — all our candidates are listed below.');
    }
    if (choices.length > MAX_CHOICES) {
      return reset('“' + input.value.trim() + '” matches too many places — keep typing, or pick a suburb from the list.');
    }
    current = {
      where: where,
      choices: choices,
      chosen: null,
      fragment: !!fragment,
      partial: hits.some(function (d) { return !hasPeople(d); }),
    };
    paint();
  }

  /* Free text (Find, or Enter with no option chosen). */
  function lookupText(raw) {
    var q = String(raw || '').trim();
    if (!q) return reset('');
    if (/^\d+$/.test(q)) {
      if (!/^\d{4}$/.test(q)) return reset('Enter a four-digit Victorian postcode (3000–3999), or a suburb name.');
      if (q[0] !== '3') return reset('That doesn’t look like a Victorian postcode — Victorian postcodes start with 3. You can also search by suburb.');
      if (!postcodeIdx[q]) return reset('No match for ' + q + ' in our lookup — try your suburb instead, or check the VEC.');
      return show('postcode ' + q, postcodeIdx[q]);
    }
    if (q.length < 3) return reset('Type at least three letters of your suburb or town, or a four-digit postcode.');
    var k = fold(q);
    if (suburbIdx[k]) return show(suburbIdx[k].label, suburbIdx[k].districts);
    // Partial text: the districts with a suburb that starts with it, then
    // those with one that contains it.
    var starts = [];
    var contains = [];
    data.districts.forEach(function (d) {
      var kind = '';
      (d.suburbs || []).forEach(function (sub) {
        var low = fold(sub);
        if (low.indexOf(k) === 0) kind = 'starts';
        else if (!kind && low.indexOf(k) !== -1) kind = 'contains';
      });
      if (kind === 'starts') starts.push(d);
      else if (kind === 'contains') contains.push(d);
    });
    var hits = starts.concat(contains);
    if (!hits.length) return reset('No match for “' + q + '” in our lookup — try a four-digit postcode, or check the VEC.');
    show('“' + q + '”', hits, true);
  }

  /* --------------------------------------------------------------- dropdown */
  var opts = [];
  var active = -1;

  function close() {
    opts = [];
    active = -1;
    list.textContent = '';
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function suggest(raw) {
    var q = fold(raw);
    opts = [];
    if (q.length >= 2) {
      if (/^\d+$/.test(q)) {
        postcodeKeys
          .filter(function (pc) { return pc.indexOf(q) === 0; })
          .slice(0, MAX_OPTS)
          .forEach(function (pc) {
            opts.push({ kind: 'postcode', key: pc, label: pc, hint: electoratesFor(postcodeIdx[pc]).join(', ') });
          });
      } else {
        var starts = suburbKeys.filter(function (k) { return k.indexOf(q) === 0; });
        var contains = suburbKeys.filter(function (k) { return k.indexOf(q) > 0; });
        starts.concat(contains).slice(0, MAX_OPTS).forEach(function (k) {
          opts.push({ kind: 'suburb', key: k, label: suburbIdx[k].label, hint: electoratesFor(suburbIdx[k].districts).join(', ') });
        });
      }
    }
    if (!opts.length) return close();
    active = -1;
    list.textContent = '';
    opts.forEach(function (o, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'efopt-' + i;
      li.setAttribute('data-opt', String(i));
      li.setAttribute('aria-selected', 'false');
      var name = document.createElement('span');
      name.className = 'efinder-opt';
      name.textContent = o.label;
      var hint = document.createElement('span');
      hint.className = 'efinder-opt-hint';
      hint.textContent = o.hint;
      li.appendChild(name);
      li.appendChild(hint);
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
  }

  function setActive(i) {
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    Array.prototype.forEach.call(list.children, function (li, n) {
      li.setAttribute('aria-selected', n === active ? 'true' : 'false');
    });
    var li = document.getElementById('efopt-' + active);
    input.setAttribute('aria-activedescendant', 'efopt-' + active);
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    var o = opts[i];
    if (!o) return;
    input.value = o.label;
    close();
    if (o.kind === 'postcode') show('postcode ' + o.key, postcodeIdx[o.key]);
    else show(suburbIdx[o.key].label, suburbIdx[o.key].districts);
  }

  input.addEventListener('input', function () {
    var v = (input.value || '').trim();
    if (/^\d{4}$/.test(v)) {
      close();
      lookupText(v);
      return;
    }
    if (!v) reset('');
    suggest(v);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.hidden) suggest(input.value);
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!list.hidden) setActive(active < 0 ? opts.length - 1 : active - 1);
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!list.hidden && active >= 0) choose(active);
      else { close(); lookupText(input.value); }
    } else if (e.key === 'Escape') {
      if (!list.hidden) { e.preventDefault(); close(); }
    }
  });
  input.addEventListener('blur', function () {
    window.setTimeout(close, 150);
  });
  // mousedown, not click, and on the WHOLE list: focus stays in the input, so
  // blur never closes the list before a choice lands — nor while the visitor
  // drags the list's own scrollbar.
  list.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var li = e.target && e.target.closest ? e.target.closest('[data-opt]') : null;
    if (li) choose(parseInt(li.getAttribute('data-opt'), 10));
  });
  go.addEventListener('click', function () {
    close();
    lookupText(input.value);
  });

  // The chooser: pick one, or go back to all of them. The buttons are rebuilt,
  // so focus follows the pressed one rather than dropping to the page.
  chooseEl.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-choose]') : null;
    if (!b || !current) return;
    var v = b.getAttribute('data-choose');
    current.chosen = v === 'all' ? null : parseInt(v, 10);
    if (current.chosen !== null && !current.choices[current.chosen]) current.chosen = null;
    paint();
    var again = chooseEl.querySelector('[data-choose="' + (v === 'all' ? '0' : v) + '"]');
    if (again) again.focus();
  });

  // "Show all candidates": back to the whole list, focus back in the box.
  clearBtn.addEventListener('click', function () {
    input.value = '';
    close();
    reset('');
    input.focus();
  });

  tool.hidden = false;
  // A browser that restored the box on Back: answer it again once the list's
  // script (loaded after this one) is listening.
  if ((input.value || '').trim()) {
    window.setTimeout(function () { lookupText(input.value); }, 0);
  }
})();
