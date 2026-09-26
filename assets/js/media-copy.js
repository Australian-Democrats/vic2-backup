/* Press kit — clipboard copying for /media (and nothing else).
   ==========================================================================
   WHAT THE PLATFORM ACTUALLY ALLOWS (this file is built around these limits,
   it does not pretend they are not there):

   1. The ONLY way to put a picture on the clipboard is
      navigator.clipboard.write() with a ClipboardItem. There is no other API.
   2. That call requires a SECURE CONTEXT (https, or localhost). Over plain
      http there is no navigator.clipboard at all.
   3. An SVG CANNOT be copied as an image. Browsers refuse 'image/svg+xml' as
      a clipboard image type, so an SVG asset can only have its MARKUP copied
      as text — which is a different, clearly-labelled thing.
   4. Everything needs a user gesture, and Safari drops the gesture across an
      await. The fix is to hand ClipboardItem a PROMISE for the blob rather
      than awaiting the fetch first; we do that, with an await-then-write
      retry for engines that do not accept promise values.

   CONSEQUENCES FOR THE UI, all deliberate:
   - Every copy button ships `hidden` in the HTML and is only revealed once
     this script has confirmed the exact capability that button needs. With
     JavaScript off, the download links and the visible addresses are the
     whole interface and nothing is broken.
   - A button that cannot be supported is NOT revealed; the card explains why
     in plain English instead.
   - A rejected copy NEVER shows a success state. It says the copy failed and
     reveals a visible fallback — the address in a text field, or the on-page
     text — already selected, so Ctrl/Cmd+C finishes the job.
   ========================================================================== */
