/* Contact page — one job: reveal a working "Copy address" button.
   ==========================================================================
   THE RULE THIS FILE OBEYS: the page must be complete without it.

   The two mailto buttons are plain anchors whose href already carries the
   address and the percent-encoded subject prefix. Opening a composed email is
   the browser's job, not this script's — with JavaScript off, blocked, or
   broken, both buttons still work, and the compose preview above them still
   shows the exact address and subject line as selectable text.

   So the only thing here is an extra: a clipboard button for the address. It
   ships `hidden` in the HTML and is revealed ONLY once this script has
   confirmed navigator.clipboard.writeText exists in a secure context — the same
   discipline as media-copy.js. A capability we cannot confirm produces no
   button at all, and a rejected copy never shows a success state: it says so
   and puts the address on screen, selected, so Ctrl/Cmd+C finishes the job.
   ========================================================================== */
(function () {
  'use strict';

  var clip = navigator.clipboard;
  // isSecureContext is true on https AND on localhost, so local testing works.
  var secure = window.isSecureContext !== false;
  if (!clip || typeof clip.writeText !== 'function' || !secure) return;

  var REVERT_MS = 1800;

  function statusEl(btn) {
    var card = btn.closest('.ct-route');
    return card ? card.querySelector('[data-ct-status]') : null;
  }

  function say(btn, msg) {
    var el = statusEl(btn);
    if (!el) return;
    el.textContent = msg;
    // Clearing on a timer stops the live region re-announcing stale text when
    // the other route's button is used next.
    window.setTimeout(function () {
      if (el.textContent === msg) el.textContent = '';
    }, 4000);
  }

  function flash(btn, label) {
    if (btn.dataset.ctBusy === '1') return;
    var original = btn.dataset.ctLabel || btn.textContent;
    btn.dataset.ctLabel = original;
    btn.dataset.ctBusy = '1';
    btn.textContent = label;
    btn.classList.add('is-copied');
    window.setTimeout(function () {
      btn.textContent = btn.dataset.ctLabel || original;
      btn.classList.remove('is-copied');
      btn.dataset.ctBusy = '0';
    }, REVERT_MS);
  }

  /* Visible fallback for a refused copy: select the address that is already on
     the page, in this route's own compose preview, so the reader only has to
     press Ctrl/Cmd+C. Nothing new is injected. */
  function selectAddress(btn) {
    var card = btn.closest('.ct-route');
    var target = card && card.querySelector('.ct-compose-row .ct-compose-val');
    if (!target || !window.getSelection || !document.createRange) return;
    try {
      var range = document.createRange();
      range.selectNodeContents(target);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {
      /* selection is a nicety; the address is visible either way */
    }
  }

  var buttons = document.querySelectorAll('.ct-copy[data-ct-copy]');
  Array.prototype.forEach.call(buttons, function (btn) {
    var address = btn.getAttribute('data-ct-copy') || '';
    if (!address) return;

    btn.addEventListener('click', function () {
      clip.writeText(address).then(
        function () {
          flash(btn, 'Copied');
          say(btn, address + ' copied to your clipboard.');
        },
        function () {
          say(btn, 'Your browser blocked the copy — the address is selected above, press Ctrl/Cmd+C.');
          selectAddress(btn);
        }
      );
    });

    // Only now does the button exist for the reader.
    btn.hidden = false;
  });
})();
