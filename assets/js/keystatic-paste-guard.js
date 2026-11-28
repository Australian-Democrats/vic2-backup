/*
 * Keystatic paste guard (Layer 1 of the Word-paste defence; Layer 2 is the
 * build-time remark normalisation in astro.config.mjs, Layer 3 the episode
 * page's overflow-wrap CSS backstop).
 *
 * Text pasted from Word/Outlook/Teams arrives with non-breaking spaces (U+00A0,
 * serialised to markdown as &nbsp;) glued between words. Rendered on the site,
 * each paragraph becomes one unbreakable "word" that overflows sideways instead
 * of wrapping (first seen on podcast episode 41, 2026-08-23). This script
 * normalises those to ordinary spaces AT PASTE TIME, inside the /keystatic
 * admin only, so the bad characters never reach the committed content:
 *
 * - Paste into a plain <input>/<textarea> (titles, slugs): cancel the paste and
 *   re-insert the cleaned plain text via execCommand('insertText'), which keeps
 *   the browser's undo stack intact.
 * - Paste into the rich-text editor (contenteditable/ProseMirror): re-dispatch
 *   the paste as a synthetic ClipboardEvent carrying cleaned text/html +
 *   text/plain, which ProseMirror handles exactly like the original (keeping
 *   links, bold, lists). If the editor doesn't consume the synthetic event,
 *   fall back to inserting the cleaned plain text.
 *
 * Fail-open by design, like the image guard: the clean payload is built BEFORE
 * the original event is cancelled, so if anything throws, the original paste
 * proceeds untouched (and Layers 2 + 3 still stand behind it). Pastes carrying
 * files (screenshots) are never touched. Injected into the Keystatic admin HTML
 * by src/middleware.ts; never loaded on public pages.
 */
(function () {
  'use strict';
  if (window.__adPasteGuardInstalled) return;
  window.__adPasteGuardInstalled = true;

  function clean(value, isHtml) {
    var out = value.replace(/\u00A0/g, ' ');
    if (isHtml) out = out.replace(/&nbsp;/gi, ' ');
    return out;
  }

  document.addEventListener(
    'paste',
    function (e) {
      try {
        var dt = e.clipboardData;
        if (!dt) return;
        if (dt.files && dt.files.length) return; // never touch file/screenshot pastes

        var html = dt.getData('text/html') || '';
        var text = dt.getData('text/plain') || '';
        var dirty =
          html.indexOf('\u00A0') !== -1 ||
          /&nbsp;/i.test(html) ||
          text.indexOf('\u00A0') !== -1;
        if (!dirty) return;

        var target = e.target;
        var isField =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
        var editable =
          !isField && target && target.closest && target.closest('[contenteditable="true"]');
        if (!isField && !editable) return;

        if (isField) {
          // Build nothing fancy: cleaned plain text through the native
          // insertion path, preserving undo.
          e.preventDefault();
          e.stopImmediatePropagation();
          document.execCommand('insertText', false, clean(text, false));
          return;
        }

        // Rich-text editor: assemble the cleaned clipboard BEFORE cancelling,
        // so a constructor failure leaves the original paste working.
        var payload = new DataTransfer();
        for (var i = 0; i < dt.types.length; i++) {
          var type = dt.types[i];
          if (type === 'Files') continue;
          var v = dt.getData(type);
          if (typeof v === 'string' && v) {
            payload.setData(type, clean(v, type === 'text/html'));
          }
        }
        var synthetic = new ClipboardEvent('paste', {
          clipboardData: payload,
          bubbles: true,
          cancelable: true,
        });

        e.preventDefault();
        e.stopImmediatePropagation();
        var consumed = !target.dispatchEvent(synthetic) || synthetic.defaultPrevented;
        if (!consumed) {
          // Editor ignored the synthetic event — insert cleaned plain text so
          // the paste is never silently swallowed.
          document.execCommand('insertText', false, clean(text || html.replace(/<[^>]*>/g, ''), true));
        }
      } catch (err) {
        // Fail open: an untouched Word paste is annoying, a broken paste is worse.
      }
    },
    true
  );
})();
