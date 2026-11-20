/* Family mode — /how-to-vote/family/ (src/components/htv/HtvFamilyPage.astro;
   ADR-97, stage 2). Loaded from that page's scripts slot AFTER
   /assets/js/htv-finder.js, whose search (window.HtvSearch — the landing
   page's own matcher, never a copy) finds where each person lives.

   It builds a list of people — a name (optional, up to 24 characters) and
   their district (or, where their place is split between districts of one
   region none of which has our Assembly candidate, that REGION — the search's
   own shortcut, sameRegion(): their how-to-vote is the same on every side) —
   and for each one offers THEIR district's page to share
   (navigator.share, else copy; WhatsApp, text and email links), plus one
   message with every place's link, and a printed pack (a cover saying who's
   who, then the party's card for each place once — the cards are already in
   the page, server-rendered; this script only picks which ones print).

   NAMES NEVER LEAVE THE DEVICE: kept in localStorage (try/catch — the page
   works without it), written with textContent only, and NEVER put in a link,
   a message or anything sent anywhere. Links and messages only ever name
   districts. No ballot instruction is worded here: the words come from the
   page's data (src/lib/htv-open-ticket.ts FAMILY). Built with DOM nodes only. */
(function () {
  'use strict';
  var root = document.getElementById('htvFamily');
  var dataEl = document.getElementById('htvFamData');
  var core = window.HtvSearch;
  if (!root || !dataEl || !core) return;
  var data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    return;
  }
  if (!data || !data.d || !data.r || !data.fd || !data.fr) return;
  var C = data.copy || {};
  var BASE = String(data.base || '/how-to-vote').replace(/\/+$/, '');
  // Links name the site this page is served from — as the custom card's and
  // the district pages' Share do — so a link sent from the preview site opens
  // a page that exists there (the live site's address on the live site).
  var SITE = String(location.origin).replace(/\/+$/, '');
  var KEY = 'htv-family-v1';
  var MAX = 20;
  var $ = function (id) { return document.getElementById(id); };
  var fill = function (t, v) { return String(t || '').split('%s').join(v); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ------------------------------------------------------------- places
     A place is a district (its slug) or a region page ("<slug>-region",
     added from a region's page before the district is known). */
  function placeOf(slug) {
    var s = String(slug || '').toLowerCase();
    for (var i = 0; i < data.d.length; i++) if (data.d[i].s === s) return { kind: 'd', i: i, s: s };
    for (var j = 0; j < data.fr.length; j++) if (data.fr[j].s === s) return { kind: 'r', i: j, s: s };
    return null;
  }
  function regionIndexOf(pl) { return pl.kind === 'd' ? data.d[pl.i].r : pl.i; }
  function placeName(pl) { return pl.kind === 'd' ? data.d[pl.i].n + ' District' : data.fr[pl.i].label; }
  /* A region place added by the shortcut keeps its districts (slugs only):
     each one of that region's, at least two, no repeats, none with our
     Assembly candidate — re-checked against the data every time, else none. */
  function fromOf(pl, f) {
    if (!pl || pl.kind !== 'r' || !Array.isArray(f) || f.length < 2 || f.length > 10) return null;
    var out = [];
    for (var k = 0; k < f.length; k++) {
      var j = -1;
      for (var i = 0; i < data.d.length; i++) if (data.d[i].s === f[k]) j = i;
      if (j < 0 || out.indexOf(j) !== -1 || data.d[j].r !== pl.i || typeof data.d[j].c !== 'number' || data.d[j].c >= 0) return null;
      out.push(j);
    }
    return out.sort(function (a, b) { return a - b; });
  }
  function sayOr(ds) {
    var n = ds.map(function (i) { return data.d[i].n; });
    if (n.length < 2) return n[0] || '';
    return n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1];
  }
  /* The page's link: a shortcut region carries its districts in the hash, so
     the region page can say why it is the one (districts only — never a name
     or a place someone typed). */
  function placeUrl(pl, from) {
    return SITE + BASE + '/' + pl.s + '/' + (from ? '#from=' + from.map(function (i) { return data.d[i].s; }).join(',') : '');
  }

  /* ------------------------------------------------------------ storage */
  function clean(name) {
    return String(name == null ? '' : name)
      .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24);
  }
  function load() {
    var list = [];
    try {
      var raw = window.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        arr.forEach(function (x) {
          if (x && typeof x.n === 'string' && typeof x.p === 'string' && placeOf(x.p) && list.length < MAX) {
            var pl = placeOf(x.p);
            var item = { n: clean(x.n) || String(C.unnamed || '').replace('%n', String(list.length + 1)), p: pl.s };
            var from = fromOf(pl, x.f);
            if (from) item.f = from.map(function (i) { return data.d[i].s; });
            list.push(item);
          }
        });
      }
    } catch (e) {
      /* storage blocked or malformed: start empty */
    }
    return list;
  }
  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(people));
    } catch (e) {
      /* storage blocked: the list lasts as long as the page */
    }
  }
  var people = load();

  /* ?add=<place> (a district or region page's "Send them their how-to-vote")
     adds that place as "Me" — once — then leaves the address bar clean. */
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
  var addSlug = params ? params.get('add') : null;
  if (addSlug) {
    var pl0 = placeOf(addSlug);
    if (pl0 && !people.some(function (p) { return p.p === pl0.s && p.n === 'Me'; }) && people.length < MAX) {
      people.unshift({ n: 'Me', p: pl0.s });
      save();
    }
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------- status */
  var statusEl = $('htvfamStatus');
  function say(text, withVec) {
    if (!statusEl) return;
    statusEl.textContent = '';
    if (!text) return;
    statusEl.appendChild(document.createTextNode(text));
    if (withVec && data.vec) {
      statusEl.appendChild(document.createTextNode(' '));
      var a = el('a', null, 'Look up their address with the VEC');
      a.href = data.vec;
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('span', 'visually-hidden', ' (opens in a new tab)'));
      statusEl.appendChild(a);
      statusEl.appendChild(document.createTextNode('.'));
    }
  }

  /* --------------------------------------------- where they live (search)
     The landing page's matcher; every answer is offered as a list to choose
     from — a split postcode or suburb lists each side, nothing is ever
     guessed — EXCEPT a split that changes nothing on their papers
     (core.sameRegion: every side in one region, none with our Assembly
     candidate), which is offered as that region, alone. Options are
     { d: district } or { r: region, f: [its districts] }. */
  var idx = core.build(data);
  var form = $('htvfamForm');
  var nameIn = $('htvfamName');
  var whereIn = $('htvfamWhere');
  var list = $('htvfamOpts');
  if (!form || !nameIn || !whereIn || !list) return;
  var opts = [];
  var active = -1;
  var picked = null;
  var split = false;

  function districtsFor(raw) {
    var r = core.read(idx, raw);
    var ds = [];
    var exact = [];
    var basis = {};
    split = false;
    if (r.type === 'postcode') {
      ds = r.prefix ? [] : r.ds;
      exact = ds;
      basis = { code: r.code };
      split = ds.length > 1;
    } else if (r.type === 'place') {
      ds = r.ds.length ? r.ds : core.union((r.options || []).map(function (o) { return o.ds; }));
      exact = r.ds;
      basis = { code: r.code, conflict: r.by === 'conflict' };
      split = r.ds.length > 1;
    } else if (r.type === 'text') {
      var ex = core.exactOf(r.options || []);
      ds = core.union((r.options || []).map(function (o) { return o.ds; }));
      exact = ex.ds;
      basis = { codes: ex.exact.map(function (o) { return o.code || ''; }) };
      split = ex.ds.length > 1;
    }
    var sr = split && core.sameRegion ? core.sameRegion(data, exact, basis) : -1;
    var items = ds.map(function (i) { return { d: i }; });
    if (sr >= 0 && data.fr[sr]) {
      items = [{ r: sr, f: exact.slice().sort(function (a, b) { return a - b; }) }].concat(
        ds.filter(function (i) { return exact.indexOf(i) === -1; }).map(function (i) { return { d: i }; })
      );
    } else sr = -1;
    return { r: r, ds: ds, items: items.slice(0, 10), region: sr >= 0 };
  }
  function closeList() {
    opts = [];
    active = -1;
    list.textContent = '';
    list.hidden = true;
    whereIn.setAttribute('aria-expanded', 'false');
    whereIn.removeAttribute('aria-activedescendant');
  }
  function setActive(k) {
    if (!opts.length) return;
    active = (k + opts.length) % opts.length;
    Array.prototype.forEach.call(list.querySelectorAll('[role="option"]'), function (li, n) {
      li.setAttribute('aria-selected', n === active ? 'true' : 'false');
    });
    whereIn.setAttribute('aria-activedescendant', 'htvfam-opt-' + active);
  }
  function openList(items) {
    opts = items;
    list.textContent = '';
    if (!items.length) return closeList();
    items.forEach(function (it, n) {
      var li = el('li', 'htvfam-opt');
      li.id = 'htvfam-opt-' + n;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.setAttribute('data-opt', String(n));
      if (it.f) {
        li.setAttribute('data-region', data.fr[it.r].s);
        li.appendChild(el('span', 'htvfam-opt-name', data.fr[it.r].label));
        li.appendChild(el('span', 'htvfam-opt-meta', fill(C.regionOpt, sayOr(it.f))));
      } else {
        var d = data.d[it.d];
        li.appendChild(el('span', 'htvfam-opt-name', d.n + ' District'));
        var subs = (d.u || []).slice(0, 4).join(', ');
        li.appendChild(el('span', 'htvfam-opt-meta', data.r[d.r].n + ' Region' + (subs ? ' · ' + subs : '')));
      }
      list.appendChild(li);
    });
    list.hidden = false;
    whereIn.setAttribute('aria-expanded', 'true');
    active = -1;
    if (items.length === 1) setActive(0);
  }
  function choose(it) {
    if (!it) return;
    picked = it;
    whereIn.value = it.f ? data.fr[it.r].label : data.d[it.d].n + ' District';
    closeList();
    say('');
  }
  // Leaving the box closes its list a moment later, so a click on an option
  // still lands; back in the box (or typing) within that moment, it stays open.
  var blurTimer = 0;
  whereIn.addEventListener('focus', function () { window.clearTimeout(blurTimer); });
  whereIn.addEventListener('input', function () {
    window.clearTimeout(blurTimer);
    picked = null;
    var got = districtsFor(whereIn.value);
    openList(got.items);
    if (got.region) say(C.regionHint);
    else if (got.ds.length) say(split ? C.splitHint : C.chooseHint, split);
    // Still typing a postcode ("312…"): nothing to say yet, as the landing
    // page's search — never "No district matches that" mid-postcode.
    else if (got.r.type === 'empty' || got.r.type === 'hint' || (got.r.type === 'postcode' && got.r.prefix)) say('');
    else say(C.noMatch, true);
  });
  whereIn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.hidden) openList(districtsFor(whereIn.value).items);
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active < 0 ? opts.length - 1 : active - 1);
    } else if (e.key === 'Enter' && !list.hidden && active >= 0) {
      e.preventDefault();
      choose(opts[active]);
    } else if (e.key === 'Escape') {
      closeList();
    }
  });
  whereIn.addEventListener('blur', function () {
    window.clearTimeout(blurTimer);
    blurTimer = window.setTimeout(closeList, 150);
  });
  list.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var li = e.target && e.target.closest ? e.target.closest('[data-opt]') : null;
    if (li) choose(opts[parseInt(li.getAttribute('data-opt'), 10)]);
  });

  /* ------------------------------------------------------------- chips */
  var chips = root.querySelectorAll('[data-chip]');
  Array.prototype.forEach.call(chips, function (b) {
    b.addEventListener('click', function () {
      nameIn.value = b.getAttribute('data-chip') || '';
      whereIn.focus();
    });
  });
  function syncChips() {
    var used = people.map(function (p) { return p.n.toLowerCase(); });
    Array.prototype.forEach.call(chips, function (b) {
      b.disabled = used.indexOf(String(b.getAttribute('data-chip')).toLowerCase()) !== -1;
    });
  }

  /* -------------------------------------------------------------- add */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!picked) {
      // Add chooses only an answer that needs no choosing: one district, or
      // the one region a no-difference split comes to.
      var got = districtsFor(whereIn.value);
      if (got.region || (got.ds.length === 1 && !split)) choose(got.items[0]);
    }
    if (!picked) {
      say(C.pickFirst);
      whereIn.focus();
      return;
    }
    if (people.length >= MAX) { say(C.full); return; }
    var name = clean(nameIn.value) || String(C.unnamed || '').replace('%n', String(people.length + 1));
    var slug = picked.f ? data.fr[picked.r].s : data.d[picked.d].s;
    var person = { n: name, p: slug };
    if (picked.f) person.f = picked.f.map(function (i) { return data.d[i].s; });
    people.push(person);
    save();
    nameIn.value = '';
    whereIn.value = '';
    picked = null;
    render();
    say(fill(C.added, placeName(placeOf(slug))));
    nameIn.focus();
  });

  /* ------------------------------------------------------------ sharing */
  function shareLinks(holder, text, url, subject, ids) {
    var wa = el('a', 'htvx-chip', C.whatsapp);
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.setAttribute('data-testid', ids.wa);
    wa.appendChild(el('span', 'visually-hidden', ' (opens in a new tab)'));
    var sms = el('a', 'htvx-chip', C.sms);
    sms.href = 'sms:?&body=' + encodeURIComponent(text + ' ' + url);
    sms.setAttribute('data-testid', ids.sms);
    var em = el('a', 'htvx-chip', C.email);
    em.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text + '\n\n' + url);
    em.setAttribute('data-testid', ids.email);
    holder.appendChild(wa);
    holder.appendChild(sms);
    holder.appendChild(em);
  }
  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else done(false);
  }

  /* --------------------------------------------------------- the list */
  var listEl = $('htvfamList');
  var emptyEl = $('htvfamEmpty');
  var allEl = $('htvfamAll');
  function render() {
    if (!listEl) return;
    listEl.textContent = '';
    people.forEach(function (p, k) {
      var pl = placeOf(p.p);
      if (!pl) return;
      var from = fromOf(pl, p.f);
      var url = placeUrl(pl, from);
      var where = placeName(pl);
      var li = el('li', 'htvfam-person');
      li.setAttribute('data-testid', 'htv-family-person');
      li.setAttribute('data-place', pl.s);
      li.appendChild(el('span', 'htvfam-avatar', (p.n.charAt(0) || '?').toUpperCase())).setAttribute('aria-hidden', 'true');
      var who = el('div', 'htvfam-who');
      who.appendChild(el('p', 'htvfam-name', p.n)).setAttribute('data-testid', 'htv-family-person-name');
      var placeP = el('p', 'htvfam-place');
      var a = el('a', null, where);
      a.href = url.slice(SITE.length);
      placeP.appendChild(a);
      if (pl.kind === 'd') placeP.appendChild(document.createTextNode(' · ' + data.r[data.d[pl.i].r].n + ' Region'));
      else if (from) placeP.appendChild(document.createTextNode(' · ' + sayOr(from) + ' District'));
      who.appendChild(placeP);
      var papers = el('ul', 'htvfam-papers');
      papers.setAttribute('data-testid', 'htv-family-papers');
      if (pl.kind === 'd') {
        papers.appendChild(el('li', null, data.fd[pl.i].la));
        papers.appendChild(el('li', null, data.fr[data.d[pl.i].r].lc));
      } else if (from) {
        // Split between districts of this region, none with our Assembly
        // candidate: what is on their papers, honestly.
        papers.appendChild(el('li', null, fill(C.laNoneIn, sayOr(from))));
        papers.appendChild(el('li', null, data.fr[pl.i].lc));
      } else {
        papers.appendChild(el('li', null, data.fr[pl.i].lc));
        papers.appendChild(el('li', null, C.regionOnly));
      }
      who.appendChild(papers);
      li.appendChild(who);
      var acts = el('div', 'htvfam-acts');
      var text = fill(C.personText, where);
      var share = el('button', 'htvx-chip', C.share);
      share.type = 'button';
      share.setAttribute('data-testid', 'htv-family-share');
      share.addEventListener('click', function () {
        if (navigator.share) {
          navigator.share({ title: document.title, text: text, url: url }).catch(function () { /* cancelled */ });
          return;
        }
        copy(url, function (ok) { say(ok ? C.copied : url); });
      });
      acts.appendChild(share);
      shareLinks(acts, text, url, fill(C.personText, where).replace(/:$/, ''), { wa: 'htv-family-whatsapp', sms: 'htv-family-sms', email: 'htv-family-email' });
      var rm = el('button', 'htvx-chip htvfam-remove', C.remove);
      rm.type = 'button';
      rm.setAttribute('aria-label', C.remove + ' ' + p.n);
      rm.setAttribute('data-testid', 'htv-family-remove');
      rm.addEventListener('click', function () {
        people.splice(k, 1);
        save();
        render();
        say(C.removed);
        nameIn.focus();
      });
      acts.appendChild(rm);
      li.appendChild(acts);
      listEl.appendChild(li);
    });
    if (emptyEl) emptyEl.hidden = people.length > 0;
    if (allEl) allEl.hidden = people.length === 0;
    syncChips();
    sendLinks();
  }

  /* ------------------------------------------- one message for everyone */
  var sendBtn = $('htvfamSendAll');
  var sendBox = $('htvfamSend');
  function message() {
    var seen = {};
    var lines = [];
    people.forEach(function (p) {
      var pl = placeOf(p.p);
      if (!pl) return;
      var url = placeUrl(pl, fromOf(pl, p.f));
      if (seen[url]) return;
      seen[url] = true;
      lines.push(placeName(pl) + ': ' + url);
    });
    return C.sendHead ? C.sendHead + '\n' + lines.join('\n') : lines.join('\n');
  }
  function sendLinks() {
    var text = message();
    var wa = $('htvfamWa');
    var sms = $('htvfamSms');
    var em = $('htvfamEmail');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    if (sms) sms.href = 'sms:?&body=' + encodeURIComponent(text);
    if (em) em.href = 'mailto:?subject=' + encodeURIComponent(C.emailSubject || '') + '&body=' + encodeURIComponent(text);
  }
  if (sendBtn && sendBox) {
    if (navigator.share) {
      var links = sendBox.querySelector('.htvx-share-links');
      var native = el('button', 'htvx-chip', C.shareAll);
      native.type = 'button';
      native.addEventListener('click', function () {
        navigator.share({ title: document.title, text: message() }).catch(function () { /* cancelled */ });
      });
      if (links) links.insertBefore(native, links.firstChild);
    }
    sendBtn.addEventListener('click', function () {
      var open = sendBox.hidden;
      sendBox.hidden = !open;
      sendBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  var copyAll = $('htvfamCopy');
  if (copyAll) {
    copyAll.addEventListener('click', function () {
      var st = $('htvfamSendStatus');
      copy(message(), function (ok) { if (st) st.textContent = ok ? C.copied : message(); });
    });
  }

  /* --------------------------------------------------- the family pack */
  var pack = root.querySelector('.htvfam-pack');
  var cover = $('htvfamCover');
  function plan() {
    if (!pack || !cover) return [];
    var forSheet = {};
    var order = [];
    var cards = [];
    people.forEach(function (p) {
      var pl = placeOf(p.p);
      if (!pl) { cards.push([]); return; }
      var mine = [];
      var la = pl.kind === 'd' ? data.fd[pl.i].sheet : '';
      var r = data.fr[regionIndexOf(pl)];
      if (la) mine.push({ id: la, label: fill(C.cardLa, placeName(pl)) });
      if (r && r.sheet) mine.push({ id: r.sheet, label: fill(C.cardLc, r.label) });
      mine.forEach(function (m) {
        if (!forSheet[m.id]) { forSheet[m.id] = []; order.push(m.id); }
        if (forSheet[m.id].indexOf(p.n) === -1) forSheet[m.id].push(p.n);
      });
      cards.push(mine);
    });
    var sheets = pack.querySelectorAll('.htvfam-sheet');
    Array.prototype.forEach.call(sheets, function (s) {
      var id = s.getAttribute('data-sheet');
      var on = Boolean(forSheet[id]);
      s.classList.toggle('is-included', on);
      var f = s.querySelector('[data-fam-for]');
      if (f) f.textContent = on ? forSheet[id].join(', ') : '';
    });
    // The sheets print in the order the people need them.
    order.forEach(function (id) {
      var s = pack.querySelector('.htvfam-sheet[data-sheet="' + id + '"]');
      if (s) pack.appendChild(s);
    });
    cover.textContent = '';
    people.forEach(function (p, k) {
      var pl = placeOf(p.p);
      if (!pl) return;
      var li = el('li');
      li.appendChild(el('b', null, p.n));
      var from = fromOf(pl, p.f);
      var where = placeName(pl) + (pl.kind === 'd' ? ' · ' + data.r[data.d[pl.i].r].n + ' Region' : from ? ' · ' + sayOr(from) + ' District' : '');
      li.appendChild(el('span', null, where));
      var mine = cards[k] || [];
      li.appendChild(el('span', null, mine.length ? C.coverCards + ': ' + mine.map(function (m) { return m.label; }).join('; ') : C.coverNoCards));
      cover.appendChild(li);
    });
    root.setAttribute('data-sheets', String(1 + order.length));
    return order;
  }
  function ready(imgs) {
    return Promise.all(
      imgs.map(function (img) {
        img.loading = 'eager';
        if (img.complete && img.naturalWidth) return Promise.resolve();
        return new Promise(function (res) {
          var t = window.setTimeout(res, 3000);
          img.addEventListener('load', function () { window.clearTimeout(t); res(); }, { once: true });
          img.addEventListener('error', function () { window.clearTimeout(t); res(); }, { once: true });
        });
      })
    );
  }
  var printBtn = $('htvfamPrint');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      plan();
      say(C.printBusy);
      var imgs = Array.prototype.slice.call(pack.querySelectorAll('.htvfam-sheet.is-included img'));
      ready(imgs).then(function () {
        say('');
        window.print();
      });
    });
  }
  // The browser's own Print command prints the same pack.
  window.addEventListener('beforeprint', plan);

  var clearBtn = $('htvfamClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      people = [];
      save();
      render();
      say(C.cleared);
      nameIn.focus();
    });
  }

  render();
  plan();
  root.classList.add('is-ready');
})();
