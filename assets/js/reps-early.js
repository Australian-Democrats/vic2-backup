/* The "you're early" chamber, made playable.
 *
 * The page's whole point is that these desks are empty because the election has
 * not happened yet. So the reader gets to fill them: tap a desk, someone sits
 * down and their nameplate gets written. Fill the chamber and the line lands —
 * that is what it looks like when people show up.
 *
 * PROGRESSIVE, NOT REQUIRED. The HTML ships the composed, honest picture: an
 * empty chamber with one reserved desk. This file UPGRADES the empty desks into
 * real buttons. With no JS there are no buttons, because a control that looks
 * interactive and is not is worse than no control at all.
 *
 * Motion is gated on html.js-motion (the site's own switch) AND on
 * prefers-reduced-motion. With motion off the seats still fill — the state
 * change is the content; the easing is the decoration.
 */
(function () {
  var doc = document;
  var root = doc.getElementById('repEarly');
  if (!root) return;

  var arc = root.querySelector('.rep-chamber-arc');
  var counter = root.querySelector('[data-early-count]');
  var payoff = root.querySelector('[data-early-payoff]');
  var reset = root.querySelector('[data-early-reset]');
  var live = root.querySelector('[data-early-status]');
  if (!arc) return;

  var motionOK =
    doc.documentElement.classList.contains('js-motion') &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Only the blank desks are seats. The reserved one is spoken for.
  var seats = [].slice.call(arc.querySelectorAll('.rep-desk:not(.rep-desk--centre)'));
  if (!seats.length) return;

  // THE TOTAL IS WHAT IS ON SCREEN, NOT WHAT IS IN THE DOM. Below 480px the arc
  // drops its outermost desks with display:none, so two of the six seats are
  // unreachable — and a payoff gated on "all six" could never fire on a phone,
  // which is the width most people will see this at. Count only rendered seats,
  // and recount on resize so rotating the phone cannot strand the reader one
  // seat short of a line that never comes.
  function onScreen(el) {
    return el.offsetParent !== null;
  }
  function shown() {
    return seats.filter(onScreen);
  }
  var total = 0;
  var taken = 0;

  // Deterministic, so the chamber fills with a recognisable spread of people
  // rather than the same silhouette six times. Values are head size and
  // shoulder spread, matching the vocabulary the candidates search band uses.
  var BUILD = [
    { h: 20, s: 62 },
    { h: 22, s: 58 },
    { h: 19, s: 66 },
    { h: 21, s: 60 },
    { h: 23, s: 64 },
    { h: 20, s: 57 },
  ];

  function say(msg) {
    if (live) live.textContent = msg;
  }

  function paint() {
    var vis = shown();
    total = vis.length;
    taken = vis.filter(function (b) {
      return b.getAttribute('aria-pressed') === 'true';
    }).length;
    if (counter) counter.textContent = String(taken);
    var totalEl = root.querySelector('[data-early-total]');
    if (totalEl) totalEl.textContent = String(total);
    root.setAttribute('data-early-filled', total && taken === total ? 'all' : taken ? 'some' : 'none');
    if (reset) reset.hidden = taken === 0;
    if (payoff) payoff.hidden = !total || taken !== total;
    // The name has to keep telling the truth as the arc narrows.
    vis.forEach(function (b, i) {
      b.setAttribute('aria-label', 'Seat ' + (i + 1) + ' of ' + total + ' \u2014 sit someone here');
    });
  }

  function seat(btn, i, quiet) {
    if (btn.getAttribute('aria-pressed') === 'true') return;
    btn.setAttribute('aria-pressed', 'true');
    var b = BUILD[i % BUILD.length];
    btn.style.setProperty('--fh', b.h + '%');
    btn.style.setProperty('--fs', b.s + '%');
    paint();
    if (!quiet) {
      say(
        taken === total
          ? 'Every seat taken. ' + total + ' of ' + total + '.'
          : taken + ' of ' + total + ' seats taken.'
      );
    }
  }

  function empty(btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.style.removeProperty('--fh');
    btn.style.removeProperty('--fs');
  }

  seats.forEach(function (desk, i) {
    // The desk element itself becomes the control — it is already the right
    // shape and size, and wrapping a button around it would double the box.
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = desk.className + ' rep-desk--seatable';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('data-testid', 'rep-early-seat-' + (i + 1));
    btn.style.cssText = desk.style.cssText;
    btn.innerHTML = desk.innerHTML + '<span class="rep-desk-person" aria-hidden="true"></span>';
    // The accessible name says what pressing it does, not what it looks like.
    btn.setAttribute('aria-label', 'Seat ' + (i + 1) + ' of ' + total + ' — sit someone here');
    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-pressed') === 'true') {
        empty(btn);
        paint();
        say(taken + ' of ' + total + ' seats taken.');
        return;
      }
      seat(btn, i);
      if (motionOK && navigator.vibrate) navigator.vibrate(8);
    });
    desk.parentNode.replaceChild(btn, desk);
  });

  // Re-read the seats now they are buttons.
  seats = [].slice.call(arc.querySelectorAll('.rep-desk--seatable'));

  // A FOCUSABLE CONTROL MUST NOT SIT INSIDE AN aria-hidden SUBTREE. The chamber
  // ships aria-hidden because a scene of blank desks says nothing the copy does
  // not — but the moment those desks become real buttons it says plenty, and
  // leaving the attribute on the ancestor produces exactly the artefact this
  // page is meant to avoid: six controls a keyboard can reach and a screen
  // reader cannot see. So the attribute comes off HERE, in the JS path only —
  // with no script there are no buttons and the scene stays correctly hidden.
  // The floor keeps its own, being pure decoration.
  var chamber = arc.closest ? arc.closest('[aria-hidden="true"]') : null;
  if (chamber) chamber.removeAttribute('aria-hidden');
  var floor = root.querySelector('.rep-chamber-floor');
  if (floor) floor.setAttribute('aria-hidden', 'true');

  if (reset) {
    reset.addEventListener('click', function () {
      seats.forEach(empty);
      paint();
      say('Chamber cleared.');
      var first = seats[0];
      if (first) first.focus();
    });
  }

  root.setAttribute('data-early-live', 'true');
  paint();

  // Recount when the arc changes width — below 480px it drops its outermost
  // desks, so the total and the tally must follow.
  var rt;
  window.addEventListener('resize', function () {
    window.clearTimeout(rt);
    rt = window.setTimeout(paint, 150);
  });

  // A single unprompted nudge, once, when the chamber first comes into view:
  // one seat fills so the reader can see that the desks are things you can do
  // something with. Only with motion on — with motion off nothing should move
  // on its own. It is undoable like any other seat.
  if (motionOK && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.disconnect();
          window.setTimeout(function () {
            var vis = shown();
            if (taken === 0 && vis.length) {
              var i = Math.floor(vis.length / 2);
              seat(vis[i], i, true);
            }
          }, 900);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(arc);
  }
})();