(function () {
  'use strict';

  var clip = navigator.clipboard;
  // isSecureContext is true on https AND on localhost, so local testing works.
  var secure = window.isSecureContext !== false;
  var canText = !!(clip && typeof clip.writeText === 'function' && secure);
  var canImage = !!(canText && typeof clip.write === 'function' && typeof window.ClipboardItem === 'function');

  var REVERT_MS = 1800;

  /* ---------- little helpers ------------------------------------------- */

  function card(el) {
    return el.closest('[data-press-card]');
  }

  function say(btn, msg) {
    var box = card(btn);
    var status = box && box.querySelector('[data-press-status]');
    if (!status) return;
    status.textContent = msg;
    // Clearing on a timer keeps the live region from re-announcing stale text
    // when the next button in the same card is used.
    window.setTimeout(function () {
      if (status.textContent === msg) status.textContent = '';
    }, 4000);
  }

  function flash(btn, label) {
    if (btn.dataset.pressBusy === '1') return;
    var original = btn.dataset.pressLabel || btn.textContent;
    btn.dataset.pressLabel = original;
    btn.dataset.pressBusy = '1';
    btn.textContent = label;
    btn.classList.add('is-copied');
    window.setTimeout(function () {
      btn.textContent = btn.dataset.pressLabel || original;
      btn.classList.remove('is-copied');
      btn.dataset.pressBusy = '0';
    }, REVERT_MS);
  }

  function note(box, msg) {
    var el = box && box.querySelector('[data-press-note]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  /* Visible fallback. Two shapes, both of which end with the text SELECTED so
     the reader only has to press Ctrl/Cmd+C:
       - an input (the asset cards' address field): reveal it and select it;
       - any other element (the hex code, the boilerplate quote): select its
         text with a Range.
     Returns true when something was actually selected. */
  function offerManualCopy(btn) {
    var box = card(btn);
    var sel = btn.getAttribute('data-press-select');
    var target = sel && box ? box.querySelector(sel) : null;
    if (!target && sel) target = document.querySelector(sel);
    if (!target) return false;

    var wrap = target.closest('[data-press-manual]');
    if (wrap) wrap.hidden = false;

    try {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        target.focus();
        target.select();
        if (typeof target.setSelectionRange === 'function') {
          target.setSelectionRange(0, String(target.value).length);
        }
      } else {
        var range = document.createRange();
        range.selectNodeContents(target);
        var selection = window.getSelection();
        if (!selection) return false;
        selection.removeAllRanges();
        selection.addRange(range);
        target.classList.add('is-selected');
        window.setTimeout(function () { target.classList.remove('is-selected'); }, 6000);
      }
    } catch (e) {
      return false;
    }
    return true;
  }

  /* Nothing here ever claims the copy worked. It says what went wrong, then
     hands over the best manual route that actually exists for this button:
     an image button falls back to the Download link AND the file's address;
     a text button falls back to the on-page text, selected. */
  function failed(btn, why) {
    var manual = offerManualCopy(btn);
    var isImage = btn.getAttribute('data-press-copy') === 'image';
    var tail;
    if (manual && isImage) {
      tail = ' — use the Download button, or copy the address selected below (Ctrl+C, ⌘C on a Mac).';
    } else if (manual) {
      tail = ' — the text is selected below, press Ctrl+C (⌘C on a Mac).';
    } else if (isImage) {
      tail = ' — please use the Download button instead.';
    } else {
      tail = ' — the text is on the page above; select it and press Ctrl+C (⌘C on a Mac).';
    }
    say(btn, (why || 'Copy failed') + tail);
    btn.classList.add('is-failed');
    window.setTimeout(function () { btn.classList.remove('is-failed'); }, REVERT_MS);
  }

  /* ---------- fetching an asset ---------------------------------------- */

  /* Same-origin fetch of a file already in public/assets/press/. The CSP
     allows it: connect-src includes 'self'. The type is forced to the MIME the
     clipboard was asked for, because a Blob whose type does not match the
     ClipboardItem key is rejected outright. */
  function fetchAs(src, mime) {
    return fetch(src, { credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      return blob.type === mime ? blob : new Blob([blob], { type: mime });
    });
  }

  function fetchText(src) {
    return fetch(src, { credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
  }

  /* ---------- the three copy operations -------------------------------- */

  /* A real image on the clipboard. Promise-valued ClipboardItem first (keeps
     Safari's transient user activation alive across the fetch); if this engine
     will not take a promise, or the write is refused, await the blob and try
     once more before giving up. */
  function copyImage(src, mime) {
    var viaPromise;
    try {
      viaPromise = clip.write([new window.ClipboardItem({ [mime]: fetchAs(src, mime) })]);
    } catch (e) {
      viaPromise = Promise.reject(e);
    }
    return viaPromise.catch(function () {
      return fetchAs(src, mime).then(function (blob) {
        return clip.write([new window.ClipboardItem({ [mime]: blob })]);
      });
    });
  }

  function copySvgMarkup(src) {
    return fetchText(src).then(function (markup) {
      return clip.writeText(markup);
    });
  }

  function copyText(text) {
    return clip.writeText(text);
  }

  /* ---------- wiring ---------------------------------------------------- */

  var buttons = document.querySelectorAll('.press-copy[data-press-copy]');

  Array.prototype.forEach.call(buttons, function (btn) {
    var kind = btn.getAttribute('data-press-copy');
    var needsImage = kind === 'image';
    var supported = needsImage ? canImage : canText;

    if (!supported) {
      // Say why, once per card, and leave the button hidden. Never reveal a
      // control that cannot do the thing its label promises.
      var box = card(btn);
      if (box && !box.dataset.pressNoted) {
        box.dataset.pressNoted = '1';
        var manualWrap = box.querySelector('[data-press-manual]');
        var why = secure
          ? 'Your browser will not let a page copy to the clipboard for you.'
          : 'Copying to the clipboard needs a secure (https) connection.';
        // Point at the route that exists on THIS card, and nothing else.
        note(box, why + ' ' + (manualWrap
          ? 'Use the Download button, or select the address below and copy it by hand.'
          : 'Select the text above and copy it by hand.'));
        if (manualWrap) manualWrap.hidden = false;
      }
      return;
    }

    btn.hidden = false;
    btn.dataset.pressLabel = btn.textContent;

    btn.addEventListener('click', function () {
      if (btn.dataset.pressBusy === '1') return;
      var said = btn.getAttribute('data-press-said') || 'Copied';
      var work;

      try {
        if (kind === 'image') {
          work = copyImage(btn.getAttribute('data-press-src'), btn.getAttribute('data-press-mime') || 'image/png');
        } else if (kind === 'svg') {
          work = copySvgMarkup(btn.getAttribute('data-press-src'));
        } else {
          work = copyText(btn.getAttribute('data-press-text') || '');
        }
      } catch (e) {
        failed(btn);
        return;
      }

      work.then(
        function () {
          flash(btn, 'Copied ✓');
          say(btn, said);
        },
        function (err) {
          // Distinguish "we could not read the file" from "the clipboard said
          // no", because the two have different fixes for the reader.
          var why = err && /HTTP|Failed to fetch|NetworkError/i.test(String(err.message || err))
            ? 'That file could not be read'
            : 'Copy failed';
          failed(btn, why);
        }
      );
    });
  });
})();
