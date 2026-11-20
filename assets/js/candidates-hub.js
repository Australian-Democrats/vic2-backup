/* /candidates — search, sort and the postcode filter over the grouped
   candidate list (ADR-71).

   PROGRESSIVE ENHANCEMENT, and nothing else. The server renders every
   candidate once, in the editor's groups ("Candidates page order"), and ships
   the control row with the `hidden` attribute. This script's first act is to
   remove it — so a reader with JavaScript off never meets a search box that
   does nothing; they get the complete grouped list, which is the default view.

   Three things narrow the list, and they combine:
   · the name search ("Search candidates") — name, region or district;
   · the sort — "Our order" (the groups) or one flat sorted grid;
   · the postcode / suburb finder above (electorate-finder.js), which sends a
     `cand:area` event naming the candidates on the visitor's ballot. While it
     is on, only they are shown.
   While either the finder or a name search is narrowing the list, the groups
   holding a shown lower-house candidate (cards marked data-cand-lower) move
   to the top — that is the visitor's own district paper — whatever house the
   editor put first (ADR-73). Clearing both puts every group back in the
   page's own order.

   CONTRACTS (the same ones /representatives keeps — representatives-hub.js):

   1. FOCUS IS NEVER MOVED by typing, sorting or filtering. Filtering a list
      under someone's cursor and then stealing the caret is a WCAG 3.2.2 change
      of context. The one exception is "Clear the search": that button
      disappears the moment it works, so focus is handed to the search box
      rather than dropped on the page.

   2. THE COUNTER IS role="status" WITH NO aria-live (the pair double-announces
      in NVDA and VoiceOver). It stays EMPTY until a name search actually
      narrows the list, so nothing is announced on load — and the finder's own
      status line speaks for its filter, so the two never talk over each other.

   3. NOTHING IS COPIED OR FETCHED. Sorting and filtering move or hide the SAME
      server-rendered cards; "Our order" moves them back into their own groups,
      in their original places. One card per person, always — so a test (or a
      screen reader) never meets a duplicate.

   No scroll, resize or touch listeners. */
(function () {
  'use strict';

  var tools = document.querySelector('[data-cand-tools]');
  var groupsWrap = document.querySelector('[data-cand-groups]');
  if (!tools || !groupsWrap) return;

  var input = tools.querySelector('[data-cand-search]');
  var sortSel = tools.querySelector('[data-cand-sort]');
  var out = tools.querySelector('[data-cand-out]');
  var flatWrap = document.querySelector('[data-cand-flat-wrap]');
  var flat = document.querySelector('[data-cand-flat]');
  var empty = document.querySelector('[data-cand-empty]');
  var clearBtn = empty ? empty.querySelector('[data-cand-clear]') : null;
  var slice = function (list) { return Array.prototype.slice.call(list); };
  var groups = slice(groupsWrap.querySelectorAll('[data-cand-group]'));
  var cards = slice(groupsWrap.querySelectorAll('[data-cand-item]'));
  if (!input || !sortSel || !flat || !flatWrap || cards.length < 2) return;

  function fold(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var collator = window.Intl && Intl.Collator ? new Intl.Collator('en-AU', { sensitivity: 'base' }) : null;
  function cmp(a, b) {
    if (collator) return collator.compare(a, b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // Document order = the editor's order. Each card remembers its own grid.
  var items = cards.map(function (card, i) {
    return {
      card: card,
      i: i,
      home: card.parentNode,
      id: card.getAttribute('data-cand-id') || '',
      name: card.getAttribute('data-cand-name') || '',
      surname: card.getAttribute('data-cand-surname') || '',
      place: card.getAttribute('data-cand-place') || '',
      text: fold(card.getAttribute('data-cand-text') || card.textContent),
    };
  });

  var ORDER = {
    surname: function (a, b) { return cmp(a.surname, b.surname) || cmp(a.name, b.name) || a.i - b.i; },
    name: function (a, b) { return cmp(a.name, b.name) || a.i - b.i; },
    place: function (a, b) { return cmp(a.place, b.place) || cmp(a.surname, b.surname) || a.i - b.i; },
  };

  var view = 'default';
  // The finder's filter: null = everyone; else id → true. `lower` = the ids of
  // the visitor's lower-house candidates, whose groups lead.
  var area = null;
  var lower = Object.create(null);

  function arrange(next) {
    if (!ORDER[next]) next = 'default';
    if (next === view) return;
    if (next === 'default') {
      items.forEach(function (it) { it.home.appendChild(it.card); });
      flatWrap.hidden = true;
      groupsWrap.hidden = false;
    } else {
      items.slice().sort(ORDER[next]).forEach(function (it) { flat.appendChild(it.card); });
      groupsWrap.hidden = true;
      flatWrap.hidden = false;
    }
    view = next;
  }

  // The groups in the page's order, except that while the list is narrowed (a
  // name search or the finder), a group holding a SHOWN lower-house candidate
  // comes first. DOM order, not CSS `order`, so reading and tab order match
  // what is seen.
  function isLower(c) {
    return c.hasAttribute('data-cand-lower') || lower[c.getAttribute('data-cand-id') || ''] === true;
  }
  function orderGroups(narrowed) {
    var lead = [];
    var rest = [];
    groups.forEach(function (g) {
      var hasLower = narrowed && slice(g.querySelectorAll('[data-cand-item]')).some(function (c) {
        return !c.hidden && isLower(c);
      });
      (hasLower ? lead : rest).push(g);
    });
    // Move only the groups that are out of place: re-appending one that is
    // already right would detach it, and a carousel inside it would lose its
    // scroll position on every keystroke.
    lead.concat(rest).forEach(function (g, i) {
      var here = groupsWrap.children[i];
      if (here !== g) groupsWrap.insertBefore(g, here || null);
    });
  }

  function filter() {
    var q = fold(input.value);
    var terms = q ? q.split(' ') : [];
    var shown = 0;
    items.forEach(function (it) {
      var hit =
        (!area || area[it.id] === true) &&
        terms.every(function (t) { return it.text.indexOf(t) !== -1; });
      it.card.hidden = !hit;
      if (hit) shown += 1;
    });
    // A group with nobody left in it hides its heading too — in the grouped
    // view only; in the flat view the groups are empty and already hidden.
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('[data-cand-item]:not([hidden])');
    });
    orderGroups(Boolean(area) || terms.length > 0);
    if (empty) empty.hidden = shown !== 0;
    if (out) {
      out.textContent = !terms.length
        ? ''
        : shown === items.length
          ? 'Showing all ' + items.length + ' candidates'
          : 'Showing ' + shown + ' of ' + items.length + ' candidates';
    }
  }

  input.addEventListener('input', filter);
  sortSel.addEventListener('change', function () {
    arrange(sortSel.value);
    filter();
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      filter();
      input.focus();
    });
  }
  document.addEventListener('cand:area', function (e) {
    var d = (e && e.detail) || {};
    area = null;
    lower = Object.create(null);
    if (d.ids && d.ids.length) {
      area = Object.create(null);
      d.ids.forEach(function (id) { area[id] = true; });
      (d.lower || []).forEach(function (id) { lower[id] = true; });
    }
    filter();
  });

  tools.hidden = false;
  // A browser that restored the form on Back keeps the reader's last query
  // and sort; honour them rather than showing a list that contradicts them.
  arrange(sortSel.value);
  filter();
})();
