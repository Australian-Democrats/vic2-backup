/* The /events construction page, made playable.
 *
 * The page's whole point is that the board is not up yet. So the reader gets to
 * put it up: tap an empty slot and a panel goes in. Fill the board and the line
 * lands — the panels are blank because it is members who put dates on them.
 *
 * PROGRESSIVE, NOT REQUIRED. The HTML ships the composed, honest picture: a
 * half-built board, two panels of six already in place. This file UPGRADES the
 * empty slots into real buttons. With no JS there are no buttons, because a
 * control that looks interactive and is not is worse than no control at all.
 *
 * Motion is gated on html.js-motion (the site's own switch) AND on
 * prefers-reduced-motion. With motion off the panels still go up — the state
 * change is the content, the easing is the decoration.
 */
(function () {
  var doc = document;
  var root = doc.getElementById('evcBuild');
  if (!root) return;

  var board = root.querySelector('.evc-board');
  var counter = root.querySelector('[data-build-count]');
  var totalEl = root.querySelector('[data-build-total]');
  var payoff = root.querySelector('[data-build-payoff]');
  var reset = root.querySelector('[data-build-reset]');
  var live = root.querySelector('[data-build-status]');
  if (!board) return;

  var motionOK =
    doc.documentElement.classList.contains('js-motion') &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var panels = [].slice.call(board.querySelectorAll('.evc-panel'));
  if (!panels.length) return;
  var total = panels.length;

  function say(msg) {
    if (live) live.textContent = msg;
  }

  function up(btn) {
    return btn.getAttribute('aria-pressed') === 'true';
  }

  function paint() {
    var taken = panels.filter(up).length;
    if (counter) counter.textContent = String(taken);
    if (totalEl) totalEl.textContent = String(total);
    root.setAttribute('data-build-filled', taken === total ? 'all' : taken ? 'some' : 'none');
    // The real `hidden` attribute, so the payoff is out of the accessibility
    // tree — not merely off screen — until it is true.
    if (payoff) payoff.hidden = taken !== total;
    // Nothing to start again from until something has been done.
    if (reset) reset.hidden = taken === 0;
    // The accessible name has to keep telling the truth as the count moves.
    panels.forEach(function (b, i) {
      b.setAttribute(
        'aria-label',
        up(b)
          ? 'Panel ' + (i + 1) + ' of ' + total + ' — up. Take it down again'
          : 'Panel ' + (i + 1) + ' of ' + total + ' — put a panel up here'
      );
    });
    return taken;
  }

  panels.forEach(function (panel, i) {
    // The panel element itself becomes the control — it is already the right
    // shape and size, and wrapping a button around it would double the box.
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = panel.className + ' evc-panel-btn';
    btn.setAttribute('aria-pressed', panel.classList.contains('is-up') ? 'true' : 'false');
    btn.setAttribute('data-testid', 'ev-build-panel-' + (i + 1));
    btn.style.cssText = panel.style.cssText;
    btn.innerHTML = panel.innerHTML;
    // The shipped panel is aria-hidden because a blank rectangle says nothing.
    // A BUTTON says something, so the attribute must not travel with it — and
    // it never sits inside an aria-hidden ancestor, which would leave a
    // focusable control that screen readers cannot see.
    btn.removeAttribute('aria-hidden');
    btn.addEventListener('click', function () {
      var nowUp = !up(btn);
      btn.setAttribute('aria-pressed', nowUp ? 'true' : 'false');
      btn.classList.toggle('is-up', nowUp);
      if (nowUp && motionOK) {
        btn.classList.remove('just-up');
        // Force a reflow so re-adding the class restarts the one-shot.
        void btn.offsetWidth;
        btn.classList.add('just-up');
      }
      var taken = paint();
      say(
        taken === total
          ? 'The board is full. ' + total + ' of ' + total + ' panels up.'
          : taken + ' of ' + total + ' panels up.'
      );
      if (nowUp && motionOK && navigator.vibrate) navigator.vibrate(8);
    });
    panel.parentNode.replaceChild(btn, panel);
  });

  // Re-read the panels now they are buttons.
  panels = [].slice.call(board.querySelectorAll('.evc-panel-btn'));

  if (reset) {
    reset.addEventListener('click', function () {
      panels.forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
        b.classList.remove('is-up', 'just-up');
      });
      paint();
      say('Board cleared.');
      var first = panels[0];
      if (first) first.focus();
    });
  }

  root.setAttribute('data-build-live', 'true');
  paint();
})();
