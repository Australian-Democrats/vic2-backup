/* /how-to-vote — "Find your how-to-vote card" (ADR-104). The /candidates
   finder's look and behaviour (public/assets/js/electorate-finder.js: the
   ARIA 1.2 combobox, suggestions, a chooser where a place spans districts),
   answering with the party's REGISTERED cards, which are already on the page
   (src/components/HtvCardViewer.astro, one .htvf-slot each).

   A voter is handed two papers: their district's (lower house) and their
   region's (upper house). So a place shows its district's card when there is
   one AND its region's card when there is one — and a place with neither is
   told plainly that we are not standing there at this election, with links to
   all our candidates and to join or volunteer. A district card that also gives
   the upper house vote (data: papers "both") is described as covering both
   papers, never as the lower house card alone.

   Only places with at least one card are ever suggested. A suburb, a postcode,
   a district's name ("Lowan") or a region's name all work. Where one place is
   split between districts that give different answers (3032: Essendon votes
   in Northern Metropolitan, Footscray in Western Metropolitan — two different
   upper house columns), all their cards show, and the voter is asked which
   DISTRICT they are in: the status line names the districts, each choice is a
   district (with the card it gets beneath), each card on show says which
   districts it is for, and a link offers the VEC's address lookup for anyone
   who doesn't know. Districts that give the same answer (no card of their
   own, the same region) are one choice.

   Deep links: /how-to-vote/#richmond opens Richmond's card with its region's;
   #northern-metropolitan opens that region's card; a district with no card of
   its own (#melbourne) opens its region's. A search updates the address the
   same way, so a copied link opens straight to the answer.

   Data is baked into the page (#htvFinderData) at build time — every Victorian
   district's postcodes, suburbs and region, and which have a card. No network.
   Everything is built with DOM text nodes, never HTML strings. Progressive
   enhancement: without this script the tool stays [hidden] and every card is
   listed on the page. */
