/* Registered how-to-vote cards (ADR-104) — src/components/HtvCardViewer.astro.
   One script for every card on the page (a candidate page has one; the
   /how-to-vote card finder has one per electorate). Loaded only by a page
   that shows a card.

   What it adds to the server-rendered card (which is complete without it —
   both pages, the PDF link, the WhatsApp / Message / Email links):
   · Phones: the two pages are a sideways swipe; the Front / Back buttons say
     which is showing and turn to the other.
   · Enlarge: a page opens in a <dialog> instead of leaving the page (the link
     still goes straight to the picture where <dialog> is missing).
   · Share: the card's two pictures through the phone's share sheet where the
     browser can share files (that is how they reach Messages or WhatsApp AS
     PICTURES); else the link through the share sheet; else the link copied.
   · Save to Photos: on a phone, the share sheet with the pictures (iPhone:
     "Save 2 Images"); elsewhere, both pictures downloaded as JPEGs.
   · Print: just the card's two pages, one per sheet — nothing else from the
     page (htv-card.css, html.htvc-printing).
   · Copy link.
   The pictures are fetched once, on the first sign the visitor is using the
   card (a touch, a click, keyboard focus), so a share opens at once — the
   share sheet must open while the tap still counts as a tap.

   Messages go to the card's own role="status" line. Everything is built with
   DOM text nodes, never HTML strings. No network beyond this site's own two
   pictures. */
