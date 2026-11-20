/* The postcode how-to-vote pages — public/assets/js/htv-finder.js.

   The ANSWER is a real page per district (<base>/<district>/, and per region),
   rendered on the server by src/components/htv/* — both papers, the registered
   cards where we stand. This script never words or draws an answer. It does
   two small jobs:

   ON THE LANDING PAGE (src/components/HtvFinder.astro, #htvfData present) it
   SEARCHES and NAVIGATES. One box takes a 4-digit postcode, a suburb or town,
   a district name, or a mix ("Seaford 3198", "3121 Richmond", a trailing
   "VIC"). It NEVER GUESSES:
     · only an EXACT match (a district, a suburb, or a place a hand-checked note
       names) whose districts come to one district goes straight to its page;
     · a postcode or place that crosses a district boundary opens a chooser
       listing each district (a link to its page) with its suburbs and the
       VEC's address search — and so does an exact name that is both a
       district and a split suburb ("Berwick"), and a postcode and a place that
       point to different districts ("Footscray 3121");
     · a starts-with, contains or misspelt match (Damerau-Levenshtein ≤1 from
       5 letters, ≤2 from 8, only after every exact and starts-with match)
       opens the list with its first option active and asks "Did you mean …?",
       so Enter confirms a choice the visitor can see;
     · a postcode with a place that only partly matches lets the postcode speak
       ("St Kilda 3182" → the 3182 chooser and its note);
     · EXCEPT where the split changes nothing on the papers (sameRegion()):
       every district in one Legislative Council region and none with our
       Assembly candidate ("Seaford", "3198") → that REGION's page, with the
       district slugs (and the place, as a key) in its hash, so the page can
       say why — as Enter is pressed, or as one active option while typing.
   ?district=<slug> (a link shared before the pages existed) goes straight to
   that district's page; ?q=<words> (a district page's "Find another district"
   box) runs the search; #find puts the cursor in the box. The list of all 88
   districts is plain links in a native <details> (#htv-finder-list), closed
   by default and opened without a script; the script only opens it when the
   address or a link targets it.

   ON A DISTRICT OR REGION PAGE it adds Print (window.print — the print
   stylesheet makes one A4 sheet per card) and Share (navigator.share, else
   copy the page's own address); on a region page reached by that shortcut
   it shows the "why this page" note (#htvfFrom, readFrom()) — worded from
   the page's own data, never from the address.

   Combobox: the ARIA 1.2 pattern — the input owns aria-expanded and
   aria-activedescendant, up to 8 role="option"s, Arrow keys wrap, Enter
   chooses, Escape closes. Built with DOM nodes and textContent only — never an
   HTML string — so nothing typed or stored can become markup. No network. */
