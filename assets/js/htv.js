/* How-to-Vote card actions: print, share (Web Share API with a copy-link fallback),
   the above/below-the-line toggle, and — on a narrow (mobile-portrait) screen — a
   custom horizontal scroller that opens centred on our "1". Progressive enhancement:
   the card is fully readable without this file. The authorisation line is set in the
   back-end only, so there is no visitor-facing editor here. */
(function () {
  'use strict';

  var printBtn = document.getElementById('htvPrint');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }

  // --- Centre our column in a horizontal scroller (mobile portrait). No-op when the
  //     ballot already fits (desktop / landscape), since there's nothing to scroll. ---
  function centreOwner(scroll) {
    if (!scroll) return;
    var target = scroll.querySelector('.lc-col--big.is-ours') || scroll.querySelector('.is-ours');
    if (!target) return;
    var sr = scroll.getBoundingClientRect();
    var tr = target.getBoundingClientRect();
    scroll.scrollLeft += (tr.left - sr.left) - (sr.width - tr.width) / 2;
    updateScrollEdges(scroll);
  }
  // Toggle "there's more this way" edge fades based on scroll position, and surface a
  // one-time swipe hint under any ballot that actually overflows (mobile portrait).
  function updateScrollEdges(scroll) {
    if (!scroll) return;
    var max = scroll.scrollWidth - scroll.clientWidth;
    var scrollable = max > 2;
    scroll.classList.toggle('has-left', scrollable && scroll.scrollLeft > 2);
    scroll.classList.toggle('has-right', scrollable && scroll.scrollLeft < max - 2);
    scroll.classList.toggle('is-scrollable', scrollable);
    var view = scroll.closest('.lc-view');
    if (!view) return;
    // The GVT focused strip is designed to fit the screen — never nag to swipe it.
    var isGvt = !!scroll.querySelector('.lc-strip--gvt');
    var hint = view.querySelector('.lc-swipe');
    if (scrollable && !isGvt && !hint) {
      hint = document.createElement('p');
      hint.className = 'lc-swipe';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = '<span>Swipe to see the whole ballot</span>';
      scroll.insertAdjacentElement('afterend', hint);
    } else if (!scrollable && hint) {
      hint.remove();
    }
  }
  // The visible scroller inside a given .lc-ballot (the shown ATL or BTL view).
  function visibleScroll(lc) {
    var view = lc.getAttribute('data-view') === 'btl' ? '.lc-view--btl' : '.lc-view--atl';
    var v = lc.querySelector(view);
    return v ? v.querySelector('.lc-scroll') : null;
  }
  function centreAll() {
    document.querySelectorAll('.lc-ballot').forEach(function (lc) { centreOwner(visibleScroll(lc)); });
  }

  // Wire every above/below-the-line toggle (primary card + any connected cards).
  document.querySelectorAll('.lc-toggle').forEach(function (group) {
    var wrap = group.closest('.lc-wrap');
    var lc = wrap && wrap.querySelector('.lc-ballot');
    if (!lc) return;
    var btns = group.querySelectorAll('.lc-toggle-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        lc.setAttribute('data-view', btn.getAttribute('data-view') || 'atl');
        btns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        centreOwner(visibleScroll(lc));
      });
    });
  });

  // Keep the edge fades in sync while the user scrolls.
  document.querySelectorAll('.lc-scroll').forEach(function (s) {
    s.addEventListener('scroll', function () { updateScrollEdges(s); }, { passive: true });
    updateScrollEdges(s);
  });

  // Open centred on our column, and re-centre on demand (e.g. the editor switching views).
  centreAll();
  window.addEventListener('load', centreAll);
  window.addEventListener('resize', centreAll);
  document.addEventListener('htv:recentre', centreAll);

  var shareBtn = document.getElementById('htvShare');
  var status = document.getElementById('htvShareStatus');
  function setStatus(msg) { if (status) status.textContent = msg || ''; }
  if (shareBtn) {
    shareBtn.addEventListener('click', async function () {
      var url = window.location.href;
      var title = document.title;
      if (navigator.share) {
        try { await navigator.share({ title: title, url: url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); setStatus('Link copied to your clipboard.'); }
      catch (e) { setStatus(url); }
    });
  }
})();
