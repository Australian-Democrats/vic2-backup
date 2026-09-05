/* press-boot.js — the cinematic homepage's boot script.
 * ===========================================================================
 * Loaded ONLY by `/` and ONLY when the homepage singleton's `variant` is
 * "cinematic" (src/pages/index.astro puts it in the layout's `scripts` slot
 * behind the same switch that chooses the design). It never runs on any other
 * page and it never runs on the classic homepage.
 *
 * SIX JOBS, ALL OF THEM STRUCTURAL. This is the assembly layer, not the motion
 * layer: it decides which device tree is the real one, keeps the accessibility
 * tree honest about that, reveals the page's own chrome now that the shared
 * header is suppressed, opens the menu behind the hamburger, releases the
 * stylesheet's own reveals, and — on desktop only — asks for the motion
 * bundle. Nothing here animates anything itself, and the page is complete
 * without it: no element starts hidden, collapsed or at zero opacity waiting
 * on a script.
 *
 *   1 · html[data-tree]      mobile is the default; desktop is opted into
 *   2 · aria-hidden          moved to whichever tree is NOT rendered
 *   3 · .press-chrome__scrolled  revealed once the hero has been passed
 *   4 · the hamburger        opens/closes the overlay menu, with Esc + focus
 *   5 · press-desktop.js /   the device bundles, dynamically imported so the
 *       press-mobile.js      tree that is not live downloads nothing
 *   6 · [data-press-skip]    shown only when there is a sequence to escape
 *
 * WHY THE DEFAULT IS MOBILE (adjudication C3). With no JavaScript, no
 * `data-tree` attribute is ever set, so `.press-tree--mobile` is the visible
 * one and `.press-tree--desktop` stays `display: none`. A reader with scripts
 * off, and a reader at 400% zoom (which on a 1440px display *is* a 360px
 * viewport), both get the linear experience — the one that always works.
 *
 * ONE BREAKPOINT (adjudication C4). 1024px, min-width, width only, no hover or
 * pointer condition. It is written once here and once in press.css §4, and the
 * two must always say the same thing.
 *
 * HANDOFF — where the motion actually lives. `public/assets/js/press-desktop.js`
 * owns the hero's opening sequence and the scroll spine (GSAP + ScrollTrigger +
 * Lenis). It is imported from §6 below, after `data-tree` has settled, behind
 * all three of the gates that file's header restates. It takes ownership of
 * `[data-press-skip]` the moment it builds the hero timeline. Everything it
 * does is additive: switch it off and this page is still finished.
 */