(function () {
  'use strict';

  /* ================================================================ core
     Pure matching over the baked data — no DOM. */
  var core = (function () {
    var MAX = 8;

    /* NFKD folds full-width digits and letters (３１２１, ＲＩＣＨＭＯＮＤ) to
       ASCII and splits accents off for the next replace to drop. */
    function fold(s) {
      var t = String(s == null ? '' : s);
      if (t.normalize) t = t.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      return t
        .toLowerCase()
        .replace(/['’`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\bmount\b/g, 'mt')
        .replace(/\bsaint\b/g, 'st');
    }
    function noState(t) {
      return t.replace(/(^|\s)(vic|victoria)$/, '').trim();
    }

    /* Damerau-Levenshtein (optimal string alignment), bailing out above max. */
    function dl(a, b, max) {
      var la = a.length, lb = b.length, i, j;
      if (Math.abs(la - lb) > max) return max + 1;
      var d = [];
      for (i = 0; i <= la; i++) { d[i] = [i]; }
      for (j = 0; j <= lb; j++) { d[0][j] = j; }
      for (i = 1; i <= la; i++) {
        var low = Infinity;
        for (j = 1; j <= lb; j++) {
          var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
          var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
          if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
            v = Math.min(v, d[i - 2][j - 2] + 1);
          }
          d[i][j] = v;
          if (v < low) low = v;
        }
        if (low > max) return max + 1;
      }
      return d[la][lb];
    }

    /* The closest a query comes to a name: the whole name, any word of it
       onwards ("east" in "ballarat east"), or a same-length prefix of either
       (so "footscar" still finds "footscray" mid-word). */
    function fuzzyDistance(q, key, tol) {
      var starts = [key];
      for (var i = 0; i < key.length; i++) if (key.charAt(i) === ' ') starts.push(key.slice(i + 1));
      var best = tol + 1;
      for (var s = 0; s < starts.length; s++) {
        var w = starts[s];
        var cands = [w];
        for (var L = q.length - 1; L <= q.length + 1; L++) if (L > 0 && L < w.length) cands.push(w.slice(0, L));
        for (var c = 0; c < cands.length; c++) {
          var dd = dl(q, cands[c], tol);
          if (dd < best) best = dd;
          if (best === 0) return 0;
        }
      }
      return best;
    }

    function union(lists) {
      var out = [];
      lists.forEach(function (l) { l.forEach(function (i) { if (out.indexOf(i) === -1) out.push(i); }); });
      return out;
    }

    function build(data) {
      var idx = { data: data, pc: Object.create(null), subs: [], subAt: Object.create(null), dists: [] };
      function sub(name, ds, code) {
        var k = fold(name);
        if (!k) return;
        var e = idx.subAt[k];
        if (!e) {
          e = idx.subAt[k] = { k: k, label: name, ds: [], code: '' };
          idx.subs.push(e);
        }
        ds.forEach(function (i) { if (e.ds.indexOf(i) === -1) e.ds.push(i); });
        if (code && !e.code) e.code = code;
      }
      data.d.forEach(function (d, i) {
        (d.p || []).forEach(function (pc) {
          var list = idx.pc[pc] || (idx.pc[pc] = []);
          if (list.indexOf(i) === -1) list.push(i);
        });
        (d.u || []).forEach(function (name) { sub(name, [i], ''); });
        idx.dists.push({ k: fold(d.n), label: d.n, ds: [i], code: '' });
      });
      // Places a hand-checked note names ("Clifton Hill" → Richmond), with the
      // postcode whose note names them, so the result can show that note.
      (data.al || []).forEach(function (a) {
        if (a && a[0] && a[1] && a[1].length) sub(a[0], a[1], a[2] || '');
      });
      idx.postcodes = Object.keys(idx.pc).sort();
      return idx;
    }

    /* Ranked options for a text query. rank: 0 exact district, 1 exact
       suburb, 2/3 starts-with, 4/5 a later word starts with it, 6 contains,
       7 a close spelling. */
    function textOptions(idx, q) {
      var out = [];
      var seen = Object.create(null);
      if (q.length < 2) return out;
      function add(kind, e, rank) {
        var key = kind + ':' + e.k;
        if (seen[key]) return;
        // A suburb whose only district has the same name as a district option
        // already offered is the same answer twice ("Richmond").
        if (kind === 'suburb' && e.ds.length === 1 && seen['district:' + fold(idx.data.d[e.ds[0]].n)]) return;
        seen[key] = true;
        out.push({ kind: kind, label: e.label, ds: e.ds.slice(), rank: rank, k: e.k, code: e.code || '' });
      }
      function pass(test, rankD, rankS) {
        idx.dists.forEach(function (e) { if (test(e.k)) add('district', e, rankD); });
        idx.subs.forEach(function (e) { if (test(e.k)) add('suburb', e, rankS); });
      }
      pass(function (k) { return k === q; }, 0, 1);
      pass(function (k) { return k.indexOf(q) === 0; }, 2, 3);
      pass(function (k) { return k.indexOf(' ' + q) > 0; }, 4, 5);
      if (q.length >= 4) pass(function (k) { return k.indexOf(q) > 0; }, 6, 6);
      var strong = out.some(function (o) { return o.rank <= 3; });
      var tol = q.length >= 8 ? 2 : q.length >= 5 ? 1 : 0;
      if (!strong && tol > 0) {
        var fz = [];
        idx.dists.forEach(function (e) { var d = fuzzyDistance(q, e.k, tol); if (d <= tol) fz.push({ kind: 'district', e: e, d: d }); });
        idx.subs.forEach(function (e) { var d = fuzzyDistance(q, e.k, tol); if (d <= tol) fz.push({ kind: 'suburb', e: e, d: d }); });
        fz.sort(function (a, b) { return a.d - b.d || (a.kind === b.kind ? 0 : a.kind === 'district' ? -1 : 1) || a.e.label.localeCompare(b.e.label); });
        fz.forEach(function (f) { add(f.kind, f.e, 7); });
      }
      out.forEach(function (o, n) { o.n = n; });
      out.sort(function (a, b) { return a.rank - b.rank || a.n - b.n; });
      return out.slice(0, MAX);
    }

    /* The exact options (rank ≤ 1) of a list, and every district they reach. */
    function exactOf(options) {
      var exact = options.filter(function (o) { return o.rank <= 1; });
      return { exact: exact, ds: union(exact.map(function (o) { return o.ds; })) };
    }

    /* Read one query. Returns { type, … }:
         empty                          nothing typed
         hint   { msg }                 keep-typing / not-vic / too-long / short
         postcode { code, ds, prefix? } a postcode (complete, or 3-digit prefix options)
         place  { label, ds, code, by, conflict, sub, options }
                                        a postcode + place text, resolved together:
                                        by 'both' (they agree), 'conflict' (they
                                        point to different districts — ds is the
                                        union), 'postcode' (the place is no exact
                                        name, so the postcode speaks), 'name' (a
                                        postcode we don't have, an exact place),
                                        'none' (options = the place's near matches)
         text   { q, options }          words */
    function read(idx, raw) {
      var typed = noState(fold(raw));
      if (!typed) return { type: 'empty' };
      if (/^\d+$/.test(typed)) {
        if (typed.charAt(0) !== '3') return { type: 'hint', msg: 'not-vic' };
        if (typed.length < 3) return { type: 'hint', msg: 'keep-typing' };
        if (typed.length === 3) {
          var opts = idx.postcodes
            .filter(function (pc) { return pc.indexOf(typed) === 0; })
            .slice(0, MAX)
            .map(function (pc) { return { kind: 'postcode', label: pc, ds: idx.pc[pc].slice(), rank: 0, k: pc, code: pc }; });
          return { type: 'postcode', code: '', prefix: typed, ds: [], options: opts };
        }
        if (typed.length > 4) return { type: 'hint', msg: 'too-long' };
        return { type: 'postcode', code: typed, ds: (idx.pc[typed] || []).slice(), options: [] };
      }
      var m = /(^|\s)(\d{4})(\s|$)/.exec(typed);
      if (m) {
        var code = m[2];
        var rest = noState(typed.replace(code, ' ').replace(/\s+/g, ' ').trim());
        var byCode = (idx.pc[code] || []).slice();
        var named = rest ? textOptions(idx, rest) : [];
        var ex = exactOf(named);
        var name = ex.exact.length ? ex.exact[0].label : '';
        var out = { type: 'place', code: code, sub: name, label: (name ? name + ' ' : '') + code, ds: [], by: 'none', options: [] };
        if (ex.exact.length && byCode.length) {
          var both = byCode.filter(function (i) { return ex.ds.indexOf(i) !== -1; });
          if (both.length) { out.ds = both; out.by = 'both'; }
          else { out.ds = union([ex.ds, byCode]); out.by = 'conflict'; }
        } else if (byCode.length) {
          out.ds = byCode; out.by = 'postcode'; out.label = code; out.sub = '';
        } else if (ex.exact.length) {
          out.ds = ex.ds; out.by = 'name';
        } else {
          out.options = named;
        }
        return out;
      }
      if (typed.length < 2) return { type: 'hint', msg: 'short' };
      return { type: 'text', q: typed, options: textOptions(idx, typed) };
    }

    /* ONE REGION, NO ASSEMBLY CANDIDATE OF OURS: the district does not
       matter. A place split between several districts that are ALL in one
       Legislative Council region, NONE of them with our Assembly candidate,
       has the same how-to-vote in every one of them — no Democrat on the
       Assembly paper on any side, and the Council paper is the region's. So
       the search goes to the REGION's page instead of asking. Returns that
       region's index, or -1 — the search then asks, as always:
         · one district (its own page) or none;
         · any of them with our Assembly candidate (they must know which
           Assembly paper they'll get);
         · districts in more than one region (the chooser says which region
           each is in);
         · a postcode and a place that disagree (`conflict`: either may be
           mistyped, so the answer may be neither);
         · a postcode whose hand-checked note says the boundary runs finer
           than the list (`code`/`codes`: 3182 — some St Kilda streets are in
           Caulfield or Brighton; the chooser keeps showing that note and the
           VEC's address search);
         · a district whose candidate flag is missing — never assumed absent. */
    function sameRegion(data, ds, basis) {
      if (!data || !data.d || !data.r || !ds || ds.length < 2) return -1;
      var b = basis || {};
      if (b.conflict) return -1;
      var codes = [].concat(b.code || [], b.codes || []);
      for (var k = 0; k < codes.length; k++) {
        if (codes[k] && data.o && data.o[codes[k]] && data.o[codes[k]].note) return -1;
      }
      var first = data.d[ds[0]];
      if (!first || !data.r[first.r]) return -1;
      for (var i = 0; i < ds.length; i++) {
        var d = data.d[ds[i]];
        if (!d || d.r !== first.r || typeof d.c !== 'number' || d.c >= 0) return -1;
      }
      return first.r;
    }
    /* A place as the region page's address carries it: "Seaford" → "seaford",
       "Narre Warren South" → "narre-warren-south", a postcode as itself. */
    function placeKey(s) {
      return fold(s).replace(/ /g, '-');
    }
    /* That region's page, with the district SLUGS — and, from the landing
       page, the place as a key the region page checks against its own data —
       in the hash. Nothing typed is ever carried: the page words its note from
       its own data, or not at all. */
    function regionHref(data, r, ds, at) {
      var base = String(data.base || '/how-to-vote').replace(/\/+$/, '');
      var h = 'from=' + ds.map(function (i) { return data.d[i].s; }).join(',');
      var key = at ? String(at) : '';
      if (/^[a-z0-9-]{1,60}$/.test(key)) h += '&at=' + key;
      return base + '/' + data.r[r].s + '-region/#' + h;
    }

    function sayList(names, word) {
      if (names.length < 2) return names[0] || '';
      return names.slice(0, -1).join(', ') + ' ' + word + ' ' + names[names.length - 1];
    }

    /* The REGION page's side of that shortcut: its note, from its OWN data
       (fd — the page's #htvfFromData: its districts' slugs, names, postcodes,
       suburbs and whether we stand an Assembly candidate, and the note's
       templates from src/lib/htv-open-ticket.ts SPLIT_NOTE) and the address's
       hash — or null, and then no note at all. The hash only SELECTS: every
       `from` slug must be one of THIS region's districts — at least two, no
       repeats, none with our Assembly candidate. `at` names the place only
       when exactly those districts list it (its name then comes from the
       page's data, never the address) and no hand-checked note covers it
       (fd.x: 3182 and the places its note names — some St Kilda streets are
       in Caulfield or Brighton, so the search never takes this road for it);
       otherwise the sentence names the districts alone. Returns
       { from, slugs, lead, same }. */
    function readFrom(fd, hash) {
      var ds = fd && fd.d;
      var h = String(hash || '').replace(/^#/, '');
      if (!ds || !ds.length || !h || h.length > 600) return null;
      var q = Object.create(null);
      var parts = h.split('&');
      for (var k = 0; k < parts.length; k++) {
        var eq = parts[k].indexOf('=');
        if (eq < 1) continue;
        var key = parts[k].slice(0, eq);
        var val;
        try { val = decodeURIComponent(parts[k].slice(eq + 1)); } catch (e) { return null; }
        if (!(key in q)) q[key] = val;
      }
      var slugs = String(q.from || '').toLowerCase().split(',');
      var picked = [];
      for (var s = 0; s < slugs.length; s++) {
        var slug = slugs[s].trim();
        var j = -1;
        for (var n = 0; n < ds.length; n++) if (ds[n] && ds[n].s === slug) j = n;
        if (j < 0 || picked.indexOf(j) !== -1 || ds[j].c !== false) return null;
        picked.push(j);
      }
      if (picked.length < 2) return null;
      picked.sort(function (a, b) { return a - b; });
      var names = picked.map(function (i) { return String(ds[i].n || ''); });
      var at = String(q.at || '').toLowerCase();
      var place = '';
      var noted = (fd.x || []).some(function (v) { return placeKey(String(v)) === at; });
      if (!noted && /^[a-z0-9-]{1,60}$/.test(at)) {
        var isCode = /^\d{4}$/.test(at);
        var reach = [];
        var label = '';
        ds.forEach(function (d, i) {
          var hit = isCode
            ? (d.p || []).indexOf(at) !== -1
            : (d.u || []).some(function (u) {
                if (placeKey(u) !== at) return false;
                if (!label) label = String(u);
                return true;
              });
          if (hit) reach.push(i);
        });
        var exact = reach.length === picked.length && reach.every(function (i) { return picked.indexOf(i) !== -1; });
        if (exact) place = isCode ? String(fd.postcode || '').split('%s').join(at) : label;
      }
      var lead = place
        ? String(fd.lead || '').split('%d').join(sayList(names, 'and')).split('%p').join(place)
        : String(fd.leadAny || '').split('%d').join(sayList(names, 'or'));
      var same = picked.length === 2 ? String(fd.same2 || '') : String(fd.sameN || '');
      if (!lead || !same || lead.indexOf('%') !== -1) return null;
      return { from: picked, slugs: picked.map(function (i) { return ds[i].s; }), lead: lead, same: same };
    }

    return {
      fold: fold,
      dl: dl,
      build: build,
      read: read,
      textOptions: textOptions,
      union: union,
      exactOf: exactOf,
      sameRegion: sameRegion,
      placeKey: placeKey,
      regionHref: regionHref,
      sayList: sayList,
      readFrom: readFrom,
    };
  })();

  // A test hook, inert unless a unit test defines it before this file runs.
  if (typeof window !== 'undefined' && typeof window.__HTV_FINDER_TEST__ === 'function') window.__HTV_FINDER_TEST__(core);
  if (typeof document === 'undefined') return;
  // The SAME search for family mode (/assets/js/htv-family.js, loaded after
  // this file on /how-to-vote/family/ — which has no #htvFinder, so this
  // script does nothing else there).
  window.HtvSearch = core;

  /* ================================================================== page */
  var root = document.getElementById('htvFinder');
  if (!root) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var behavior = reduceMotion ? 'auto' : 'smooth';
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ------------------------------------------- a district or region page
     The answer is in the page already (server-rendered). The script adds
     Print and Share, which need it, and nothing else. */
  var printBtn = $('htvfPrint');
  var shareBtn = $('htvfShare');
  var shareStatus = $('htvfShareStatus');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  function copied(ok, url) {
    if (!shareStatus) return;
    shareStatus.textContent = ok ? 'Link copied — paste it into a message to share this how-to-vote.' : 'Copy this link to share: ' + url;
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var url = location.origin + location.pathname;
      var text = root.getAttribute('data-share-text') || document.title;
      if (navigator.share) {
        navigator.share({ title: document.title, text: text, url: url }).catch(function () { /* cancelled */ });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { copied(true, url); }, function () { copied(false, url); });
      } else {
        copied(false, url);
      }
    });
  }

  /* ----------------------- a region page, reached by the search's shortcut
     #from=<district>,<district>[&at=<place>]: a short note saying why this
     is the page, not a district's. core.readFrom() words it from the page's
     OWN data (#htvfFromData) or not at all; written with textContent. */
  var fromEl = $('htvfFrom');
  var fromJson = $('htvfFromData');
  if (fromEl && fromJson && root.getAttribute('data-kind') === 'region') {
    var fromData = null;
    try { fromData = JSON.parse(fromJson.textContent || '{}'); } catch (e) { fromData = null; }
    var leadEl = $('htvfFromLead');
    var sameEl = $('htvfFromSame');
    var fromLive = $('htvfFromLive');
    var fromTimer = 0;
    var showFrom = function () {
      var note = fromData && leadEl && sameEl ? core.readFrom(fromData, location.hash) : null;
      // Already saying exactly this (Back to the same address): leave it, and
      // what the live region said, as they are.
      if (note && !fromEl.hidden && fromEl.getAttribute('data-from') === note.slugs.join(',') && leadEl.textContent === note.lead) return;
      window.clearTimeout(fromTimer);
      if (!note) {
        fromEl.hidden = true;
        fromEl.removeAttribute('data-from');
        if (leadEl) leadEl.textContent = '';
        if (sameEl) sameEl.textContent = '';
        if (fromLive) fromLive.textContent = '';
        return;
      }
      leadEl.textContent = note.lead;
      sameEl.textContent = note.same;
      fromEl.setAttribute('data-from', note.slugs.join(','));
      fromEl.hidden = false;
      // Screen readers: the same two sentences once the page has settled — a
      // polite live region already in the page, filled after load.
      if (fromLive) {
        fromTimer = window.setTimeout(function () {
          fromLive.textContent = note.lead + ' ' + note.same;
        }, 700);
      }
    };
    showFrom();
    // A hash changed in place to another #from= (a link to one, or Back) is
    // read again. Any other fragment is a jump within the page — the "Skip to
    // main content" link (#content) — not a new address: the note stays, and
    // so does what the live region said.
    window.addEventListener('hashchange', function () {
      if (/(^#|&)from=/.test(location.hash)) showFrom();
    });
  }

  /* ------------------------------------- the landing page's district list
     Every district as a plain link, inside a native <details>
     (#htv-finder-list) that starts closed and opens with no script at all.
     Arriving at #htv-finder-list (a district page's "All 88 districts"), or
     following a link to it here (the search box's "Browse all" — the address
     may already end in that hash, so no hashchange fires), opens it. */
  var browse = $('htv-finder-list');
  if (browse && browse.tagName === 'DETAILS') {
    var openBrowse = function () { browse.open = true; };
    if (location.hash === '#htv-finder-list') openBrowse();
    window.addEventListener('hashchange', function () {
      if (location.hash === '#htv-finder-list') openBrowse();
    });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href$="#htv-finder-list"]') : null;
      if (a) openBrowse();
    });
  }

  /* --------------------------------------------------- the landing page */
  var dataEl = $('htvfData');
  var data = null;
  if (dataEl) {
    try {
      data = JSON.parse(dataEl.textContent || '{}');
    } catch (e) {
      data = null;
    }
  }
  if (!data || !data.d || !data.d.length || !data.r) {
    root.classList.add('is-ready');
    return;
  }
  var BASE = String(data.base || '/how-to-vote').replace(/\/+$/, '');
  var pageOf = function (i) { return BASE + '/' + data.d[i].s + '/'; };

  /* An old shared link (?district=<slug>) — the answer is that district's own
     page now. Replace, so Back does not bounce through here. */
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
  var want = params ? String(params.get('district') || '').trim().toLowerCase() : '';
  if (want) {
    for (var w = 0; w < data.d.length; w++) {
      if (data.d[w].s === want) {
        location.replace(pageOf(w));
        return;
      }
    }
  }

  var idx = core.build(data);
  var form = $('htvfForm');
  var input = $('htvfInput');
  var list = $('htvfList');
  var statusEl = $('htvfStatus');
  var chooser = $('htvfChooser');
  var chooserQ = $('htvfChooserQ');
  var chooserOpts = $('htvfChooserOpts');
  var chooserNote = $('htvfChooserNote');
  if (!form || !input || !list || !statusEl || !chooser || !chooserQ || !chooserOpts) {
    root.classList.add('is-ready');
    return;
  }
  var VEC = data.vec || 'https://www.vec.vic.gov.au/electoral-boundaries/address-search';

  // A visually hidden polite live region for counts; the visible status line
  // carries messages a sighted visitor needs too.
  var live = document.createElement('p');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  form.appendChild(live);
  var lastLive = '';
  function announce(t) {
    if (t === lastLive) return;
    lastLive = t;
    live.textContent = t;
  }

  function vecLink(text) {
    var a = el('a', null, text);
    a.href = VEC;
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(el('span', 'visually-hidden', ' (opens in a new tab)'));
    return a;
  }
  function districtName(i) { return data.d[i].n + ' District'; }
  function regionName(i) { var r = data.r[data.d[i].r]; return r ? r.n + ' Region' : ''; }
  function sayOr(names) {
    if (names.length < 2) return names[0] || '';
    if (names.length === 2) return names[0] + ' or ' + names[1];
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }
  function note(code) { return code && data.o && data.o[code] ? data.o[code] : null; }

  /* ---------------------------------------------------------- the status */
  function say(text, withVec) {
    statusEl.textContent = '';
    if (!text) return;
    statusEl.appendChild(document.createTextNode(text));
    if (withVec) {
      statusEl.appendChild(document.createTextNode(' '));
      statusEl.appendChild(vecLink('Look up your address with the VEC'));
      statusEl.appendChild(document.createTextNode('.'));
    }
  }
  var HINTS = {
    'not-vic': 'Victorian postcodes start with 3 — try yours again, or type your suburb.',
    'keep-typing': 'Keep typing — postcodes have four digits.',
    'too-long': 'A postcode has four digits.',
    short: 'Keep typing your suburb, town or district.',
  };

  /* ------------------------------------------------------------- listbox */
  var opts = [];
  var active = -1;

  function closeList() {
    opts = [];
    active = -1;
    list.textContent = '';
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  /* A complete postcode answers with its DISTRICT as the option's name — the
     thing the visitor is looking for — and the postcode in the line under it. */
  function optionName(o) {
    if (o.kind === 'region') return regionName(o.ds[0]);
    return o.full && o.ds.length === 1 ? districtName(o.ds[0]) : o.label;
  }
  function optionMeta(o) {
    if (o.kind === 'region') {
      return (o.lead ? o.lead + ' · ' : '') + sayOr(o.ds.map(function (i) { return data.d[i].n; })) + ' District — the same how-to-vote ' + (o.ds.length === 2 ? 'either way' : 'in each');
    }
    if (o.ds.length > 1 && core.sameRegion(data, o.ds, { code: o.code }) >= 0) {
      return 'Split: ' + sayOr(o.ds.map(function (i) { return data.d[i].n; })) + ' District · ' + regionName(o.ds[0]);
    }
    if (o.full && o.ds.length === 1) {
      var loc = data.o && data.o[o.label] && data.o[o.label].locality;
      return 'Postcode ' + o.label + (loc ? ' (' + loc + ')' : '') + ' · ' + regionName(o.ds[0]);
    }
    if (o.kind === 'district') {
      return 'District · ' + regionName(o.ds[0]);
    }
    var names = o.ds.map(function (i) { return data.d[i].n; });
    if (o.ds.length === 1) return (o.kind === 'postcode' ? '' : 'In ') + districtName(o.ds[0]) + ' · ' + regionName(o.ds[0]);
    return 'Split: ' + sayOr(names) + ' District';
  }

  /* caption: a line at the top of the list ("Did you mean …?") — shown, not
     an option; screen readers hear the same words from the live region. */
  function openList(options, preselect, caption) {
    opts = options;
    list.textContent = '';
    if (!opts.length) return closeList();
    if (caption) {
      var cap = el('li', 'htvf-opt-cap', caption);
      cap.setAttribute('role', 'presentation');
      cap.setAttribute('aria-hidden', 'true');
      cap.setAttribute('data-testid', 'htv-finder-didyoumean');
      list.appendChild(cap);
    }
    opts.forEach(function (o, i) {
      var li = el('li', 'htvf-opt');
      li.setAttribute('role', 'option');
      li.id = 'htvf-opt-' + i;
      li.setAttribute('data-opt', String(i));
      li.setAttribute('aria-selected', 'false');
      li.appendChild(el('span', 'htvf-opt-name', optionName(o)));
      li.appendChild(el('span', 'htvf-opt-meta', optionMeta(o)));
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (preselect) setActive(0);
  }

  function setActive(i) {
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    Array.prototype.forEach.call(list.querySelectorAll('[role="option"]'), function (li, n) {
      li.setAttribute('aria-selected', n === active ? 'true' : 'false');
    });
    input.setAttribute('aria-activedescendant', 'htvf-opt-' + active);
    var li = $('htvf-opt-' + active);
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  /* ------------------------------------------------------------- chooser
     Each choice is a real link to that district's page. */
  function closeChooser() {
    chooser.hidden = true;
    chooserOpts.textContent = '';
    if (chooserNote) { chooserNote.hidden = true; chooserNote.textContent = ''; }
  }

  /* basis = { kind: 'postcode'|'suburb'|'place'|'district'|'fuzzy', label, code, sub, conflict } */
  function showChooser(ds, basis) {
    closeList();
    chooserOpts.textContent = '';
    var sameRegion = ds.every(function (i) { return data.d[i].r === data.d[ds[0]].r; });
    if (basis.conflict) {
      chooserQ.textContent =
        '“' + basis.sub + '” and postcode ' + basis.code + ' point to different districts' +
        (sameRegion ? '' : ' in different regions') + '. Which one is yours?';
    } else {
      var lead = basis.kind === 'postcode' ? 'Postcode ' + basis.code : basis.label;
      chooserQ.textContent =
        lead + ' is split between ' + ds.length + ' districts' +
        (sameRegion ? '' : ' in different regions') + '. Which one is yours?';
    }
    var typedSub = basis.kind === 'suburb' || basis.kind === 'place' ? core.fold(basis.sub || '') : '';
    ds.forEach(function (i) {
      var d = data.d[i];
      var a = el('a', 'htvf-choice');
      a.href = pageOf(i);
      a.setAttribute('data-pick', String(i));
      a.appendChild(el('span', 'htvf-choice-name', districtName(i)));
      a.appendChild(el('span', 'htvf-choice-meta', regionName(i) + (d.c >= 0 ? ' · Democrat candidate' : '')));
      var subs = (d.u || []).slice();
      if (typedSub) {
        subs.sort(function (x, y) { return (core.fold(y) === typedSub) - (core.fold(x) === typedSub); });
      }
      var shown = subs.slice(0, 6);
      if (shown.length) {
        a.appendChild(el('span', 'htvf-choice-subs', 'Includes ' + shown.join(', ') + (subs.length > shown.length ? ' and more' : '')));
      }
      chooserOpts.appendChild(a);
    });
    var o = note(basis.code);
    if (chooserNote) {
      chooserNote.textContent = o && o.note ? o.note : '';
      chooserNote.hidden = !(o && o.note);
    }
    chooser.hidden = false;
    say('');
    announce(chooserQ.textContent + ' Choose below.');
    // The chooser opens under the box: bring it on screen if it isn't.
    var rb = chooser.getBoundingClientRect();
    if (rb.bottom > (window.innerHeight || document.documentElement.clientHeight)) {
      chooser.scrollIntoView({ block: 'nearest', behavior: behavior });
    }
  }

  /* ---------------------------------------------------- going to a page */
  function go(i) {
    if (!data.d[i]) return;
    closeList();
    closeChooser();
    input.value = data.d[i].n;
    say('Opening the how-to-vote for ' + districtName(i) + '…');
    location.assign(pageOf(i));
  }

  /* A split that changes nothing on the papers (core.sameRegion): the
     region's page, with the districts (and the place, as a key) in its hash
     so it can say why. */
  function placeOfBasis(basis) {
    if (basis.kind === 'postcode') return { lead: 'Postcode ' + basis.code, at: basis.code };
    var name = basis.sub || basis.label || '';
    return { lead: name, at: name ? core.placeKey(name) : '' };
  }
  function splitWords(ds, basis) {
    var names = ds.map(function (i) { return data.d[i].n; });
    var p = placeOfBasis(basis);
    return (p.lead ? p.lead + ' is split between ' : 'That is split between ') + core.sayList(names, 'and') + ' districts, and ' +
      (names.length === 2 ? 'neither has' : 'none of them has') + ' an Australian Democrats candidate on the Legislative Assembly paper';
  }
  function goRegion(r, ds, basis) {
    if (!data.r[r]) return;
    closeList();
    closeChooser();
    var text = 'Going to your Legislative Council how-to-vote — ' + splitWords(ds, basis) + '…';
    say(text);
    location.assign(core.regionHref(data, r, ds, placeOfBasis(basis).at));
  }
  /* Several districts: the region's page where they share one how-to-vote,
     else the chooser. */
  function splitAnswer(ds, basis) {
    var r = core.sameRegion(data, ds, basis);
    if (r >= 0) return goRegion(r, ds, basis);
    showChooser(ds, basis);
  }
  /* …as the visitor types: one option, the region, active — Enter takes it. */
  function offerRegion(r, ds, basis) {
    var p = placeOfBasis(basis);
    openList([{ kind: 'region', label: regionName(ds[0]), ds: ds.slice(), rank: 0, k: '', code: basis.code || '', lead: p.lead, basis: basis, r: r }], true);
    announce(splitWords(ds, basis) + '. Press Enter to see your Legislative Council how-to-vote.');
  }

  /* -------------------------------------------------------- the answers */
  function basisOf(o, typed) {
    if (o.basis) return o.basis;
    if (o.kind === 'postcode') return { kind: 'postcode', code: o.label, ds: o.ds };
    if (o.kind === 'district') return { kind: o.rank === 7 ? 'fuzzy' : 'district', label: o.rank === 7 ? typed : o.label, ds: o.ds };
    return { kind: o.rank === 7 ? 'fuzzy' : 'suburb', label: o.rank === 7 ? typed : o.label, sub: o.label, ds: o.ds, code: o.code || '' };
  }
  function pickOption(o, typed) {
    if (!o) return;
    if (o.kind === 'region') return goRegion(o.r, o.ds, o.basis);
    var basis = basisOf(o, typed);
    if (o.ds.length === 1) return go(o.ds[0]);
    if (basis.kind === 'fuzzy') basis = { kind: 'suburb', label: o.label, sub: o.label, ds: o.ds, code: o.code || '' };
    splitAnswer(o.ds, basis);
  }

  /* A place + postcode as one option or a chooser. */
  function placeBasis(r) {
    if (r.by === 'postcode') return { kind: 'postcode', code: r.code, ds: r.ds };
    return { kind: 'place', label: r.label, code: r.code, sub: r.sub, ds: r.ds, conflict: r.by === 'conflict' };
  }
  function placeAnswer(r, commitNow) {
    var basis = placeBasis(r);
    if (r.ds.length > 1 || basis.conflict) {
      var sr = core.sameRegion(data, r.ds, basis);
      if (sr < 0) return showChooser(r.ds, basis);
      return commitNow ? goRegion(sr, r.ds, basis) : offerRegion(sr, r.ds, basis);
    }
    if (commitNow) return go(r.ds[0]);
    var opt = { kind: 'district', label: data.d[r.ds[0]].n, ds: r.ds, rank: 0, k: '', basis: basis };
    if (basis.kind === 'postcode') { opt = { kind: 'postcode', label: r.code, ds: r.ds, rank: 0, k: r.code, full: true, basis: basis }; }
    openList([opt], true);
    announce((basis.kind === 'postcode' ? 'Postcode ' + r.code : r.label) + ' is in ' + districtName(r.ds[0]) + '. Press Enter to see your how-to-vote.');
  }

  /* No exact match: show the list with its first option active, and ask. */
  function didYouMean(options) {
    var first = optionName(options[0]);
    say('');
    openList(options, true, 'Did you mean ' + first + '? Press Enter to choose it, or pick another.');
    announce('No exact match. Did you mean ' + first + '? ' + options.length + (options.length === 1 ? ' option' : ' options') + '. Press Enter to choose it, or use the arrow keys.');
  }

  /* As the visitor types: suggestions, a split-postcode chooser, or a hint. */
  function onType() {
    var raw = input.value || '';
    closeChooser();
    var r = core.read(idx, raw);
    if (r.type === 'empty') { closeList(); say(''); announce(''); return; }
    if (r.type === 'hint') {
      closeList();
      say(r.msg === 'short' ? '' : HINTS[r.msg]);
      return;
    }
    say('');
    if (r.type === 'postcode') {
      if (r.prefix) {
        openList(r.options, false);
        announce(r.options.length ? r.options.length + ' postcodes start with ' + r.prefix + '.' : '');
        if (!r.options.length) say(HINTS['keep-typing']);
        return;
      }
      if (!r.ds.length) {
        closeList();
        say('We don’t have postcode ' + r.code + ' in our list. Try your suburb or town —', false);
        statusEl.appendChild(document.createTextNode(' or '));
        statusEl.appendChild(vecLink('look up your address with the VEC'));
        statusEl.appendChild(document.createTextNode('.'));
        return;
      }
      if (r.ds.length > 1) {
        var pb = { kind: 'postcode', code: r.code, ds: r.ds };
        var sr = core.sameRegion(data, r.ds, pb);
        return sr >= 0 ? offerRegion(sr, r.ds, pb) : showChooser(r.ds, pb);
      }
      openList([{ kind: 'postcode', label: r.code, ds: r.ds, rank: 0, k: r.code, full: true, code: r.code }], true);
      announce('Postcode ' + r.code + ' is in ' + districtName(r.ds[0]) + '. Press Enter to see your how-to-vote.');
      return;
    }
    if (r.type === 'place') {
      if (r.ds.length) return placeAnswer(r, false);
      if (r.options.length) { openList(r.options, false); return; }
      closeList();
      return;
    }
    openList(r.options, false);
    var fuzzy = r.options.length && r.options.every(function (o) { return o.rank === 7; });
    announce(
      r.options.length
        ? (fuzzy ? 'No exact match. ' : '') + r.options.length + (r.options.length === 1 ? ' place matches' : ' places match') + '. Use the arrow keys to choose.'
        : ''
    );
  }

  /* Enter or Find: answer the whole query — or ask, never guess. */
  function commit() {
    var raw = input.value || '';
    if (!list.hidden && active >= 0 && opts[active]) return pickOption(opts[active], core.fold(raw));
    var r = core.read(idx, raw);
    if (r.type === 'empty') {
      say('Type your postcode, suburb or district.');
      return;
    }
    if (r.type === 'hint') {
      closeList();
      say(r.msg === 'short' ? HINTS.short : HINTS[r.msg]);
      return;
    }
    if (r.type === 'postcode') {
      if (r.prefix) { closeList(); say(HINTS['keep-typing']); return; }
      if (!r.ds.length) return onType();
      if (r.ds.length === 1) return go(r.ds[0]);
      return splitAnswer(r.ds, { kind: 'postcode', code: r.code, ds: r.ds });
    }
    if (r.type === 'place') {
      if (r.ds.length) return placeAnswer(r, true);
      if (r.options.length) return didYouMean(r.options);
      return notFound(raw);
    }
    var options = r.options;
    if (!options.length) return notFound(raw);
    var ex = core.exactOf(options);
    if (ex.exact.length) {
      // Every exact answer counts: a district that is also a split suburb
      // ("Berwick") reaches two districts, so it asks.
      if (ex.ds.length === 1) return pickOption(ex.exact[0], r.q);
      var lead = ex.exact[0];
      return splitAnswer(ex.ds, {
        kind: 'suburb',
        label: lead.label,
        sub: lead.label,
        ds: ex.ds,
        code: lead.code || '',
        codes: ex.exact.map(function (o) { return o.code || ''; }),
      });
    }
    didYouMean(options);
  }

  function notFound(raw) {
    closeList();
    closeChooser();
    statusEl.textContent = '';
    statusEl.appendChild(document.createTextNode('We couldn’t find “' + String(raw).trim() + '”. Try your postcode, or the name of your suburb or town — or '));
    statusEl.appendChild(vecLink('look up your address with the VEC'));
    statusEl.appendChild(document.createTextNode('.'));
  }

  /* --------------------------------------------------------------- events */
  input.addEventListener('input', onType);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'Down') {
      e.preventDefault();
      if (list.hidden) onType();
      if (!list.hidden) setActive(active + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'Up') {
      e.preventDefault();
      if (!list.hidden) setActive(active < 0 ? opts.length - 1 : active - 1);
    } else if (e.key === 'Escape' || e.key === 'Esc') {
      if (!list.hidden) { e.preventDefault(); closeList(); }
      else if (input.value) { e.preventDefault(); input.value = ''; closeChooser(); say(''); }
    } else if (e.key === 'Tab') {
      closeList();
    }
  });
  input.addEventListener('blur', function () { window.setTimeout(closeList, 150); });
  // On a touch screen (its keyboard is about to cover the lower half), or
  // where the suggestions would open below the fold, bring the box to the top
  // of the screen as it takes focus. html's scroll-padding-top clears the
  // sticky header.
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  input.addEventListener('focus', function () {
    var room = (window.innerHeight || document.documentElement.clientHeight) - input.getBoundingClientRect().bottom;
    if ((coarse && coarse.matches) || room < 300) form.scrollIntoView({ block: 'start', behavior: behavior });
  });
  // mousedown, not click: focus stays in the input, so blur never closes the
  // list before the choice lands.
  list.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var li = e.target && e.target.closest ? e.target.closest('[data-opt]') : null;
    if (li) pickOption(opts[parseInt(li.getAttribute('data-opt'), 10)], core.fold(input.value));
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    commit();
  });

  /* ------------------------------------------------- arriving with a job */
  if (want) {
    // ?district= that matches nothing (a match left the page above).
    say('That link doesn’t match a district — search below.');
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ }
  } else if (params && params.get('q')) {
    // A district page's "Find another district" box: run the search here.
    input.value = String(params.get('q')).slice(0, 60);
    try { history.replaceState(null, '', location.pathname + '#find'); } catch (e) { /* ignore */ }
    commit();
  } else if (location.hash === '#find') {
    // "Find another district": straight to the box — once the browser has
    // gone to #find. Chromium clears focus when it scrolls to a fragment
    // target that cannot take focus itself, so focusing any earlier is lost.
    // Never takes focus from something the visitor has already moved to.
    var toBox = function () {
      window.requestAnimationFrame(function () {
        window.setTimeout(function () {
          var a = document.activeElement;
          if (!a || a === document.body || a === document.documentElement) input.focus({ preventScroll: true });
        }, 0);
      });
    };
    if (document.readyState === 'complete') toBox();
    else window.addEventListener('load', toBox);
  }
  root.classList.add('is-ready');
})();
