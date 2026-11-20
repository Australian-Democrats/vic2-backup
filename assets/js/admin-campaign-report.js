// Campaign fund report runner — the browser side of /admin/campaign-report-view
// (ADR-89), loaded from here because the site's CSP (public/_headers) allows
// script-src 'self' only: an inline <script> on the page is silently refused and
// the Unlock button does nothing (found on preview 2026-11-03). Same paste-the-token
// pattern as the other admin tools; talks only to /admin/check-token and
// /admin/campaign-report-status with the Bearer token.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var tok = '';
  var pollTimer = null;
  function setMsg(t, k) { var el = $('loadMsg'); el.className = 'msg' + (k ? ' ' + k : ''); el.textContent = t; }
  // Melbourne wall-clock stamp (the report dates everything in Australia/Melbourne).
function melbourneTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) + ' Melbourne';
  } catch (_) { return iso; }
}
function money(v) { return '$' + Number(v || 0).toFixed(2); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function table(cols, rows) {
    var t = h('table'), tr = h('tr');
    cols.forEach(function (c) { var th = h('th', c.num ? 'num' : '', c.label); tr.appendChild(th); });
    var thead = h('thead'); thead.appendChild(tr); t.appendChild(thead);
    var tb = h('tbody');
    rows.forEach(function (r) {
      var tr2 = h('tr');
      r.forEach(function (cell, i) { tr2.appendChild(h('td', cols[i].num ? 'num' : cols[i].mono ? 'mono' : '', cell)); });
      tb.appendChild(tr2);
    });
    t.appendChild(tb);
    return t;
  }
  function typeCells(o) {
    var m = (o || {}).membership || { n: 0, net: 0 }, d = (o || {}).donation || { n: 0, net: 0 };
    return [money(m.net / 100) + ' (' + m.n + ')', money(d.net / 100) + ' (' + d.n + ')', money((m.net + d.net) / 100)];
  }
  function renderReport(rep) {
    var mount = $('report'); mount.textContent = '';
    if (!rep) { mount.appendChild(h('p', 'empty', 'No finished report yet.')); return; }
    var hd = rep.headline || {};
    mount.appendChild(h('div', 'big', (rep.window && rep.window.label || '') + ' — NET ' + money(hd.net)));
    if (rep.csv) {
      var dl = h('button', 'btn btn-o', 'Download CSV (' + ((rep.csv.match(/\n/g) || []).length - 1) + ' rows)');
      dl.addEventListener('click', function () {
        // Audit the download (financial information) — best-effort, never blocks the file.
        fetch('/admin/campaign-report-status', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'download' }),
        }).catch(function () {});
        var blob = new Blob([rep.csv], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = rep.csvFilename || 'campaign-fund-report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
      mount.appendChild(dl);
      mount.appendChild(h('p', 'hint', 'CSV columns line up with Stripe’s “Itemized payout reconciliation” export: join on Balance txn (= balance_transaction_id) or, for payments, Stripe charge (= charge_id). Each row also names its payout, payout date and bank trace id, and the Qomon bundle + transaction it matched.'));
    }
    mount.appendChild(h('p', 'sub', 'Gross ' + money(hd.gross) + ' · refunds ' + money(hd.refunds) + ' · NET ' + money(hd.net) +
      ' · Stripe fees ' + money(hd.fees) + ' · net after fees ' + money(hd.netAfterFees) + ' · ' + hd.payments +
      ' payments, ' + (hd.refundCount || 0) + ' refunds · generated ' + melbourneTime(rep.generatedAt)));
    if (rep.payouts) {
      mount.appendChild(h('p', 'hint', 'Payouts: ' + rep.payouts.itemised + ' of ' + rep.payouts.listed + ' in range itemised by Stripe · ' +
        rep.payouts.unsettledRows + ' row(s) not yet in a settled payout' + (hd.feesUnknown ? ' · ' + hd.feesUnknown + ' row(s) without a balance transaction (fee blank)' : '')));
    }
    var cols = [{ label: '' }, { label: 'Membership', num: 1 }, { label: 'Donation', num: 1 }, { label: 'Total', num: 1 }];
    mount.appendChild(h('h2', 'sect', 'By month (net)'));
    mount.appendChild(table(cols, Object.keys(rep.byMonth || {}).sort().map(function (k) { return [k].concat(typeCells(rep.byMonth[k])); })));
    if (rep.bySite && Object.keys(rep.bySite).length) {
      mount.appendChild(h('h2', 'sect', 'By division site (net)'));
      mount.appendChild(h('p', 'hint', 'Which website took the payment (charge metadata) — the allocation split. UNSTAMPED = charges predating the metadata stamping.'));
      mount.appendChild(table(cols, Object.keys(rep.bySite).sort().map(function (k) { return [k].concat(typeCells(rep.bySite[k])); })));
    }
    if (rep.byCampaign && Object.keys(rep.byCampaign).length) {
      mount.appendChild(h('h2', 'sect', 'By fundraising campaign (net)'));
      mount.appendChild(table(cols, Object.keys(rep.byCampaign).sort().map(function (k) { return [k].concat(typeCells(rep.byCampaign[k])); })));
    }
    mount.appendChild(h('h2', 'sect', 'By state (payer billing address, net)'));
    mount.appendChild(table(cols, Object.keys(rep.byState || {}).sort().map(function (k) { return [k].concat(typeCells(rep.byState[k])); })));
    var rec = rep.reconciliation || {};
    mount.appendChild(h('h2', 'sect', 'Qomon reconciliation'));
    mount.appendChild(h('p', 'sub', (rec.matched || 0) + ' matched by charge id · ' + (rec.matchedAmountDate || 0) +
      ' by amount+date · ' + ((rec.missing || []).length) + ' missing · ' + (rec.duesShapedAsDonation || 0) + ' dues still shaped as donation · refunds: ' +
      (rec.refundsMatched || 0) + ' recorded, ' + (rec.refundsUnrecorded || 0) + ' unrecorded, ' + (rec.refundsMissing || 0) + ' charge missing'));
    if ((rec.missing || []).length) {
      mount.appendChild(table(
        [{ label: 'Date' }, { label: 'Amount', num: 1 }, { label: 'Type' }, { label: 'Email' }, { label: 'Qomon contact', mono: 1 }, { label: 'Charge', mono: 1 }, { label: 'Balance txn', mono: 1 }],
        rec.missing.map(function (m) { return [m.date, money(m.amount != null ? m.amount : m.net), m.kind, m.email, String(m.contact || ''), m.charge, m.txn || '']; })));
    }
    if ((rec.reshaped || []).length) {
      mount.appendChild(h('h2', 'sect', 'Dues recorded as donations in Qomon'));
      mount.appendChild(h('p', 'hint', 'Stripe shows a membership payment but the matched Qomon bundle holds the money as a gift (usually Qomon’s own Stripe integration). Fix by editing the bundle in Qomon — move the amount from donation to membership.'));
      mount.appendChild(table(
        [{ label: 'Date' }, { label: 'Net', num: 1 }, { label: 'Email' }, { label: 'Qomon bundle', mono: 1 }, { label: 'Charge', mono: 1 }],
        rec.reshaped.map(function (m) { return [m.date, money(m.net), m.email, String(m.bundle || ''), m.charge]; })));
    }
    if ((rep.refunds || []).length) {
      mount.appendChild(h('h2', 'sect', 'Refunds issued in the window'));
      mount.appendChild(h('p', 'hint', 'One row per refund, keyed by its own balance transaction — the same line the payout reconciliation export shows as a negative amount. The refunded charge may be older than the window. Qomon: RECORDED = the transaction citing the charge shows the refund as its reimbursed amount; UNRECORDED = record the refund on that Qomon transaction; MISSING = the charge itself is not in Qomon.'));
      mount.appendChild(table(
        [{ label: 'Date' }, { label: 'Refunded', num: 1 }, { label: 'Of', num: 1 }, { label: 'Charge date' }, { label: 'Type' }, { label: 'Email' },
         { label: 'Refund', mono: 1 }, { label: 'Charge', mono: 1 }, { label: 'Balance txn', mono: 1 }, { label: 'Payout', mono: 1 }, { label: 'Qomon' }, { label: 'Qomon bundle / txn', mono: 1 }],
        rep.refunds.map(function (r) {
          return [r.date, money(r.refunded), money(r.of), r.chargeDate || '', r.kind || '', r.email, r.refund, r.charge, r.txn || '',
            (r.payout || '') + (r.payoutDate ? ' ' + r.payoutDate : ''),
            r.qomon === 'matched' ? 'recorded' : (r.qomon || 'missing'),
            r.bundle ? String(r.bundle) + (r.qomonTxn ? ' / ' + r.qomonTxn : '') : ''];
        })));
    }
    (rep.caveats || []).forEach(function (c) { mount.appendChild(h('p', 'hint', 'Note: ' + c)); });
  }
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? 'just now' : m < 120 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
  }
  function renderStatus(job) {
    var mount = $('status'); mount.textContent = '';
    if (!job) { mount.appendChild(h('p', 'empty', 'No report running.')); return; }
    var running = job.phase !== 'done' && job.phase !== 'error';
    var pill = h('span', 'pill' + (job.phase === 'error' ? ' dead' : job.phase === 'done' ? '' : ' warn'), job.phase);
    var p = h('p', 'sub');
    p.appendChild(pill);
    p.appendChild(document.createTextNode(' job ' + job.id + ' · ' + (job.progress ? job.progress.charges + ' charges, ' + (job.progress.refunds || 0) + ' refunds collected' : '') +
      (job.startedAt ? ' · started ' + ago(job.startedAt) : '') +
      (job.emailOnFinish ? ' · will email on finish' : '')));
    mount.appendChild(p);
    if (running) {
      // Builds advance every 5-minute cron tick — a long-quiet job has stalled.
      var last = job.updatedAt || job.startedAt;
      if (last && Date.now() - last > 20 * 60000) {
        mount.appendChild(h('p', 'msg err', 'No progress since ' + ago(last).replace(' ago', '') +
          ' — the build looks stalled. Cancel it and run again (a stalled job also self-clears after an hour).'));
      }
      var cancel = h('button', 'btn btn-o', 'Cancel this report');
      cancel.addEventListener('click', function () {
        setMsg('Cancelling…');
        fetch('/admin/campaign-report-status', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        })
          .then(function (r) { return r.json(); })
          .then(function (d) { setMsg(d.ok ? 'Report cancelled.' : (d.error || 'Cancel failed.'), d.ok ? 'ok' : 'err'); refresh(false); })
          .catch(function () { setMsg('Network error.', 'err'); });
      });
      mount.appendChild(cancel);
    }
    if (job.error) mount.appendChild(h('p', 'msg err', job.error));
  }
  // full=true fetches the report itself (an audited access — see the endpoint);
  // the 15-second build poll uses ?poll=1 (job state only, unaudited) and does
  // one full, audited fetch when the build completes.
  function refresh(full) {
    fetch('/admin/campaign-report-status' + (full ? '' : '?poll=1'), { headers: { Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { setMsg(d.error || 'Failed.', 'err'); return; }
        renderStatus(d.job);
        if (full) renderReport(d.lastReport);
        var running = d.job && d.job.phase !== 'done' && d.job.phase !== 'error';
        if (running && !pollTimer) pollTimer = setInterval(function () { refresh(false); }, 15000);
        if (!running && pollTimer) { clearInterval(pollTimer); pollTimer = null; refresh(true); }
      })
      .catch(function () { setMsg('Network error.', 'err'); });
  }
  $('unlock').addEventListener('click', function () {
    tok = $('tok').value.trim();
    if (!tok) { setMsg('Paste the admin token first.', 'err'); return; }
    fetch('/admin/check-token', { headers: { Authorization: 'Bearer ' + tok } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { setMsg(d.error || 'Wrong token.', 'err'); return; }
        setMsg('Unlocked (' + (d.site || 'site') + (d.isTestEnv ? ', TEST' : ', LIVE') + ').' +
          (d.isTestEnv ? ' Email delivery is disabled on this Worker — reports build and display here, but are never sent to the officer.' : ''), 'ok');
        ['run', 'runEmail', 'emailLast'].forEach(function (id) { $(id).disabled = false; });
        // The engine refuses to email from a test Worker (IS_TEST_ENV=true), so
        // don't offer buttons whose only outcome would be a refusal.
        if (d.isTestEnv) {
          ['runEmail', 'emailLast'].forEach(function (id) {
            $(id).disabled = true;
            $(id).title = 'Disabled on a test Worker (IS_TEST_ENV=true) — sandbox figures must never reach the officer.';
          });
        }
        refresh(true);
      })
      .catch(function () { setMsg('Network error.', 'err'); });
  });
  function run(email) {
    var from = $('from').value, to = $('to').value;
    if (!from || !to) { setMsg('Pick both dates.', 'err'); return; }
    setMsg('Starting…');
    fetch('/admin/campaign-report-status', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run', from: from, to: to, email: email }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { setMsg(d.error || 'Failed to start.', 'err'); return; }
        setMsg('Report ' + d.id + ' running — it advances on the 5-minute cron; this page polls automatically.', 'ok');
        refresh(false);
      })
      .catch(function () { setMsg('Network error.', 'err'); });
  }
  $('run').addEventListener('click', function () { run(false); });
  $('runEmail').addEventListener('click', function () { run(true); });
  $('emailLast').addEventListener('click', function () {
    setMsg('Sending…');
    fetch('/admin/campaign-report-status', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'email' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { setMsg(d.ok ? 'Emailed to the officer.' : (d.error || 'Send failed.'), d.ok ? 'ok' : 'err'); })
      .catch(function () { setMsg('Network error.', 'err'); });
  });
})();
