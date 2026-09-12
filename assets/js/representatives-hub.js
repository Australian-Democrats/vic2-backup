/* /representatives — per-section search and view toggle.

   PROGRESSIVE ENHANCEMENT, and nothing else. The server ships every
   representative in every section TWICE — once as a poster card, once as a
   ledger row — and the control row ships with the `hidden` attribute. This
   script's first act is to remove that attribute, so a reader with JavaScript
   off never meets a search box that does nothing: they simply get the complete
   list, forked by width in CSS.

   THREE CONTRACTS THIS FILE MUST KEEP.

   1. FOCUS IS NEVER MOVED. Not on input, not on the toggle. Filtering a list
      under someone's cursor and then stealing the caret is a WCAG 3.2.2 change
      of context; there is nothing here worth that.

   2. THE COUNTER IS role="status" WITH NO aria-live. The pair double-announces
      in NVDA and VoiceOver — the same finding already written down in
      ballot-district.js. It is also left EMPTY until a query actually narrows
      the list, so nothing is announced on load.

   3. THE TOGGLE DOES NOT CLAIM A VIEW UNTIL SOMEBODY CHOOSES ONE. Until then
      the section has no `data-view` attribute and the stylesheet's responsive
      default is in charge (rows on a phone, wall from 720px); the buttons just
      report which of the two is currently showing, and keep reporting it
      through a resize. The moment a button is pressed, `data-view` is set and
      the choice wins at every width. Nothing is fetched and nothing is
      re-rendered — both markups were already on the page.

   No scroll, resize-thrash or touchmove listeners; one matchMedia listener per
   section, and only while no explicit choice has been made. */
(function () {
  'use strict';

  var sections = document.querySelectorAll('[data-rep-section]');
  if (!sections.length) return;

  var WALL_FROM = '(min-width: 720px)';

  function fold(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  Array.prototype.forEach.call(sections, function (section) {
    var controls = section.querySelector('[data-rep-controls]');
    // No control row means this section holds one representative (or none):
    // the server did not render controls, and there is nothing to enhance.
    if (!controls) return;

    var input = controls.querySelector('[data-rep-search]');
    var out = controls.querySelector('[data-rep-out]');
    var empty = section.querySelector('[data-rep-empty]');
    var buttons = Array.prototype.slice.call(controls.querySelectorAll('[data-rep-view]'));
    var items = Array.prototype.slice.call(section.querySelectorAll('[data-rep-item]'));
    if (!input || !items.length) return;

    // Each representative appears in both markups, so the visible COUNT is a
    // count of distinct ids, not of elements.
    var ids = [];
    items.forEach(function (el) {
      var id = el.getAttribute('data-rep-id') || '';
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
    var total = ids.length;

    controls.hidden = false;

    // ---- search ------------------------------------------------------------
    function filter() {
      var q = fold(input.value);
      var shown = [];
      items.forEach(function (el) {
        var hit = !q || (el.getAttribute('data-rep-text') || '').indexOf(q) !== -1;
        el.hidden = !hit;
        var id = el.getAttribute('data-rep-id') || '';
        if (hit && id && shown.indexOf(id) === -1) shown.push(id);
      });
      var n = shown.length;
      if (out) out.textContent = q ? n + ' of ' + total + ' shown' : '';
      if (empty) empty.hidden = !(q && n === 0);
    }
    input.addEventListener('input', filter);
    // A browser-restored value (back button, bfcache) must not leave the list
    // and the box disagreeing.
    if (input.value) filter();

    // ---- view toggle -------------------------------------------------------
    var mq = window.matchMedia ? window.matchMedia(WALL_FROM) : null;
    var chosen = '';

    function reportPressed() {
      var showing = chosen || (mq && mq.matches ? 'cards' : 'list');
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-rep-view') === showing ? 'true' : 'false');
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        chosen = b.getAttribute('data-rep-view') === 'list' ? 'list' : 'cards';
        section.setAttribute('data-view', chosen);
        reportPressed();
      });
    });

    if (mq) {
      var onChange = function () {
        if (!chosen) reportPressed();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    reportPressed();
  });
})();
