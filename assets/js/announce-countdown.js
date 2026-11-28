/* The announcement countdown (ADR-83) — src/components/CountdownPage.astro,
   styles in src/styles/countdown.css.

   Progressive enhancement only. Without this file the page is the heading,
   when it opens and the buttons — true on its own. The clock, the readout and
   its keys are `hidden` until this runs, because a clock that is not running
   is a wrong one.

   What it does:
   · counts down to the page's target instant (data-acd-target, epoch ms)
     against the SERVER's clock where it can learn it (the Date header of the
     status file), so a phone whose clock is a minute out still shows the
     right time left;
   · draws the station clock: hands on Melbourne time (or the reader's own), a
     yellow highlighter wedge for the minutes still to run in this hour,
     highlighter dabs on the hours still to strike, a ring round the hour it
     counts to. The minute hand's yellow knob is a slider: wind the clock on
     (drag, or arrow keys / Page Up / Home / End) and it springs back to now;
   · till keys switch the readout between hours, minutes and seconds, and the
     face between Melbourne and the reader's own time; "Pause the clock" stops
     the face and the readout updating (WCAG 2.2.2) — the page still opens by
     itself when the real one is live;
   · asks /announce-status.json about the build that is live. Once it lists
     this address under `live` — the real page is in the build — the clock
     winds itself on to the hour, the stamp thunks down, and the page opens.
     That can happen before the clock reaches zero (count to 7:00, live at
     6:50 — the party's choice), and the page says so: "We've wound the clock
     on 6 minutes." An address that merely stops counting down (the countdown
     switched off, the content unpublished) launches nothing; one whose time
     moved reloads into the new countdown. If the status cannot be read
     (offline, an error page, a login screen), nothing happens: it never
     launches on a guess, and at zero it says "any moment now".

   Nothing here knows, or can reveal, anything held back: the page carries
   none of it. Screen readers get the time left on demand (role="timer",
   minute granularity) and a polite line at milestones — never every second.
   Reduced motion: no tweens, no spring, no paste-in, a ticking second hand. */