(function () {
  'use strict';

  var roots = document.querySelectorAll('[data-htv-card]');
  if (!roots.length) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var apple =
    /iPhone|iPad|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* Can this browser share picture FILES (not just a link)? Asked with a
     one-byte stand-in, so the answer is known before anything is fetched. */
  var sharesFiles = (function () {
    try {
      if (!navigator.share || !navigator.canShare || typeof File !== 'function') return false;
      return navigator.canShare({ files: [new File([new Uint8Array(1)], 'card.jpg', { type: 'image/jpeg' })] });
    } catch (e) {
      return false;
    }
  })();

  function abs(path) {
    try {
      return new URL(path, window.location.href).href;
    } catch (e) {
      return path;
    }
  }

  function setup(root) {
    var place = root.getAttribute('data-place') || 'your electorate';
    var stem = root.getAttribute('data-file-stem') || 'Australian-Democrats-How-to-Vote';
    var front = root.getAttribute('data-front') || '';
    var back = root.getAttribute('data-back') || '';
    var shareUrl = root.getAttribute('data-share-url') || window.location.href;
    var shareText = root.getAttribute('data-share-text') || '';
    var title = 'Australian Democrats how-to-vote card — ' + place;
    var statusEl = root.querySelector('[data-htvc-status]');
    var track = root.querySelector('[data-htvc-track]');
    var pager = root.querySelector('[data-htvc-pager]');
    var pages = { front: root.querySelector('[data-htvc-page="front"]'), back: root.querySelector('[data-htvc-page="back"]') };
    if (!statusEl || !track || !front || !back) return;

    function say(text) {
      statusEl.textContent = text || '';
    }

    /* ------------------------------------------------ the pictures as files */
    var filesPromise = null;
    function getFiles() {
      if (!filesPromise) {
        filesPromise = Promise.all(
          [
            [front, stem + '-front.jpg'],
            [back, stem + '-back.jpg'],
          ].map(function (f) {
            return fetch(f[0], { credentials: 'same-origin' })
              .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
              })
              .then(function (b) {
                return new File([b], f[1], { type: b.type || 'image/jpeg' });
              });
          })
        ).catch(function (e) {
          filesPromise = null; // try again next time
          throw e;
        });
      }
      return filesPromise;
    }
    var filesReady = null;
    function warm() {
      if (!sharesFiles || filesReady) return;
      filesReady = getFiles().then(
        function (files) {
          filesReady = files;
          return files;
        },
        function () {
          filesReady = null;
        }
      );
    }
    ['pointerdown', 'touchstart', 'focusin'].forEach(function (ev) {
      root.addEventListener(ev, warm, { passive: true });
    });

    /* --------------------------------------------------------- copy the link */
    function copyLink(prefix) {
      var done = function () {
        say(prefix || 'Link copied — paste it into a message or a post.');
      };
      var manual = function () {
        say('Copy this link: ' + shareUrl);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(shareUrl).then(done, manual);
      else manual();
    }

    /* ----------------------------------------------------------------- share */
    function shareLink() {
      if (navigator.share) {
        return navigator.share({ title: title, text: shareText, url: shareUrl }).then(
          function () {
            say('');
          },
          function (e) {
            if (e && e.name === 'AbortError') return;
            copyLink('We couldn’t open sharing, so we copied the link instead — paste it into a message.');
          }
        );
      }
      copyLink('Sharing isn’t available in this browser, so we copied the link instead — paste it into a message.');
      return Promise.resolve();
    }

    function shareFiles(files, data, okText) {
      return navigator.share(data).then(
        function () {
          say(okText || '');
        },
        function (e) {
          if (e && e.name === 'AbortError') {
            say('');
            return;
          }
          if (e && e.name === 'NotAllowedError') {
            // The pictures took long enough to arrive that the tap no longer
            // counts; they are ready now.
            say('The card is ready — tap the button again.');
            return;
          }
          throw e;
        }
      );
    }

    function withFiles(then) {
      if (filesReady && filesReady.length) return then(filesReady);
      say('Getting the card ready…');
      return getFiles().then(function (files) {
        filesReady = files;
        return then(files);
      });
    }

    var shareBtn = root.querySelector('[data-htvc-share]');
    if (shareBtn) {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function () {
        if (!sharesFiles) {
          shareLink();
          return;
        }
        withFiles(function (files) {
          if (!navigator.canShare({ files: files })) return shareLink();
          return shareFiles(files, { files: files, title: title, text: shareText + ' ' + shareUrl });
        }).catch(function () {
          shareLink();
        });
      });
    }

    /* --------------------------------------------------------- save to photos */
    function download(href, name) {
      var a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.rel = 'noopener';
      a.hidden = true;
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
    }
    function downloadBoth() {
      download(front, stem + '-front.jpg');
      window.setTimeout(function () {
        download(back, stem + '-back.jpg');
      }, 450);
      say('Saving both sides of the card as pictures (JPEG) to your downloads.');
    }
    var saveBtn = root.querySelector('[data-htvc-save]');
    if (saveBtn) {
      saveBtn.hidden = false;
      saveBtn.addEventListener('click', function () {
        // A phone keeps pictures in Photos, which the share sheet reaches; a
        // computer keeps them as downloads.
        if (!(sharesFiles && coarse)) {
          downloadBoth();
          return;
        }
        withFiles(function (files) {
          if (!navigator.canShare({ files: files })) return downloadBoth();
          say(
            apple
              ? 'Choose “Save 2 Images” to add both sides of the card to Photos.'
              : 'Choose your photos or files app to keep both sides of the card.'
          );
          return shareFiles(files, { files: files, title: title });
        }).catch(function () {
          downloadBoth();
        });
      });
    }

    /* ----------------------------------------------------------------- print */
    var printBtn = root.querySelector('[data-htvc-print]');
    if (printBtn && typeof window.print === 'function') {
      printBtn.hidden = false;
      printBtn.addEventListener('click', function () {
        var html = document.documentElement;
        var old = document.querySelector('.htvc-printsheet');
        if (old) old.parentNode.removeChild(old);
        var sheet = document.createElement('div');
        sheet.className = 'htvc-printsheet';
        sheet.setAttribute('aria-hidden', 'true');
        sheet.setAttribute('data-testid', 'htv-card-printsheet');
        var imgs = [front, back].map(function (src) {
          var img = new Image();
          img.alt = '';
          img.decoding = 'sync';
          img.src = src;
          sheet.appendChild(img);
          return img;
        });
        document.body.appendChild(sheet);
        say('Getting the card ready to print…');
        var loaded = Promise.all(
          imgs.map(function (img) {
            return img.complete && img.naturalWidth
              ? Promise.resolve()
              : new Promise(function (resolve, reject) {
                  img.onload = resolve;
                  img.onerror = reject;
                });
          })
        );
        var timeout = new Promise(function (resolve, reject) {
          window.setTimeout(reject, 15000);
        });
        Promise.race([loaded, timeout]).then(
          function () {
            var done = false;
            function cleanup() {
              if (done) return;
              done = true;
              html.classList.remove('htvc-printing');
              if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
              window.removeEventListener('afterprint', cleanup);
            }
            html.classList.add('htvc-printing');
            window.addEventListener('afterprint', cleanup);
            say('');
            window.print();
            // Where print() does not wait for the dialog, afterprint tidies up;
            // failing that, the next touch or return to the window does.
            window.setTimeout(function () {
              document.addEventListener('pointerdown', cleanup, { once: true });
              window.addEventListener('focus', cleanup, { once: true });
            }, 1500);
          },
          function () {
            if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
            say('The card didn’t load for printing — download the PDF and print that instead.');
          }
        );
      });
    }

    /* ------------------------------------------------------------- copy link */
    var copyBtn = root.querySelector('[data-htvc-copy]');
    if (copyBtn) {
      copyBtn.hidden = false;
      copyBtn.addEventListener('click', function () {
        copyLink();
      });
    }

    /* -------------------------------------------- phones: swipe + Front/Back */
    function centreOf(side) {
      var p = pages[side];
      if (!p) return 0;
      var t = track.getBoundingClientRect();
      var r = p.getBoundingClientRect();
      return r.left - t.left + track.scrollLeft - (track.clientWidth - r.width) / 2;
    }
    function setPressed(side) {
      if (!pager) return;
      Array.prototype.forEach.call(pager.querySelectorAll('[data-htvc-go]'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-htvc-go') === side ? 'true' : 'false');
      });
    }
    if (pager) {
      pager.hidden = false;
      pager.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-htvc-go]') : null;
        if (!b) return;
        var side = b.getAttribute('data-htvc-go');
        setPressed(side);
        track.scrollTo({ left: Math.max(0, centreOf(side)), behavior: reduced ? 'auto' : 'smooth' });
      });
      var ticking = false;
      track.addEventListener(
        'scroll',
        function () {
          if (ticking) return;
          ticking = true;
          window.requestAnimationFrame(function () {
            ticking = false;
            var mid = track.scrollLeft;
            setPressed(Math.abs(centreOf('back') - mid) < Math.abs(centreOf('front') - mid) ? 'back' : 'front');
          });
        },
        { passive: true }
      );
    }

    /* --------------------------------------------------------------- enlarge */
    var dialog = null;
    var dialogImg = null;
    var dialogTitle = null;
    var flipBtn = null;
    var showing = 'front';
    var alts = {
      front: (pages.front && pages.front.querySelector('img') && pages.front.querySelector('img').alt) || '',
      back: (pages.back && pages.back.querySelector('img') && pages.back.querySelector('img').alt) || '',
    };
    function paintDialog() {
      dialogImg.src = showing === 'front' ? front : back;
      dialogImg.alt = alts[showing];
      dialogTitle.textContent = place + ' — ' + (showing === 'front' ? 'front' : 'back') + ' of the card';
      flipBtn.textContent = showing === 'front' ? 'Show the back' : 'Show the front';
    }
    function buildDialog() {
      if (dialog) return dialog;
      var id = (root.id || 'htvc') + '-dialog-title';
      dialog = document.createElement('dialog');
      dialog.className = 'htvc-dialog';
      dialog.setAttribute('aria-labelledby', id);
      dialog.setAttribute('data-testid', 'htv-card-dialog');
      var bar = document.createElement('div');
      bar.className = 'htvc-dialog-bar';
      dialogTitle = document.createElement('p');
      dialogTitle.className = 'htvc-dialog-title';
      dialogTitle.id = id;
      var btns = document.createElement('div');
      btns.className = 'htvc-dialog-btns';
      flipBtn = document.createElement('button');
      flipBtn.type = 'button';
      flipBtn.className = 'htvc-dialog-btn';
      flipBtn.setAttribute('data-testid', 'htv-card-dialog-flip');
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'htvc-dialog-btn htvc-dialog-btn--close';
      close.textContent = 'Close';
      close.setAttribute('data-testid', 'htv-card-dialog-close');
      btns.appendChild(flipBtn);
      btns.appendChild(close);
      bar.appendChild(dialogTitle);
      bar.appendChild(btns);
      var body = document.createElement('div');
      body.className = 'htvc-dialog-body';
      dialogImg = document.createElement('img');
      dialogImg.className = 'htvc-dialog-img';
      dialogImg.decoding = 'async';
      body.appendChild(dialogImg);
      dialog.appendChild(bar);
      dialog.appendChild(body);
      flipBtn.addEventListener('click', function () {
        showing = showing === 'front' ? 'back' : 'front';
        paintDialog();
      });
      close.addEventListener('click', function () {
        dialog.close();
      });
      // A click on the dimmed backdrop (the dialog element itself) closes it.
      dialog.addEventListener('click', function (e) {
        if (e.target === dialog) dialog.close();
      });
      document.body.appendChild(dialog);
      return dialog;
    }
    Array.prototype.forEach.call(root.querySelectorAll('[data-htvc-zoom]'), function (a) {
      a.addEventListener('click', function (e) {
        if (typeof HTMLDialogElement !== 'function' || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        showing = a.getAttribute('data-htvc-zoom') === 'back' ? 'back' : 'front';
        buildDialog();
        paintDialog();
        dialog.showModal();
      });
    });
  }

  Array.prototype.forEach.call(roots, setup);
})();
