/* Shared site behaviour: mobile nav + the Join/Donate follow bar. */
(function () {
  'use strict';

  // --- Mobile nav toggle -------------------------------------------------
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  // --- Join/Donate follow bar --------------------------------------------
  // Appears after the reader scrolls past the first screen; dismissible for
  // the session; suppressed on the join/donate pages themselves and on
  // legal-template pages (terms, privacy) where a campaign banner would
  // sit over the text people came to read.
  var bar = document.getElementById('followBar');
  var page = document.body.getAttribute('data-page') || '';
  // Candidate surfaces suppress the follow-bar entirely — the candidate
  // action bar replaces it there (Paste-up Night §1.8), and global.css
  // hides it via body.cand-surface as the belt-and-braces.
  var suppressed =
    page === '/join' || page === '/donate' || page === '/candidates' || !!document.querySelector('.legal');
  var dismissed = false;
  try { dismissed = sessionStorage.getItem('followBarDismissed') === '1'; } catch (e) { /* storage unavailable */ }

  if (bar && !suppressed && !dismissed) {
    // The bar stays `hidden` (display:none — unreachable by keyboard/AT)
    // until the scroll threshold; it never sits focusable-but-offscreen.
    var shown = false;
    // A bar fixed to the bottom of the viewport covers the last band of the
    // page unless the page reserves room for it — that is what was hiding the
    // footer's final link, and it is the footer AUTHORISATION LINE (a legal
    // requirement) directly underneath. So: measure the bar the moment it is
    // on screen and publish its height as --follow-bar-space. global.css pads
    // the footer by it and scroll-pads the document by it, so in-page anchors
    // never land underneath it either. Nothing hardcodes the height, and the
    // reservation exists ONLY while the bar does — with JS off, on the pages
    // that suppress the bar, or once it is dismissed, it stays 0px and there
    // is no wasted band. Adding it only ever extends the very bottom of the
    // document, below all content, so it cannot shift laid-out content (no CLS).
    var root = document.documentElement;
    var reserve = function () {
      var h = bar.offsetHeight;
      if (h) root.style.setProperty('--follow-bar-space', h + 'px');
    };
    var release = function () { root.style.removeProperty('--follow-bar-space'); };
    var gone = false; // dismissed this session — never show or reserve again
    // …and it stands down completely once the FOOTER is on screen. Reserving
    // the bar's height keeps it off the last band of the document, but the
    // footer is ~3 screens tall on a phone, so on the way down the bar still
    // passed over the footer's own navigation: measured on /media at 390×844,
    // a tap in that band hit the bar's Join button instead of the footer link
    // under it ("Our policies", "News", "Enrol to vote", "Terms of use"…).
    // Nothing is lost by parking it there — the footer carries its own Join,
    // Donate and newsletter calls to action, so the reader who has arrived at
    // it already has everything the bar was offering, without an opaque strip
    // over the links. Measured with IntersectionObserver (no layout work on
    // the scroll path); browsers without it keep the previous behaviour.
    var footerIn = false;
    var footerEl = document.getElementById('site-footer');
    var onScroll; // hoisted — the observer below calls it
    if (footerEl && typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        footerIn = entries[entries.length - 1].isIntersecting;
        onScroll();
      }, { threshold: 0 }).observe(footerEl);
    }
    onScroll = function () {
      if (gone) return;
      var shouldShow = window.scrollY > window.innerHeight * 0.9 && !footerIn;
      if (shouldShow === shown) return;
      shown = shouldShow;
      if (shouldShow) {
        bar.hidden = false;
        reserve();
        requestAnimationFrame(function () {
          bar.classList.add('is-visible');
        });
      } else {
        bar.classList.remove('is-visible');
        bar.hidden = true;
        // Parking at the footer KEEPS the reservation. Other blocks reserve
        // against --follow-bar-space too (the footer, and any page that pads a
        // control row by it), so releasing it deep in the document pulls that
        // padding out from under live content: measured on the homepage as
        // 0.0345 CLS and a 130px drop in scrollHeight the moment the footer
        // arrived. The reservation only lets go where nothing can shift —
        // back above the show threshold, or on dismiss.
        if (!footerIn) release();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // The bar reflows (its copy is hidden ≤640px), so re-measure on resize.
    window.addEventListener('resize', function () { if (shown) reserve(); }, { passive: true });
    onScroll();

    var close = document.getElementById('followBarClose');
    if (close) {
      close.addEventListener('click', function () {
        gone = true;
        shown = false;
        bar.classList.remove('is-visible');
        bar.hidden = true;
        release();
        try { sessionStorage.setItem('followBarDismissed', '1'); } catch (e) { /* ignore */ }
        // Keep keyboard focus near the reading position instead of letting
        // the browser drop it back to the top of the document.
        var main = document.getElementById('content');
        if (main) main.focus({ preventScroll: true });
      });
    }
  }
})();

/* Footer newsletter signup */
(function () {
  'use strict';
  var form = document.getElementById('newsletterForm');
  if (!form) return;
  var status = document.getElementById('nlStatus');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = form.querySelector('#nl-email');
    var hp = form.querySelector('input[name="website"]');
    if (hp && hp.value) return;
    if (!email.checkValidity()) { status.textContent = 'Enter a valid email address.'; return; }
    status.textContent = 'Signing you up…';
    try {
      var res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-up failed.');
      status.textContent = "You're on the list — thanks!";
      form.querySelector('button').disabled = true;
      email.disabled = true;
    } catch (err) {
      status.textContent = (err && err.message) || 'Something went wrong. Please try again.';
    }
  });
})();
