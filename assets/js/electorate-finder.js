/* "Find your electorate" postcode & suburb lookup on /candidates.
   Data is baked into the page (#efinderData) at build time from the
   electorates collection (postcodes + suburbs per district) — no network.
   Progressive enhancement: the tool is [hidden] until this script runs;
   <noscript> points at /how-to-vote.

   Numerals invariant (Paste-up Night C8): a ballot square shows a number
   ONLY where that number is the actual recommended mark in that contest —
   a single district candidate gets the "1" square; several people in one
   contest get neutral bullets; a region result gets ONE square on the
   party's above-the-line ask (baked into the JSON from the HTV rule
   constants — never hand-written here). */
(function () {
  var dataEl = document.getElementById('efinderData');
  var tool = document.getElementById('efinderTool');
  if (!dataEl || !tool) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    return;
  }
  if (!data.districts || !data.districts.length) return;

  tool.hidden = false;

  /* Ballot vocabulary for the election the page is set to (baked in from the
     chamber table): state = district / region, federal = division / state.
     The VIC strings are the fallbacks so an un-migrated page still renders. */
  var L = data.labels || {};
  var districtKicker = L.districtKicker || 'Legislative Assembly district';
  var regionKicker = L.regionKicker || 'Your Legislative Council region';
  var regionNoun = L.regionNoun || 'region';

  var input = document.getElementById('efinderInput');
  var go = document.getElementById('efinderGo');
  var out = document.getElementById('efinderOut');
  var panel = tool.closest ? tool.closest('.efinder') : null;

  /* The panel reflows the moment it has an answer: the two-column intro/tool
     split collapses to one column so the result cards run the full measure
     instead of stranding a screen-tall hole beside them. */
  function answered(on) {
    if (panel) panel.classList.toggle('is-answered', !!on);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* One contest's candidate list.
     contest: 'district' (single-member — one square when exactly one name)
            | 'region' (group ticket — one ATL square, neutral bullets). */
  function candidateList(cands, contest, placeName) {
    if (!cands || !cands.length) {
      /* There was a THIRD state here — the "announced soon" result cards, with
         a "Be first to know" button that opened the announcement page's
         Tear-Off Fringe and prefilled the district. Both ends of it are gone:
         the finder no longer renders at all while the hub is in coming-soon
         mode (candidates.astro gates it on `live`), so the branch was
         unreachable, and the fringe it drove has been replaced by a Join
         button. Nothing on this page can reach a soon state any more. */
      return (
        '<p class="efr-tba">' + esc(data.tba || 'Candidate to be announced.') + '</p>' +
        '<a class="btn btn--ghost btn--sm efr-joinbtn" href="/join">Help choose them — join</a>'
      );
    }
    if (contest === 'region') {
      // One square for the group's above-the-line mark, people as bullets.
      var atl = data.regionAsk
        ? '<p class="efr-atl"><span class="efr-mark" aria-hidden="true">1</span><span>' +
          esc(data.regionAsk) + '.</span></p>'
        : '';
      return (
        atl +
        '<ul class="efr-cands efr-cands--plain">' +
        cands
          .map(function (c) {
            return '<li><a href="' + esc(c.url) + '">' + esc(c.name) + '</a></li>';
          })
          .join('') +
        '</ul>'
      );
    }
    // District (single-member): the "1" square only when it IS the one mark.
    var marked = cands.length === 1;
    return (
      '<ul class="efr-cands' + (marked ? '' : ' efr-cands--plain') + '">' +
      cands
        .map(function (c) {
          return (
            '<li>' +
            (marked ? '<span class="efr-mark" aria-hidden="true">1</span>' : '') +
            '<a href="' + esc(c.url) + '">' + esc(c.name) + '</a></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  /* Join a list of names the way a person would say them. */
  function listNames(names) {
    if (names.length < 2) return esc(names[0] || '');
    return (
      names.slice(0, -1).map(esc).join(', ') + ' and ' + esc(names[names.length - 1])
    );
  }

  /* ONE upper-house block per result set (never one inside every district
     card). Postcode 3550 returns Bendigo East AND Bendigo West, and both sit
     in Northern Victoria: printing the region, its candidates, the
     above-the-line instruction and the how-to-vote link inside each card
     doubled the panel's height on repeated content and implied two different
     upper-house races. The regions are de-duplicated in match order and each
     one renders once, after the district cards, saying plainly which of the
     matched districts it covers. */
  function regionCard(region, sharedWith) {
    var html =
      '<article class="efr efr--region">' +
      '<p class="efr-kicker">' + esc(regionKicker) + '</p>' +
      '<h3 class="efr-name">' + esc(region.name) + '</h3>';
    if (sharedWith.length > 1) {
      html +=
        '<p class="efr-shared">' + listNames(sharedWith) +
        (sharedWith.length === 2 ? ' are both in this ' : ' are all in this ') +
        esc(regionNoun) + ' — one upper-house paper covers them.</p>';
    }
    html += candidateList(region.candidates, 'region', region.name);
    if (region.htv) {
      html += '<a class="efr-htv" href="/how-to-vote/' + esc(region.htv) +
        '">How to vote in ' + esc(region.name) + ' →</a>';
    }
    return html + '</article>';
  }

  function render(q) {
    var isNumeric = /^\d+$/.test(q);
    var hits = [];
    var matchNote = {};

    if (isNumeric) {
      if (!/^\d{4}$/.test(q)) {
        out.innerHTML = '<p class="efr-none">Enter a four-digit Victorian postcode (3000–3999), or a suburb name.</p>';
        answered(false);
        return;
      }
      if (q[0] !== '3') {
        out.innerHTML =
          '<p class="efr-none">That doesn’t look like a Victorian postcode — Victorian postcodes start with 3. You can also search by suburb.</p>';
        answered(false);
        return;
      }
      hits = data.districts.filter(function (d) {
        return (d.postcodes || []).indexOf(q) !== -1;
      });
    } else {
      if (q.length < 3) {
        out.innerHTML = '<p class="efr-none">Type at least three letters of your suburb or town, or a four-digit postcode.</p>';
        answered(false);
        return;
      }
      var needle = q.toLowerCase();
      // starts-with matches first, then contains
      var starts = [];
      var contains = [];
      data.districts.forEach(function (d) {
        var hit = null;
        (d.suburbs || []).forEach(function (sub) {
          var low = sub.toLowerCase();
          if (low.indexOf(needle) === 0 && (!hit || hit.kind !== 'starts')) hit = { kind: 'starts', sub: sub };
          else if (!hit && low.indexOf(needle) !== -1) hit = { kind: 'contains', sub: sub };
        });
        if (hit) {
          matchNote[d.name] = hit.sub;
          (hit.kind === 'starts' ? starts : contains).push(d);
        }
      });
      hits = starts.concat(contains);
    }

    if (!hits.length) {
      out.innerHTML =
        '<p class="efr-none">No match for <b>' +
        esc(q) +
        '</b> in our lookup yet — the lists are indicative. Try the full district browser on the <a href="/how-to-vote">how-to-vote page</a>, or check the VEC.</p>';
      answered(false);
      return;
    }
    // Districts first, in match order; then each distinct region once.
    var order = [];
    var shared = {};
    hits.forEach(function (d) {
      if (!d.region || !data.regions[d.region]) return;
      if (order.indexOf(d.region) === -1) { order.push(d.region); shared[d.region] = []; }
      shared[d.region].push(d.name);
    });

    var html = hits
      .map(function (d) {
        var card =
          '<article class="efr">' +
          '<p class="efr-kicker">' + esc(districtKicker) + '</p>' +
          '<h3 class="efr-name">' + esc(d.name) + '</h3>' +
          (matchNote[d.name]
            ? '<p class="efr-match">Matched your search for “' + esc(matchNote[d.name]) + '”.</p>'
            : '') +
          candidateList(d.candidates, 'district', d.name);
        if (d.htv) {
          card += '<a class="efr-htv" href="/how-to-vote/' + esc(d.htv) + '">How to vote in ' + esc(d.name) + ' →</a>';
        }
        return card + '</article>';
      })
      .join('');
    html += order
      .map(function (key) { return regionCard(data.regions[key], shared[key]); })
      .join('');
    out.innerHTML = html;
    answered(true);
  }

  function goNow() {
    render((input.value || '').trim());
  }
  go.addEventListener('click', goNow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      goNow();
    }
  });
  input.addEventListener('input', function () {
    var v = (input.value || '').trim();
    if (/^\d{4}$/.test(v) || v.length >= 4) render(v);
    else if (!v.length) { out.innerHTML = ''; answered(false); }
  });

  /* (A delegated click listener lived here: the soon-state "Be first to know"
     button opened the announcement page's Tear-Off Fringe, prefilled the
     district and focused the email input. It went with the fringe — every id
     it reached for (#fringe-district, #fringe-email) and the button that
     triggered it no longer exist anywhere in the site.) */
})();