(function () {
  var doc = document;
  var root = doc.documentElement;

  /* ---------------------------------------------------------------------
     1 + 2 · THE DEVICE TREES
     ---------------------------------------------------------------------
     The markup ships twice and CSS decides which copy is real. The hidden
     copy is `display: none`, so it is out of the accessibility tree on its
     own; the `aria-hidden="true"` the desktop tree also carries is belt and
     braces for the instant before this runs.

     But the moment `data-tree="desktop"` is set, that attribute is on a
     VISIBLE subtree full of links — an axe `aria-hidden-focus` violation,
     where the same attribute on a `display: none` subtree is not. So it
     moves in the same breath, every time, in both directions.
     -------------------------------------------------------------------- */
  var DESKTOP = '(min-width: 1024px)';
  var mq = window.matchMedia(DESKTOP);

  function setTree(isDesktop) {
    if (isDesktop) root.setAttribute('data-tree', 'desktop');
    else root.removeAttribute('data-tree');

    var showing = doc.querySelectorAll(isDesktop ? '.press-tree--desktop' : '.press-tree--mobile');
    var hiding = doc.querySelectorAll(isDesktop ? '.press-tree--mobile' : '.press-tree--desktop');
    var i;
    for (i = 0; i < showing.length; i++) showing[i].removeAttribute('aria-hidden');
    for (i = 0; i < hiding.length; i++) hiding[i].setAttribute('aria-hidden', 'true');
  }

  setTree(mq.matches);

  // addEventListener on a MediaQueryList is the modern form; addListener is the
  // fallback for older Safari. Both are guarded so neither can throw.
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', function (e) {
      setTree(e.matches);
    });
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(function (e) {
      setTree(e.matches);
    });
  }

  /* ---------------------------------------------------------------------
     3 · THE PAGE'S OWN CHROME
     ---------------------------------------------------------------------
     This homepage passes chrome="homepage" to Base.astro, which suppresses
     the shared header — the brief forbids a navigation bar over the hero
     photograph. The page carries its own instead: a masthead inside the hero,
     and this fixed plate, which is in the DOM from first paint at
     `opacity: 0; visibility: hidden` and arrives once the hero has been
     scrolled past. Inserting it later would buy a CLS spike and a no-JS dead
     end, so it is revealed, never created.

     IntersectionObserver on the hero, not a scroll listener: no work happens
     on any frame where nothing crossed the boundary.
     -------------------------------------------------------------------- */
  var chrome = doc.querySelector('[data-press-chrome]');
  var hero = doc.getElementById('press-hero');

  if (chrome && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          chrome.classList.toggle('is-shown', !entries[i].isIntersecting);
        }
      },
      // A sliver of the hero still on screen is still "in the hero".
      { threshold: 0, rootMargin: '-12% 0px 0px 0px' }
    ).observe(hero);
  } else if (chrome) {
    // No observer: show it rather than leave the page with no navigation at all.
    chrome.classList.add('is-shown');
  }

  /* ---------------------------------------------------------------------
     4 · THE HAMBURGER
     ---------------------------------------------------------------------
     A disclosure, not a widget. The overlay is a real element carrying the
     site's own navigation, `hidden` at rest — so with no JavaScript nothing
     inside it is focusable and the document is still correct. Opening it is
     the whole of the behaviour: set the attributes, move focus in, close on
     Esc or on the close button, and put focus back on the trigger.
     -------------------------------------------------------------------- */
  var burger = doc.querySelector('[data-press-burger]');
  var menu = doc.querySelector('[data-press-menu]');

  if (burger && menu) {
    var closer = menu.querySelector('[data-press-menu-close]');

    var openMenu = function () {
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      var first = menu.querySelector('a, button');
      if (first) first.focus();
    };

    var closeMenu = function (returnFocus) {
      menu.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      if (returnFocus) burger.focus();
    };

    burger.addEventListener('click', function () {
      if (menu.hidden) openMenu();
      else closeMenu(true);
    });

    if (closer) {
      closer.addEventListener('click', function () {
        closeMenu(true);
      });
    }

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) closeMenu(true);
    });

    // Following a link inside the overlay leaves the page; closing first means
    // a browser restoring this page from the back/forward cache does not
    // restore it with the menu still open over the hero.
    menu.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a') : null;
      if (link) closeMenu(false);
    });
  }

  /* ---------------------------------------------------------------------
     5 · THE TWO DEVICE BUNDLES — one guard, one import each
     ---------------------------------------------------------------------
     This is the whole of 02 §1.1, and it is the reason the inactive tree
     genuinely downloads nothing: the markup ships twice (accepted, and
     budgeted, adjudication C2) but the JavaScript does not. A phone never
     requests a byte of GSAP; a desktop never requests the mobile fallback.

     DESKTOP — press-desktop.js. THREE CONDITIONS, no fourth, no override:
       1 · ≥1024px            the one breakpoint, width only (adjudication C4)
       2 · html.js-motion     the site's own switch (repo deviation #9)
       3 · not reduced motion adjudication B4 — under `reduce` the bundle is
                              never even REQUESTED, so Lenis is never
                              constructed, no ScrollTrigger ever exists, and
                              the page is exactly the static document.

     MOBILE — press-mobile.js, which owns the `.is-inview` fallback for the
     phone tree and gates itself four ways (it stands down entirely where CSS
     `animation-timeline: view()` exists). It is imported, not <script>-tagged,
     for the same reason: below 1024px is the only place it is any use.
     IF A <script src="/assets/js/press-mobile.js"> IS EVER ADDED to the page,
     DELETE THIS IMPORT rather than keeping both — two copies would arm two
     observers over the same register.

     `import()` inside a classic script is a real dynamic import (it returns a
     promise; there is no top-level await to be had here, and none is needed).
     Both failures are caught, because a network hiccup fetching an additive
     layer must never leave the finished page in a promised-something state.

     DECIDED ONCE, AT LOAD, and deliberately not re-decided when the viewport
     later crosses 1024px. The TREES must switch on a resize (§1 above does
     that, and must) but starting a 4.8-second opening sequence underneath a
     reader who is already halfway down the page is worse than leaving them the
     static document. Crossing the breakpoint the other way is handled properly:
     gsap.matchMedia() inside the desktop bundle reverts every transform it
     ever wrote, so a narrowed window is never left wearing desktop motion.
     -------------------------------------------------------------------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motion = root.classList.contains('js-motion') && !reduced;
  var desktopIntro = mq.matches && motion;

  /* ---------------------------------------------------------------------
     6 · THE SKIP CONTROL — WCAG 2.2.2, and an honest one
     ---------------------------------------------------------------------
     `[data-press-skip]` is the way out of the hero's opening sequence. Its
     stylesheet shows it whenever `html.js-motion` is set, which effects.js
     does on every page of this site — so on a page with no sequence layered
     on it, it would be a visible button that does nothing. WCAG 2.2.2 asks
     for a way to stop moving content; it does not ask for a button, and a
     control that looks interactive and is not is worse than no control.

     So it is hidden unless a sequence is actually coming, and press-desktop.js
     takes it back (`skip.style.display = ''`) as it builds the timeline. That
     handshake is documented at both ends and nowhere else.
     -------------------------------------------------------------------- */
  var skip = doc.querySelector('[data-press-skip]');

  if (desktopIntro) {
    root.setAttribute('data-press-intro', '');
    import('/assets/js/press-desktop.js')['catch'](function () {
      /* The bundle did not load — offline, a cache miss, a CSP change. The
         page is complete without it, so the repair is only to undo the two
         promises made on its behalf: hide the escape hatch that now has
         nothing to escape, and print the gold underrule press.css §16
         collapsed in expectation of a motion layer that never arrived. */
      root.removeAttribute('data-press-intro');
      if (skip) skip.style.display = 'none';
      var held = doc.querySelectorAll('.press-tree--desktop .press-btn--primary');
      for (var h = 0; h < held.length; h++) held[h].classList.add('is-inview');
    });
  } else if (!mq.matches && motion) {
    import('/assets/js/press-mobile.js')['catch'](function () {
      /* Nothing to repair. press-mobile.css hides nothing until that file sets
         html[data-press-reveal="io"], so its absence is a finished page. */
    });
  }

  if (skip && !root.hasAttribute('data-press-intro')) skip.style.display = 'none';
})();