(function () {
  'use strict';

  var root = document.querySelector('[data-acd]');
  if (!root) return;
  var TARGET = Number(root.getAttribute('data-acd-target'));
  if (!isFinite(TARGET) || TARGET <= 0) return;
  var PATH = root.getAttribute('data-acd-path') || location.pathname;
  var PAGE_WORD = root.getAttribute('data-acd-page-word') || 'the page';
  var DIVISION = (root.getAttribute('data-acd-division') || '').toUpperCase();
  var MEL = 'Australia/Melbourne';
  var NS = 'http://www.w3.org/2000/svg';
  var svg = root.querySelector('[data-acd-svg]');
  if (!svg || !window.Intl || !Intl.DateTimeFormat) return;

  var q = function (s) { return root.querySelector(s); };
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { reduce = e.matches; });

  // ---------------------------------------------------------------------
  // Time. `skew` = the server's clock minus this device's, learnt from the
  // status file's Date header (1-second resolution, so a difference under
  // ~1.5 s is left alone rather than made jittery).
  // ---------------------------------------------------------------------
  var skew = 0;
  var bestRtt = Infinity;
  function now() { return Date.now() + skew; }
  function learnSkew(header, t0, t1) {
    var server = Date.parse(header || '');
    if (!isFinite(server)) return;
    var rtt = t1 - t0;
    if (rtt > 5000 || rtt > bestRtt) return;
    bestRtt = rtt;
    var est = server + 500 - (t0 + t1) / 2;
    skew = Math.abs(est) > 1500 ? est : 0;
  }

  // ---------------------------------------------------------------------
  // Zones (Web APIs only).
  // ---------------------------------------------------------------------
  var visitorTz = 'UTC';
  try { visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { visitorTz = 'UTC'; }
  var partFmt = {};
  function tzOffset(tz, ms) {
    var f = partFmt[tz];
    if (!f) {
      try {
        f = partFmt[tz] = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
      } catch (e) {
        return 0;
      }
    }
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUTC - Math.floor(ms / 1000) * 1000;
  }
  var offCache = { key: '', val: 0 };
  function offsetFor(tz, ms) {
    var key = tz + '|' + Math.floor(ms / 60000);
    if (offCache.key !== key) { offCache.key = key; offCache.val = tzOffset(tz, ms); }
    return offCache.val;
  }
  function zoneAbbr(tz) {
    try {
      var p = new Intl.DateTimeFormat('en-AU', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(TARGET));
      for (var i = 0; i < p.length; i++) if (p[i].type === 'timeZoneName') return p[i].value;
    } catch (e) { /* fall through */ }
    return '';
  }
  function cityOf(tz) { return /^(Etc\/)?(UTC|GMT)$/.test(tz) ? 'UTC' : tz.split('/').pop().replace(/_/g, ' '); }
  var timeFmt = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true });
  function wallTime(wallMs) { return timeFmt.format(new Date(wallMs)).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase(); }
  function dayOf(tz) { return new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(TARGET)); }

  var ZONES = {
    mel: { tz: MEL, city: 'Melbourne', abbr: zoneAbbr(MEL) },
    local: { tz: visitorTz, city: cityOf(visitorTz), abbr: zoneAbbr(visitorTz) },
  };
  var sameAsMel = tzOffset(visitorTz, TARGET) === tzOffset(MEL, TARGET);
  var zoneLocalBtn = q('[data-acd-zonelocal]');
  if (zoneLocalBtn) {
    zoneLocalBtn.textContent = sameAsMel ? 'Your time (same)' : 'Your time · ' + ZONES.local.city;
    zoneLocalBtn.setAttribute('aria-label', 'Your time, ' + ZONES.local.city + (sameAsMel ? ', the same as Melbourne' : ''));
  }

  // ---------------------------------------------------------------------
  // The face: a printed object — paper face, ink ring, offset ink shadow with
  // a sand misregistration gap, a hanging station bracket.
  // ---------------------------------------------------------------------
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  var CX = 205, CY = 245;
  function pt(deg, r) { return [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)]; }

  var deco = el('g', { 'aria-hidden': 'true' }, svg);
  el('rect', { x: 197, y: 10, width: 16, height: 70, fill: 'var(--ink)' }, deco);
  el('rect', { x: 172, y: 2, width: 66, height: 14, rx: 3, fill: 'var(--yellow)', stroke: 'var(--ink)', 'stroke-width': 2.5 }, deco);

  var g = el('g', { transform: 'translate(' + CX + ' ' + CY + ')' }, svg);
  var face = el('g', { 'aria-hidden': 'true' }, g);
  el('circle', { cx: 9, cy: 9, r: 180, fill: 'var(--ink)' }, face);
  el('circle', { r: 182, fill: 'none', stroke: 'var(--sand)', 'stroke-width': 4 }, face);
  el('circle', { r: 180, fill: 'var(--ink)' }, face);
  el('circle', { r: 164, fill: 'var(--paper)' }, face);
  var wedge = el('path', { fill: 'var(--yellow)', d: '' }, face);
  var dabs = [];
  var i;
  for (i = 1; i <= 12; i++) {
    var jitter = (((i * 7) % 5) - 2) * 1.1;
    dabs[i] = el('rect', { x: -10, y: -165, width: 20, height: 33, rx: 4, fill: 'var(--yellow)', transform: 'rotate(' + (i * 30 + jitter) + ')', visibility: 'hidden' }, face);
  }
  for (var m = 0; m < 60; m++) {
    var hourTick = m % 5 === 0;
    var a1 = pt(m * 6, hourTick ? 138 : 152), a2 = pt(m * 6, 160);
    el('line', { x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1], stroke: 'var(--ink)', 'stroke-width': hourTick ? 6.5 : 2.2, 'stroke-linecap': 'butt' }, face);
  }
  for (i = 1; i <= 12; i++) {
    var np = pt(i * 30, 109);
    el('text', { x: np[0], y: np[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'acd-num' }, face).textContent = String(i);
  }
  el('text', { x: 0, y: -60, 'text-anchor': 'middle', class: 'acd-maker' }, face).textContent = 'DEMOCRATS';
  if (DIVISION) el('text', { x: 0, y: -45, 'text-anchor': 'middle', class: 'acd-maker-sub' }, face).textContent = DIVISION;
  var cityText = el('text', { x: 0, y: 58, 'text-anchor': 'middle', class: 'acd-city' }, face);
  var abbrText = el('text', { x: 0, y: 74, 'text-anchor': 'middle', class: 'acd-zone-abbr' }, face);
  var notch = el('polygon', { points: '-9,-180 9,-180 0,-166', fill: 'var(--yellow)', stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, face);
  var tringG = el('g', {}, face);
  var tring = el('ellipse', { class: 'acd-tring', rx: 24, ry: 20, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-dasharray': '120 14', 'stroke-linecap': 'round' }, tringG);

  var hourHand = el('polygon', { points: '-7,24 7,24 5,-90 -5,-90', fill: 'var(--ink)', 'aria-hidden': 'true' }, g);
  var minHand = el('g', {
    class: 'acd-minhand', tabindex: '0', role: 'slider', 'aria-label': 'Wind the clock on',
    'aria-describedby': 'acdHint', 'aria-valuemin': '0', 'aria-orientation': 'horizontal',
  }, g);
  el('line', { x1: 0, y1: 24, x2: 0, y2: -156, stroke: 'transparent', 'stroke-width': 34, 'pointer-events': 'stroke' }, minHand);
  el('polygon', { points: '-5,30 5,30 3.2,-150 -3.2,-150', fill: 'var(--ink)' }, minHand);
  el('circle', { cy: -122, r: 24, fill: 'transparent', 'pointer-events': 'all' }, minHand);
  el('circle', { cy: -122, r: 12, fill: 'var(--yellow)', stroke: 'var(--ink)', 'stroke-width': 3 }, minHand);
  el('circle', { class: 'acd-fring', cy: -122, r: 19.5, fill: 'none', stroke: 'var(--teal-ink)', 'stroke-width': 3, 'stroke-dasharray': '5 3' }, minHand);
  var secHand = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }, g);
  el('line', { x1: 0, y1: 36, x2: 0, y2: -118, stroke: 'var(--teal)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, secHand);
  el('circle', { cy: -101, r: 11, fill: 'var(--teal)', stroke: 'var(--teal-ink)', 'stroke-width': 1.5 }, secHand);
  el('circle', { r: 8.5, fill: 'var(--ink)', 'pointer-events': 'none', 'aria-hidden': 'true' }, g);
  el('circle', { r: 3.2, fill: 'var(--teal)', 'pointer-events': 'none', 'aria-hidden': 'true' }, g);

  function wedgePath(a0, sweep, r) {
    if (sweep <= 0.05) return '';
    if (sweep >= 359.95) return 'M0 ' + -r + ' A' + r + ' ' + r + ' 0 1 1 0 ' + r + ' A' + r + ' ' + r + ' 0 1 1 0 ' + -r + ' Z';
    var p0 = pt(a0, r), p1 = pt(a0 + sweep, r);
    return 'M0 0 L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (sweep > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' Z';
  }

  // ---------------------------------------------------------------------
  // State.
  // ---------------------------------------------------------------------
  var zoneKey = 'mel';
  var unit = 'hms';
  var paused = false;
  var launched = false;
  var windOff = 0; // minutes wound ahead of now (display only)
  var dragging = false, springing = false, springV = 0, lastAngle = 0;
  var keyIdle = 0;
  var faceFrozen = false; // after launch the face holds the hour it counted to
  var minTween = null, lastMinFloor = null;
  var lastRoHtml = '', lastSr = '', lastRem = null;
  var zero = false;
  var wound = 0;

  var sayEl = q('[data-acd-say]');
  function say(msg) {
    if (!sayEl) return;
    sayEl.textContent = '';
    setTimeout(function () { sayEl.textContent = msg; }, 60);
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function durWords(totalSec, withSecs) {
    var d = Math.floor(totalSec / 86400), h = Math.floor((totalSec % 86400) / 3600), mi = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    var out = [];
    if (d) out.push(plural(d, 'day'));
    if (h) out.push(plural(h, 'hour'));
    if (mi || (!d && !h && !withSecs)) out.push(plural(mi, 'minute'));
    if (withSecs && (s || !out.length)) out.push(plural(s, 'second'));
    return out.join(', ');
  }
  function durShort(min) {
    var mm = Math.max(0, Math.round(min));
    var h = Math.floor(mm / 60), r = mm % 60;
    return h ? h + ' h ' + r + ' min' : r + ' min';
  }

  // ---------------------------------------------------------------------
  // Face rendering.
  // ---------------------------------------------------------------------
  function faceState(nowMs) {
    var z = ZONES[zoneKey];
    var wall = nowMs + offsetFor(z.tz, nowMs);
    var targetWall = TARGET + tzOffset(z.tz, TARGET);
    var minFloor = Math.floor(wall / 60000) * 60000;
    var disp = faceFrozen ? targetWall : minFloor + windOff * 60000;
    return { z: z, wall: wall, targetWall: targetWall, minFloor: minFloor, disp: disp };
  }

  function drawFace(nowMs) {
    var st = faceState(nowMs);
    var minAngleTrue = ((st.disp / 60000) % 60) * 6;
    var hourAngle = ((st.disp / 3600000) % 12) * 30;
    var winding = dragging || springing || windOff !== 0 || faceFrozen;

    // A station clock's minute jump, with a thunk of overshoot (motion only).
    var minAngle = minAngleTrue;
    if (!winding && lastMinFloor !== null && st.minFloor !== lastMinFloor && !reduce) {
      minTween = { from: ((lastMinFloor / 60000) % 60) * 6, to: minAngleTrue, t0: performance.now() };
    }
    lastMinFloor = st.minFloor;
    if (minTween && !winding) {
      var p = Math.min(1, (performance.now() - minTween.t0) / 260);
      var to = minTween.to;
      if (to < minTween.from) to += 360;
      var c1 = 1.9, c3 = c1 + 1;
      var e = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      minAngle = minTween.from + (to - minTween.from) * e;
      if (p >= 1) minTween = null;
    } else if (winding) {
      minTween = null;
    }

    // The second hand: a Swiss "stop-to-go" — sweeps in 58.5 s, rests at 12.
    var s = (((st.wall % 60000) + 60000) % 60000) / 1000;
    var secAngle;
    if (faceFrozen || dragging) secAngle = 0;
    else if (reduce) secAngle = Math.floor(s) * 6;
    else secAngle = Math.min(s / 58.5, 1) * 360;

    hourHand.setAttribute('transform', 'rotate(' + hourAngle.toFixed(3) + ')');
    minHand.setAttribute('transform', 'rotate(' + minAngle.toFixed(3) + ')');
    secHand.setAttribute('transform', 'rotate(' + secAngle.toFixed(3) + ')');

    // The highlighter wedge: the minutes still to run in this hour; in the
    // very last minute it switches to the seconds and floods the face.
    var remFaceMin = (st.targetWall - st.disp) / 60000;
    var realRem = TARGET - nowMs;
    var d = '';
    if (!winding && realRem > 0 && realRem <= 60000) {
      d = wedgePath(secAngle % 360, secAngle >= 359.99 ? 0 : 360 - secAngle, 132);
    } else if (remFaceMin > 0.001) {
      var wm = remFaceMin % 60;
      if (wm < 0.001) wm = 60;
      d = wedgePath(minAngleTrue, wm * 6, 132);
    }
    wedge.setAttribute('d', d);

    // Highlighter dabs on the hours still to strike before it.
    var H = (st.disp / 3600000) % 12;
    var R = remFaceMin / 60;
    for (var k = 1; k <= 12; k++) {
      var dist = (((k - H) % 12) + 12) % 12;
      var lit = R >= 12 || (dist > 1e-6 && dist <= R + 1e-6);
      dabs[k].setAttribute('visibility', lit ? 'visible' : 'hidden');
    }

    // The ring round the hour it counts to, the notch at its minute.
    var tH = (st.targetWall / 3600000) % 12;
    var rp = pt(tH * 30, 109);
    tringG.setAttribute('transform', 'translate(' + rp[0].toFixed(2) + ' ' + rp[1].toFixed(2) + ') rotate(-12)');
    notch.setAttribute('transform', 'rotate(' + (((st.targetWall / 60000) % 60) * 6).toFixed(2) + ')');

    cityText.textContent = st.z.city.toUpperCase();
    abbrText.textContent = (st.z.abbr || '').toUpperCase();
  }

  // ---------------------------------------------------------------------
  // The readout.
  // ---------------------------------------------------------------------
  var roRow = q('[data-acd-row]');
  var roText = q('[data-acd-rotext]');
  var readout = q('[data-acd-readout]');
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function digits(str) {
    return String(str).split('').map(function (c) {
      return c === ',' ? '<span class="acd-ro-comma">,</span>' : '<span class="acd-ro-d">' + c + '</span>';
    }).join('');
  }
  function grp(num, label) { return '<span class="acd-ro-g"><span class="acd-ro-n">' + digits(num) + '</span><span class="acd-ro-u">' + label + '</span></span>'; }
  var SEP = '<span class="acd-ro-sep">:</span>';
  function drawReadout(remSec) {
    var d = Math.floor(remSec / 86400), h = Math.floor((remSec % 86400) / 3600), mi = Math.floor((remSec % 3600) / 60), s = remSec % 60;
    var html;
    if (unit === 'hms') {
      html = (d ? grp(String(d), d === 1 ? 'day' : 'days') + '<span class="acd-ro-sep">&middot;</span>' : '') +
        grp(pad2(h), 'hours') + SEP + grp(pad2(mi), 'minutes') + SEP + grp(pad2(s), 'seconds');
    } else if (unit === 'min') {
      html = grp(Math.floor(remSec / 60).toLocaleString('en-AU'), 'minutes') + SEP + grp(pad2(s), 'seconds');
    } else {
      html = grp(remSec.toLocaleString('en-AU'), 'seconds');
    }
    if (html !== lastRoHtml) { roRow.innerHTML = html; lastRoHtml = html; }
    readout.classList.toggle('has-days', unit === 'hms' && d > 0);
    readout.classList.toggle('is-final', remSec > 0 && remSec <= 600 && !launched);
    // Minute granularity for screen readers (seconds only in the last two).
    var sr = remSec > 0 ? durWords(remSec, remSec < 120) + ' to go' : 'Any moment now';
    if (sr !== lastSr) { roText.textContent = sr; lastSr = sr; }
  }

  // ---------------------------------------------------------------------
  // Winding (pointer + keyboard) and the spring back to now.
  // ---------------------------------------------------------------------
  var hint = q('[data-acd-hint]');
  var HINT = hint ? hint.innerHTML : '';
  function maxWind(nowMs) {
    var st = faceState(nowMs);
    return Math.max(0, (st.targetWall - st.minFloor) / 60000);
  }
  function svgAngle(ev) {
    var mtx = svg.getScreenCTM();
    if (!mtx) return lastAngle;
    var pnt = svg.createSVGPoint();
    pnt.x = ev.clientX;
    pnt.y = ev.clientY;
    pnt = pnt.matrixTransform(mtx.inverse());
    return ((Math.atan2(pnt.x - CX, -(pnt.y - CY)) * 180) / Math.PI + 360) % 360;
  }
  var lastUi = '';
  function updateWindUi(nowMs) {
    var max = maxWind(nowMs);
    var st = faceState(nowMs);
    var remMin = (st.targetWall - st.disp) / 60000;
    var on = Math.max(0, windOff); // the spring overshoots below zero; never say so
    var html, text;
    if (launched) {
      html = wound > 0 ? 'We wound it on for you.' : 'On the hour.';
      text = 'Wound on to ' + wallTime(st.targetWall);
    } else if (max <= 0) {
      html = 'It’s <b>' + wallTime(st.minFloor) + '</b> — the page opens any moment now.';
      text = 'It is ' + wallTime(st.minFloor) + '. The page opens any moment now';
    } else if (on < 0.5) {
      html = HINT;
      text = 'Now, ' + wallTime(st.minFloor) + '. ' + durWords(Math.max(0, Math.floor((TARGET - nowMs) / 60000)) * 60, false) + ' to go';
    } else if (on >= max - 0.01) {
      html = 'Wound right on to <b>' + wallTime(st.targetWall) + '</b>. That’s the moment.';
      text = 'Wound on to ' + wallTime(st.targetWall) + ', the moment itself';
    } else {
      html = 'Wound on <b>' + durShort(on) + '</b> to ' + wallTime(st.disp) + ' · ' + durShort(remMin) + ' still to go';
      text = 'Wound on ' + durWords(Math.round(on) * 60, false) + ': ' + wallTime(st.disp) + ', ' + durWords(Math.max(0, Math.round(remMin)) * 60, false) + ' to go';
    }
    // Written only when something changed — not every frame, so a focused
    // slider is not re-announced while the spring settles.
    var key = html + '|' + text + '|' + Math.round(max) + '|' + Math.round(on);
    if (key === lastUi) return;
    lastUi = key;
    hint.innerHTML = html;
    minHand.setAttribute('aria-valuemax', String(Math.round(max)));
    minHand.setAttribute('aria-valuenow', String(Math.round(on)));
    minHand.setAttribute('aria-valuetext', text);
  }
  function startSpring() {
    if (reduce) { windOff = 0; springing = false; return; }
    springing = true;
    springV = 0;
  }
  minHand.addEventListener('pointerdown', function (ev) {
    if (launched) return;
    ev.preventDefault();
    if (minHand.setPointerCapture) minHand.setPointerCapture(ev.pointerId);
    dragging = true;
    springing = false;
    minHand.classList.add('is-dragging');
    lastAngle = svgAngle(ev);
    try { minHand.focus({ preventScroll: true }); } catch (e) { /* old engines */ }
  });
  minHand.addEventListener('pointermove', function (ev) {
    if (!dragging) return;
    var a = svgAngle(ev);
    var delta = a - lastAngle;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    lastAngle = a;
    windOff = Math.min(maxWind(now()), Math.max(0, windOff + delta / 6));
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    minHand.classList.remove('is-dragging');
    startSpring();
  }
  minHand.addEventListener('pointerup', endDrag);
  minHand.addEventListener('pointercancel', endDrag);
  minHand.addEventListener('lostpointercapture', endDrag);
  var STEPS = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
  minHand.addEventListener('keydown', function (ev) {
    if (launched) return;
    var max = maxWind(now());
    var step = STEPS[ev.key];
    var handled = true;
    if (step !== undefined) windOff = Math.round(windOff) + step * (ev.shiftKey ? 5 : 1);
    else if (ev.key === 'Home') windOff = 0;
    else if (ev.key === 'End') windOff = max;
    else if (ev.key === 'Escape') startSpring();
    else handled = false;
    if (!handled) return;
    ev.preventDefault();
    if (ev.key !== 'Escape') {
      springing = false;
      windOff = Math.min(max, Math.max(0, windOff));
    }
    clearTimeout(keyIdle);
    keyIdle = setTimeout(startSpring, 6000);
    updateWindUi(now());
  });
  minHand.addEventListener('blur', function () {
    if (!dragging && windOff !== 0) { clearTimeout(keyIdle); startSpring(); }
  });

  // ---------------------------------------------------------------------
  // Controls.
  // ---------------------------------------------------------------------
  function setPressed(attr, val) {
    root.querySelectorAll('[' + attr + ']').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val));
    });
  }
  root.querySelectorAll('[data-acd-unit]').forEach(function (b) {
    b.addEventListener('click', function () {
      unit = b.getAttribute('data-acd-unit');
      setPressed('data-acd-unit', unit);
      lastRoHtml = '';
      render();
    });
  });
  var localLine = q('[data-acd-local]');
  function updateLocalLine() {
    if (!localLine) return;
    if (zoneKey !== 'local') { localLine.hidden = true; return; }
    if (sameAsMel) {
      localLine.textContent = 'That’s your time too (' + ZONES.local.city + ').';
      localLine.hidden = false;
      return;
    }
    var lw = TARGET + tzOffset(visitorTz, TARGET);
    var sameDay = dayOf(visitorTz) === dayOf(MEL);
    localLine.textContent = 'That’s ' + wallTime(lw) + (sameDay ? '' : ' ' + dayOf(visitorTz)) + ' in ' + ZONES.local.city +
      (ZONES.local.abbr ? ' (' + ZONES.local.abbr + ')' : '') + '.';
    localLine.hidden = false;
  }
  root.querySelectorAll('[data-acd-zone]').forEach(function (b) {
    b.addEventListener('click', function () {
      zoneKey = b.getAttribute('data-acd-zone');
      setPressed('data-acd-zone', zoneKey);
      windOff = 0;
      springing = false;
      lastMinFloor = null;
      minTween = null;
      updateLocalLine();
      render();
    });
  });
  var pauseBtn = q('[data-acd-pause]');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume the clock' : 'Pause the clock';
      say(paused ? 'Clock paused.' : 'Clock running.');
      if (!paused) render();
    });
  }
  var statusEl = q('[data-acd-status]');
  var shareBtn = q('[data-acd-share]');
  if (shareBtn && (navigator.share || navigator.clipboard)) {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', function () {
      var url = shareBtn.getAttribute('data-share-url') || location.href;
      var title = shareBtn.getAttribute('data-share-title') || document.title;
      var done = function (msg) { if (statusEl) statusEl.textContent = msg; };
      if (navigator.share) {
        navigator.share({ title: title, url: url }).then(
          function () { done('Thanks for sharing.'); },
          function (e) { if (!e || e.name !== 'AbortError') done('Copy this link: ' + url); }
        );
        return;
      }
      navigator.clipboard.writeText(url).then(
        function () { done('Link copied.'); },
        function () { done('Copy this link: ' + url); }
      );
    });
  }

  // ---------------------------------------------------------------------
  // Milestones for the polite live region — never every second.
  // ---------------------------------------------------------------------
  var MILESTONES = [];
  for (var hh = 24; hh >= 1; hh--) MILESTONES.push(hh * 3600);
  MILESTONES.push(1800, 900, 600, 300, 120, 60, 10);
  function milestone(prev, cur) {
    if (prev > 0 && cur <= 0) { say('Any moment now — this page opens by itself.'); return; }
    // The SMALLEST threshold crossed: after a sleep or a skipped tick, the
    // time left now, not the first milestone that went past.
    var crossed = 0;
    for (var n = 0; n < MILESTONES.length; n++) {
      if (prev > MILESTONES[n] && cur <= MILESTONES[n]) crossed = MILESTONES[n];
    }
    if (crossed) say(durWords(cur, cur < 120) + ' to go.');
  }

  // ---------------------------------------------------------------------
  // Is the real page live yet? The status file: every minute, and every ten
  // seconds from a quarter of an hour before the target.
  // ---------------------------------------------------------------------
  function norm(p) { return String(p || '').replace(/\/+$/, '') || '/'; }
  function isArray(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
  /** True at most once per two minutes per key and address (sessionStorage;
      without it, true — a reload is still a single act of the page). */
  function onceIn2Min(prefix) {
    try {
      var k = prefix + MINE;
      var last = Number(sessionStorage.getItem(k));
      if (last > 0 && Date.now() - last < 120000) return false;
      sessionStorage.setItem(k, String(Date.now()));
    } catch (e) { /* storage blocked */ }
    return true;
  }
  var MINE = norm(PATH);
  var pollTimer = 0;
  function schedule() {
    clearTimeout(pollTimer);
    if (launched) return;
    pollTimer = setTimeout(poll, TARGET - now() < 15 * 60000 ? 10000 : 60000);
  }
  function poll() {
    if (launched || !window.fetch) return;
    var t0 = Date.now();
    fetch('/announce-status.json?t=' + t0, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (res) {
        learnSkew(res.headers.get('Date'), t0, Date.now());
        if (!res.ok) throw new Error('status ' + res.status);
        return res.json();
      })
      .then(function (j) {
        if (!j || !isArray(j.live) || !isArray(j.countdowns)) return;
        if (j.live.some(function (p) { return norm(p) === MINE; })) { launch(); return; }
        // Still counting down, but to a different time: the countdown was
        // moved — reload into it (once per two minutes at most).
        for (var n = 0; n < j.countdowns.length; n++) {
          var c = j.countdowns[n];
          if (c && norm(c.path) === MINE && typeof c.target === 'number' && c.target !== TARGET && onceIn2Min('acd-moved:')) {
            location.reload();
            return;
          }
        }
      })
      .catch(function () { /* never launch on a guess */ })
      .then(schedule);
  }

  // ---------------------------------------------------------------------
  // The launch.
  // ---------------------------------------------------------------------
  function launch() {
    if (launched) return;
    launched = true;
    clearTimeout(pollTimer);
    clearTimeout(keyIdle);
    paused = false;
    if (pauseBtn) pauseBtn.hidden = true;
    dragging = false;
    springing = false;
    minHand.setAttribute('aria-disabled', 'true');
    minHand.setAttribute('tabindex', '-1');
    var t = now();
    wound = Math.max(0, Math.ceil((TARGET - t) / 60000));
    drawReadout(Math.max(0, Math.ceil((TARGET - t) / 1000)));
    lastRoHtml = 'frozen';
    say((wound > 0 ? 'We’re live, ' + plural(wound, 'minute') + ' early.' : 'We’re live.') + ' Opening ' + PAGE_WORD + '.');

    // A reload that still lands on this countdown (a cache serving the old
    // page) must not loop: one automatic open per two minutes, then the button.
    var recent = !onceIn2Min('acd-open:');
    if (window.fetch) fetch(PATH, { cache: 'reload', credentials: 'same-origin' }).catch(function () {});
    // Focus inside a part that is about to be hidden goes to the way in.
    var focusWasHere = root.contains(document.activeElement) && document.activeElement !== document.body;

    function finish() {
      faceFrozen = true;
      windOff = 0;
      root.classList.add('is-live');
      var eb = q('[data-acd-eyebrow]');
      if (eb) eb.textContent = EYEBROW + ' · live now';
      var line = q('[data-acd-liveline]');
      if (line && wound > 0) line.textContent = 'We’ve wound the clock on ' + plural(wound, 'minute') + '. ' + line.textContent;
      q('[data-acd-live]').hidden = false;
      roText.textContent = 'Live now';
      q('[data-acd-unitkeys]').hidden = true;
      q('[data-acd-supp]').hidden = true;
      var cal = q('[data-acd-cal]');
      if (cal) cal.hidden = true;
      if (shareBtn) shareBtn.textContent = 'Share the news';
      if (statusEl) statusEl.textContent = '';
      tring.classList.remove('is-thunk');
      void tring.getBBox();
      tring.classList.add('is-thunk');
      updateWindUi(now());
      drawFace(now());
      var cta = q('.acd-live-cta');
      if (focusWasHere && cta) cta.focus();
      var note = q('[data-acd-opennote]');
      if (recent) {
        if (note) note.textContent = 'Use the button to open it.';
        return;
      }
      setTimeout(function () {
        root.classList.add('is-opening');
        setTimeout(function () { location.reload(); }, reduce ? 1200 : 3400);
      }, reduce ? 0 : 500);
    }

    if (reduce || wound <= 0) { finish(); return; }
    // Motion: the clock winds itself on to the hour, eating the wedge; then
    // the stamp thunks down and the face chimes three ink rings.
    var from = windOff, to = maxWind(t), t1 = performance.now(), dur = 1150;
    (function step() {
      var p = Math.min(1, (performance.now() - t1) / dur);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      windOff = from + (to - from) * e;
      drawFace(now());
      if (p < 1) requestAnimationFrame(step);
      else finish();
    })();
  }

  // ---------------------------------------------------------------------
  // Loops: logic on an interval (runs while paused), paint on rAF.
  // ---------------------------------------------------------------------
  var eyebrow = q('[data-acd-eyebrow]');
  var EYEBROW = eyebrow ? eyebrow.textContent : '';
  function render() {
    var t = now();
    if (!launched) drawReadout(Math.max(0, Math.ceil((TARGET - t) / 1000)));
    drawFace(t);
    updateWindUi(t);
  }
  var lastFrame = performance.now();
  function frame(ts) {
    var dt = Math.min(0.05, (ts - lastFrame) / 1000);
    lastFrame = ts;
    if (springing) {
      var k = 70, c = 10;
      var acc = -k * windOff - c * springV;
      springV += acc * dt;
      windOff += springV * dt;
      if (windOff < -1.5) { windOff = -1.5; springV = -springV * 0.35; }
      if (Math.abs(windOff) < 0.02 && Math.abs(springV) < 0.05) { windOff = 0; springV = 0; springing = false; }
    }
    if (!launched) {
      if (!paused) render();
      else if (dragging || springing) { drawFace(now()); updateWindUi(now()); }
    }
    requestAnimationFrame(frame);
  }
  function tick() {
    if (launched) return;
    var t = now();
    var remSec = Math.max(0, Math.ceil((TARGET - t) / 1000));
    if (lastRem !== null) milestone(lastRem, remSec);
    else if (remSec > 0) say(durWords(remSec, remSec < 120) + ' to go.');
    lastRem = remSec;
    var atZero = remSec <= 0;
    if (atZero !== zero) {
      zero = atZero;
      if (eyebrow) eyebrow.textContent = atZero ? 'Any moment now' : EYEBROW;
      if (atZero) schedule();
    }
  }

  // Boot: reveal the clock, then run.
  root.querySelectorAll('[data-acd-readout], [data-acd-unitkeys], [data-acd-clock], [data-acd-ctrls]').forEach(function (n) {
    n.hidden = false;
  });
  updateLocalLine();
  var wrap = q('[data-acd-clockwrap]');
  if (!reduce && wrap) {
    wrap.classList.add('is-pasting');
    // One small nudge so the knob reads as something to grab: a little wind,
    // then it settles.
    setTimeout(function () { if (!launched && !dragging && windOff === 0 && maxWind(now()) > 2) { windOff = 1.4; startSpring(); } }, 1400);
  }
  render();
  tick();
  setInterval(tick, 250);
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !launched) poll();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !launched) poll();
  });
  poll();
})();