(function () {
  'use strict';

  var dataEl = document.getElementById('htvFinderData');
  var tool = document.getElementById('htvFinderTool');
  if (!dataEl || !tool) return;
  var data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    return;
  }
  if (!data.districts || !data.districts.length || !data.regions) return;

  var input = document.getElementById('htvFinderInput');
  var go = document.getElementById('htvFinderGo');
  var list = document.getElementById('htvFinderList');
  var statusEl = document.getElementById('htvFinderStatus');
  var chooseEl = document.getElementById('htvFinderChoose');
  var clearBtn = document.getElementById('htvFinderClear');
  var noneEl = document.getElementById('htvFinderNone');
  var noneH = document.getElementById('htvFinderNoneH');
  var noneBody = document.getElementById('htvFinderNoneBody');
  var index = document.getElementById('htvFinderAll');
  var vecEl = document.getElementById('htvFinderVec');
  if (!input || !go || !list || !statusEl || !chooseEl || !clearBtn || !noneEl) return;

  // The cards on the page, and their order there (lower house first).
  var slots = {};
  var slotRank = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-htvf-slot]'), function (el, i) {
    var slug = el.getAttribute('data-htvf-slot');
    slots[slug] = el;
    slotRank[slug] = i;
  });

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX_OPTS = 8;
  var MAX_CHOICES = 6;

  function fold(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function sayList(names, joiner) {
    if (names.length < 2) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' ' + (joiner || 'and') + ' ' + names[names.length - 1];
  }
  function pushNew(arr, v) {
    if (v && arr.indexOf(v) === -1) arr.push(v);
  }
  /* "Essendon District", "Ashwood District or Box Hill District", and past
     three, "Ashwood District, Box Hill District or 3 more districts". */
  function whichDistricts(names) {
    if (names.length <= 3) return sayList(names, 'or');
    return names.slice(0, 2).join(', ') + ' or ' + (names.length - 2) + ' more districts';
  }

  /* ------------------------------------------------------------ the data */
  var bySlug = Object.create(null);
  data.districts.forEach(function (d) {
    bySlug[d.slug] = d;
  });
  function region(d) {
    return d.region && data.regions[d.region] ? data.regions[d.region] : null;
  }
  function regionHasCard(d) {
    var r = region(d);
    return !!(r && r.card && slots[d.region]);
  }
  function districtHasCard(d) {
    return !!(d.card && slots[d.slug]);
  }
  function hasCards(d) {
    return districtHasCard(d) || regionHasCard(d);
  }
  function districtName(d) {
    return d.name + ' District';
  }
  /* What a district's own card covers, in a status line's words. */
  function papersOf(d) {
    return d.papers === 'both' ? 'both ballot papers' : 'lower house';
  }
  function regionName(slug) {
    return data.regions[slug] ? data.regions[slug].name + ' Region' : '';
  }

  var suburbIdx = Object.create(null);
  var postcodeIdx = Object.create(null);
  var districtIdx = Object.create(null);
  var regionIdx = Object.create(null);
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
    districtIdx[fold(d.name)] = d;
    districtIdx[fold(d.name + ' district')] = d;
  });
  Object.keys(data.regions).forEach(function (slug) {
    var r = data.regions[slug];
    regionIdx[fold(r.name)] = slug;
    regionIdx[fold(r.name + ' region')] = slug;
  });
  var suburbKeys = Object.keys(suburbIdx)
    .filter(function (k) { return suburbIdx[k].districts.some(hasCards); })
    .sort();
  var postcodeKeys = Object.keys(postcodeIdx)
    .filter(function (pc) { return postcodeIdx[pc].some(hasCards); })
    .sort();
  var districtKeys = data.districts.filter(hasCards).map(function (d) { return fold(d.name); }).sort();
  var regionKeys = Object.keys(data.regions)
    .filter(function (slug) { return data.regions[slug].card && slots[slug]; })
    .map(function (slug) { return fold(data.regions[slug].name); })
    .sort();

  /* The distinct answers a set of districts gives. Districts with no card at
     all drop out; districts that give the SAME answer (no card of their own,
     the same region card) merge into one choice. */
  function choicesFor(hits) {
    var byKey = Object.create(null);
    var out = [];
    hits.forEach(function (d) {
      if (!hasCards(d)) return;
      var own = districtHasCard(d);
      var reg = regionHasCard(d);
      var key = (own ? d.slug : '') + '|' + (reg ? d.region : '');
      var c = byKey[key];
      if (!c) {
        c = byKey[key] = { district: own ? d : null, regionSlug: reg ? d.region : '', districts: [], cards: [] };
        if (own) c.cards.push(d.slug);
        if (reg) c.cards.push(d.region);
        out.push(c);
      }
      c.districts.push(d);
    });
    // In the order their cards sit on the page, so the choices read top to
    // bottom the way the cards below them do (a district's own card first).
    out.sort(function (a, b) { return slotRank[a.cards[0]] - slotRank[b.cards[0]]; });
    out.forEach(function (c) {
      var names = [];
      if (c.district) names.push(districtName(c.district));
      if (c.regionSlug) names.push(regionName(c.regionSlug));
      c.names = names;
      // A choice is the DISTRICT a voter is in (they can look that up); the
      // card(s) it gets are the line beneath.
      c.label = whichDistricts(c.districts.map(districtName));
      c.sub = (c.cards.length > 1 ? 'Cards for ' : 'Card for ') + sayList(names);
      // The address that reopens exactly this answer.
      c.hash = c.district ? c.district.slug : c.districts.length === 1 ? c.districts[0].slug : c.regionSlug;
    });
    return out;
  }

  function electoratesFor(ds) {
    var names = [];
    choicesFor(ds).forEach(function (c) {
      c.names.forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });
    });
    return names;
  }

  /* ------------------------------------------------------- showing cards */
  function showCards(slugs) {
    Object.keys(slots).forEach(function (s) {
      slots[s].hidden = slugs.indexOf(s) === -1;
    });
    // The browse tiles mark the cards on show.
    if (index) {
      Array.prototype.forEach.call(index.querySelectorAll('[data-htvf-pick]'), function (a) {
        if (slugs.indexOf(a.getAttribute('data-htvf-pick')) === -1) a.removeAttribute('aria-current');
        else a.setAttribute('aria-current', 'true');
      });
    }
  }
  function firstShown() {
    var all = document.querySelectorAll('[data-htvf-slot]');
    for (var i = 0; i < all.length; i++) if (!all[i].hidden) return all[i];
    return null;
  }
  function reveal(el) {
    if (!el) return;
    window.requestAnimationFrame(function () {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }
  /* Only ever touches an address that is one of ours — never #content (the
     skip link) or any other anchor on the page. */
  function ourHash() {
    var h = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
    return !!h && (!!data.regions[h] || !!bySlug[h]);
  }
  function setHash(slug) {
    if (!slug && !ourHash()) return;
    try {
      history.replaceState(null, '', slug ? '#' + slug : window.location.pathname + window.location.search);
    } catch (e) {
      /* a sandboxed frame: the address just doesn't follow */
    }
  }

  /* Name the electorates the place is in, so "not standing" is about them: a
     region asked for by name is just that region; a place in a few districts
     names them and their regions; a search spread over more than three
     districts is named by what was searched, never a dozen-name heading. */
  function noneFor(hits, where, opts) {
    var names = [];
    if (opts && opts.region) {
      names = [regionName(opts.region)];
    } else {
      var ds = [];
      var rs = [];
      hits.forEach(function (d) {
        pushNew(ds, districtName(d));
        if (d.region) pushNew(rs, regionName(d.region));
      });
      if (ds.length <= 3) names = ds.concat(rs);
    }
    var said = names.length
      ? sayList(names, 'or')
      : hits.length
      ? 'any of the districts ' + (opts && opts.fragment ? 'matching ' : 'covering ') + where
      : where;
    noneH.textContent = 'We’re not standing in ' + said + ' at this election';
    noneBody.textContent =
      'So there’s no Australian Democrats how-to-vote card for ' + where + '. You can still see who we’re running across Victoria, or help us grow.';
    noneEl.hidden = false;
  }

  /* --------------------------------------------------------------- answers */
  var current = null; // { where, choices, chosen, fragment, partial, missing }

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
    group.className = 'htvf-choices';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Choose your district');
    current.choices.forEach(function (c, i) {
      var b = button('htvf-choice', '');
      var main = document.createElement('span');
      main.className = 'htvf-choice-d';
      main.textContent = c.label;
      var gap = document.createElement('span');
      gap.className = 'visually-hidden';
      gap.textContent = ': ';
      var sub = document.createElement('span');
      sub.className = 'htvf-choice-r';
      sub.textContent = c.sub;
      b.appendChild(main);
      b.appendChild(gap);
      b.appendChild(sub);
      b.setAttribute('data-choose', String(i));
      b.setAttribute('aria-pressed', current.chosen === i ? 'true' : 'false');
      group.appendChild(b);
    });
    if (current.chosen !== null) {
      var n = current.choices.length;
      var all = button('htvf-showall', n === 2 ? 'Show both' : 'Show all ' + n);
      all.setAttribute('data-choose', 'all');
      group.appendChild(all);
    }
    chooseEl.appendChild(group);
    chooseEl.hidden = false;
  }

  /* One answer in words. `where` leads it ("Postcode 3121: our cards for …");
     empty, or the district itself, and the sentence stands alone. */
  function lead(where, text) {
    return where ? where + ': ' + text.charAt(0).toLowerCase() + text.slice(1) : text;
  }
  function sentenceFor(c, where) {
    if (c.district) {
      var own = districtName(c.district);
      if (where === own) where = '';
      if (c.regionSlug) {
        return lead(where, 'Our cards for ' + own + ' (' + papersOf(c.district) + ') and ' + regionName(c.regionSlug) + ' (upper house).');
      }
      // No card for the region. A card that covers both papers already says
      // what to do on the upper house one, so it is not contradicted here.
      var r = c.district.region ? regionName(c.district.region) : '';
      var notR = r && c.district.papers !== 'both' ? ' We’re not standing in ' + r + ' at this election.' : '';
      return lead(where, 'Our card for ' + own + ' (' + papersOf(c.district) + ').') + notR;
    }
    var ds = c.districts.map(districtName);
    var reg = regionName(c.regionSlug);
    if (!where || (ds.length === 1 && where === ds[0])) {
      return 'We’re not standing in ' + sayList(ds, 'or') + ' at this election — this is our card for ' + (ds.length > 1 ? 'their' : 'its') + ' upper house region, ' + reg + '.';
    }
    return where + ' is in ' + sayList(ds) + ', where we’re not standing — this is our card for your upper house region, ' + reg + '.';
  }

  /* Each card on show says which districts it is for — only while the search
     was split between districts with different cards, where that is the
     question. Always the districts of the choices on show. */
  function markFor(shown) {
    var forSlug = Object.create(null);
    if (current && current.choices.length > 1) {
      shown.forEach(function (ch) {
        ch.cards.forEach(function (s) {
          var names = forSlug[s] || (forSlug[s] = []);
          ch.districts.forEach(function (d) { pushNew(names, districtName(d)); });
        });
      });
    }
    Object.keys(slots).forEach(function (s) {
      var p = slots[s].querySelector('[data-htvf-for]');
      if (!p) return;
      var names = forSlug[s];
      p.textContent = names && names.length ? 'If you’re in ' + whichDistricts(names) : '';
      p.hidden = !p.textContent;
    });
    if (vecEl) vecEl.hidden = !(current && current.choices.length > 1);
  }

  function paint(scroll) {
    var c = current;
    var shown = c.chosen === null ? c.choices : [c.choices[c.chosen]];
    var slugs = [];
    shown.forEach(function (x) {
      x.cards.forEach(function (s) { if (slugs.indexOf(s) === -1) slugs.push(s); });
    });
    noneEl.hidden = true;
    showCards(slugs);
    var where = c.fragment ? 'Places matching ' + c.where : c.where.charAt(0).toUpperCase() + c.where.slice(1);
    var rest = c.missing.length ? ' We’re not standing in ' + sayList(c.missing, 'or') + ' at this election.' : '';
    if (c.choices.length === 1) {
      statusEl.textContent = c.fragment
        ? where + ': ' + sayList(c.choices[0].names) + '. Pick your suburb from the list to be sure.'
        : sentenceFor(c.choices[0], where) + rest;
      setHash(c.fragment ? '' : c.choices[0].hash);
    } else if (c.chosen === null) {
      // Split between districts with different cards: name the districts, and
      // ask which one is theirs (the VEC link sits under the choices).
      var ds = [];
      c.choices.forEach(function (ch) {
        ch.districts.forEach(function (d) { pushNew(ds, districtName(d)); });
      });
      var dl = ds.length <= 4 ? sayList(ds) : ds.length + ' districts';
      statusEl.textContent = c.fragment
        ? where + ' are in ' + dl + ', and our cards differ between them, so we’re showing them all.' + rest +
          ' Pick your suburb from the list to be sure, or choose your district:'
        : where + (c.region ? ' takes in ' : ' is split between ') + dl +
          ', and our cards differ between them, so we’re showing them all.' + rest + ' Choose your district:';
      setHash('');
    } else {
      statusEl.textContent = sentenceFor(c.choices[c.chosen], '');
      setHash(c.choices[c.chosen].hash);
    }
    markFor(shown);
    renderChooser();
    clearBtn.hidden = false;
    if (scroll) reveal(firstShown());
  }

  function reset(text) {
    current = null;
    showCards([]);
    noneEl.hidden = true;
    statusEl.textContent = text || '';
    chooseEl.textContent = '';
    chooseEl.hidden = true;
    clearBtn.hidden = true;
    markFor([]);
    setHash('');
  }

  /* `region`: the region's slug when the visitor asked for a region by name. */
  function show(where, hits, fragment, scroll, region) {
    var choices = choicesFor(hits);
    if (!choices.length) {
      reset('No how-to-vote card for ' + where + ' — we’re not standing there at this election.');
      noneFor(hits, where, { fragment: !!fragment, region: region || '' });
      clearBtn.hidden = false;
      if (scroll) reveal(noneEl);
      return;
    }
    if (choices.length > MAX_CHOICES) {
      return reset('“' + input.value.trim() + '” matches too many places — keep typing, or pick a suburb from the list.');
    }
    var missing = [];
    hits.forEach(function (d) {
      if (!hasCards(d)) {
        var n = districtName(d);
        if (missing.indexOf(n) === -1) missing.push(n);
      }
    });
    current = { where: where, choices: choices, chosen: null, fragment: !!fragment, missing: missing, region: region || '' };
    paint(scroll);
  }

  function showRegion(slug, scroll) {
    if (!slots[slug]) return reset('');
    current = {
      where: regionName(slug),
      choices: [{ district: null, regionSlug: slug, districts: [], cards: [slug], names: [regionName(slug)], label: regionName(slug), sub: '', hash: slug }],
      chosen: null,
      fragment: false,
      missing: [],
      region: slug,
    };
    noneEl.hidden = true;
    showCards([slug]);
    markFor([]);
    statusEl.textContent = 'Our card for ' + regionName(slug) + ' (upper house).';
    renderChooser();
    clearBtn.hidden = false;
    setHash(slug);
    if (scroll) reveal(firstShown());
  }

  /* Free text (Find, or Enter with no option chosen). */
  function lookupText(raw, scroll) {
    var q = String(raw || '').trim();
    if (!q) return reset('');
    if (/^\d+$/.test(q)) {
      if (!/^\d{4}$/.test(q)) return reset('Enter a four-digit Victorian postcode (3000–3999), or a suburb name.');
      if (q[0] !== '3') return reset('That doesn’t look like a Victorian postcode — Victorian postcodes start with 3. You can also search by suburb.');
      if (!postcodeIdx[q]) return reset('No match for ' + q + ' in our lookup — try your suburb instead, or check the VEC.');
      return show('postcode ' + q, postcodeIdx[q], false, scroll);
    }
    if (q.length < 3) return reset('Type at least three letters of your suburb or town, or a four-digit postcode.');
    var k = fold(q);
    if (suburbIdx[k]) return show(suburbIdx[k].label, suburbIdx[k].districts, false, scroll);
    if (districtIdx[k]) return show(districtName(districtIdx[k]), [districtIdx[k]], false, scroll);
    if (regionIdx[k]) {
      var rs = regionIdx[k];
      if (slots[rs]) return showRegion(rs, scroll);
      var inRegion = data.districts.filter(function (d) { return d.region === rs; });
      return show(regionName(rs), inRegion, false, scroll, rs);
    }
    var starts = [];
    var contains = [];
    data.districts.forEach(function (d) {
      var kind = '';
      (d.suburbs || []).concat([d.name]).forEach(function (sub) {
        var low = fold(sub);
        if (low.indexOf(k) === 0) kind = 'starts';
        else if (!kind && low.indexOf(k) !== -1) kind = 'contains';
      });
      if (kind === 'starts') starts.push(d);
      else if (kind === 'contains') contains.push(d);
    });
    var hits = starts.concat(contains);
    if (!hits.length) return reset('No match for “' + q + '” in our lookup — try a four-digit postcode, or check the VEC.');
    show('“' + q + '”', hits, true, scroll);
  }

  /* An address like #richmond — a card's own slug, or any district's. */
  function applyHash(scroll) {
    var slug = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
    if (!slug) return false;
    if (data.regions[slug]) {
      showRegion(slug, scroll);
      return true;
    }
    if (bySlug[slug]) {
      show(districtName(bySlug[slug]), [bySlug[slug]], false, scroll);
      return true;
    }
    return false;
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
        var seen = Object.create(null);
        var add = function (o) {
          var k = fold(o.label);
          if (seen[k] || opts.length >= MAX_OPTS) return;
          seen[k] = true;
          opts.push(o);
        };
        var subOpt = function (k) {
          return { kind: 'suburb', key: k, label: suburbIdx[k].label, hint: electoratesFor(suburbIdx[k].districts).join(', ') };
        };
        var distOpt = function (k) {
          var d = districtIdx[k];
          return { kind: 'district', key: k, label: districtName(d), hint: electoratesFor([d]).join(', ') };
        };
        var regOpt = function (k) {
          var slug = regionIdx[k];
          return { kind: 'region', key: k, label: regionName(slug), hint: 'Upper house' };
        };
        suburbKeys.filter(function (k) { return k.indexOf(q) === 0; }).forEach(function (k) { add(subOpt(k)); });
        districtKeys.filter(function (k) { return k.indexOf(q) === 0 && !seen[k]; }).forEach(function (k) {
          if (!suburbIdx[k]) add(distOpt(k));
        });
        regionKeys.filter(function (k) { return k.indexOf(q) === 0; }).forEach(function (k) { add(regOpt(k)); });
        suburbKeys.filter(function (k) { return k.indexOf(q) > 0; }).forEach(function (k) { add(subOpt(k)); });
      }
    }
    if (!opts.length) return close();
    active = -1;
    list.textContent = '';
    opts.forEach(function (o, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'htvfopt-' + i;
      li.setAttribute('data-opt', String(i));
      li.setAttribute('aria-selected', 'false');
      var name = document.createElement('span');
      name.className = 'htvf-opt';
      name.textContent = o.label;
      var hint = document.createElement('span');
      hint.className = 'htvf-opt-hint';
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
    var li = document.getElementById('htvfopt-' + active);
    input.setAttribute('aria-activedescendant', 'htvfopt-' + active);
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    var o = opts[i];
    if (!o) return;
    input.value = o.label;
    close();
    if (o.kind === 'postcode') show('postcode ' + o.key, postcodeIdx[o.key], false, true);
    else if (o.kind === 'district') show(o.label, [districtIdx[o.key]], false, true);
    else if (o.kind === 'region') showRegion(regionIdx[o.key], true);
    else show(suburbIdx[o.key].label, suburbIdx[o.key].districts, false, true);
  }

  input.addEventListener('input', function () {
    var v = (input.value || '').trim();
    if (/^\d{4}$/.test(v)) {
      close();
      lookupText(v, false);
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
      else { close(); lookupText(input.value, true); }
    } else if (e.key === 'Escape') {
      if (!list.hidden) { e.preventDefault(); close(); }
    }
  });
  input.addEventListener('blur', function () {
    window.setTimeout(close, 150);
  });
  list.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var li = e.target && e.target.closest ? e.target.closest('[data-opt]') : null;
    if (li) choose(parseInt(li.getAttribute('data-opt'), 10));
  });
  go.addEventListener('click', function () {
    close();
    lookupText(input.value, true);
  });

  chooseEl.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-choose]') : null;
    if (!b || !current) return;
    var v = b.getAttribute('data-choose');
    current.chosen = v === 'all' ? null : parseInt(v, 10);
    if (current.chosen !== null && !current.choices[current.chosen]) current.chosen = null;
    paint(false);
    var again = chooseEl.querySelector('[data-choose="' + (v === 'all' ? '0' : v) + '"]');
    if (again) again.focus();
  });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    close();
    reset('');
    input.focus();
  });

  // "Or pick a card": open that card (a district's with its region's).
  if (index) {
    index.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-htvf-pick]') : null;
      if (!a) return;
      e.preventDefault();
      var slug = a.getAttribute('data-htvf-pick');
      input.value = '';
      close();
      if (data.regions[slug]) showRegion(slug, true);
      else if (bySlug[slug]) show(districtName(bySlug[slug]), [bySlug[slug]], false, true);
    });
  }

  window.addEventListener('hashchange', function () {
    applyHash(true);
  });

  tool.hidden = false;
  if (index) index.hidden = false;
  if (!applyHash(true)) {
    reset('');
    // A browser that restored the box on Back: answer it again.
    if ((input.value || '').trim()) lookupText(input.value, false);
  }
})();
