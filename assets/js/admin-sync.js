/* Qomon sync-status viewer client (external so VIC's `script-src 'self'` CSP stays
   strict — no inline scripts). Talks to the token-gated /admin/sync-status endpoint;
   the Bearer ADMIN_TOKEN is the real gate. Mirrors the parent repo's inline version. */
(function () {
  'use strict';

      var $ = function (id) { return document.getElementById(id); };
      function setMsg(text, kind) { var el = $('loadMsg'); el.className = 'msg' + (kind ? ' ' + kind : ''); el.textContent = text; }
      function fmtTime(v) {
        var d = typeof v === 'number' ? new Date(v) : new Date(String(v || ''));
        return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-AU', { hour12: false });
      }
      function fmtAmount(cents, cur) {
        return typeof cents === 'number' ? '$' + (cents / 100).toFixed(2) + (cur ? ' ' + String(cur).toUpperCase() : '') : '—';
      }
      function cell(tr, text, cls) {
        var td = document.createElement('td');
        if (cls) td.className = cls;
        td.textContent = text == null || text === '' ? '—' : String(text);
        tr.appendChild(td);
        return td;
      }
      function renderTable(mount, cols, rows, buildRow, emptyText) {
        mount.textContent = '';
        if (!rows.length) { var p = document.createElement('p'); p.className = 'empty'; p.textContent = emptyText; mount.appendChild(p); return; }
        var scroll = document.createElement('div'); scroll.className = 'scroll';
        var table = document.createElement('table');
        var thead = document.createElement('thead'); var hr = document.createElement('tr');
        cols.forEach(function (c) { var th = document.createElement('th'); th.textContent = c; hr.appendChild(th); });
        thead.appendChild(hr); table.appendChild(thead);
        var tbody = document.createElement('tbody');
        rows.forEach(function (r) { tbody.appendChild(buildRow(r)); });
        table.appendChild(tbody); scroll.appendChild(table); mount.appendChild(scroll);
      }
      // Act on one queue entry, then reload so the tables reflect reality.
      function doAction(action, key, confirmText) {
        if (confirmText && !window.confirm(confirmText)) return;
        setMsg('Working…', '');
        fetch('/admin/sync-status', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + $('tok').value.trim(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, key: key }),
        })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            if (res.s !== 200 || !res.d.ok) { setMsg(res.d && res.d.error ? res.d.error : 'Action failed (' + res.s + ').', 'err'); return; }
            setMsg('Done — ' + (res.d.did || 'ok') + '. Reloading…', 'ok');
            $('load').click();
          })
          .catch(function () { setMsg('Network error — could not reach the server.', 'err'); });
      }
      function actionBtn(label, cls, onClick) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'act' + (cls ? ' ' + cls : ''); b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
      }
      // Pending + dead share a shape: { key, job:{...}, attempt, lastError, nextAttemptAt|deadAt }
      function queueRow(rec, isDead) {
        var tr = document.createElement('tr');
        var job = rec.job || {};
        var td = document.createElement('td');
        var pill = document.createElement('span');
        pill.className = 'pill' + (isDead ? ' dead' : (rec.attempt >= 4 ? ' warn' : ''));
        pill.textContent = (job.kind || '?') + (job.tier ? ' / ' + job.tier : '');
        td.appendChild(pill); tr.appendChild(td);
        cell(tr, job.ref, 'mono');
        var c = job.contact || {};
        cell(tr, [c.name, c.email].filter(Boolean).join(' '));
        cell(tr, fmtAmount(job.amountCents, job.currency), 'num');
        cell(tr, rec.attempt, 'num');
        cell(tr, fmtTime(isDead ? rec.deadAt : rec.nextAttemptAt), 'num');
        cell(tr, rec.lastError || rec.error, 'errcell');
        var actions = document.createElement('td'); actions.className = 'actions';
        var who = (job.ref || rec.key || 'this job');
        actions.appendChild(actionBtn(isDead ? 'Requeue' : 'Retry now', '', function () {
          doAction('retry', rec.key, isDead ? 'Requeue ' + who + ' from the dead-letter store? It gets a fresh retry budget and runs on the next sweep (≤5 min).' : null);
        }));
        actions.appendChild(actionBtn('Remove', 'danger', function () {
          doAction('delete', rec.key,
            'Remove ' + who + ' permanently?\n\nIt will NEVER record in Qomon automatically — only do this after reconciling it manually (or confirming it is already recorded).');
        }));
        tr.appendChild(actions);
        return tr;
      }
      function auditRow(e) {
        var tr = document.createElement('tr');
        cell(tr, fmtTime(e.at || e.ts), 'num');
        cell(tr, e.kind);
        cell(tr, e.ref, 'mono');
        cell(tr, [e.formType, e.tier].filter(Boolean).join(' / '));
        cell(tr, e.attempt, 'num');
        cell(tr, e.error, 'errcell');
        return tr;
      }
      var QCOLS = ['Job', 'Reference', 'Contact', 'Amount', 'Attempts', 'Next / died at', 'Last error', 'Actions'];
      var ACOLS = ['Time', 'Event', 'Reference', 'Form / tier', 'Attempt', 'Error'];

      $('load').addEventListener('click', function () {
        var tok = $('tok').value.trim();
        if (!tok) { setMsg('Enter the admin token first.', 'err'); return; }
        var day = $('day').value.trim();
        if (day && !/^\d{4}\/\d{2}\/\d{2}$/.test(day)) { setMsg('Audit day must look like 2026/07/13 (or leave it blank).', 'err'); return; }
        setMsg('Loading…', '');
        fetch('/admin/sync-status' + (day ? '?date=' + encodeURIComponent(day) : ''), { headers: { Authorization: 'Bearer ' + tok } })
          .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            if (res.s !== 200 || !res.d.ok) {
              setMsg(res.d && res.d.error ? res.d.error : (res.s === 401 ? 'Unauthorized — wrong admin token.' : 'Request failed (' + res.s + ').'), 'err');
              return;
            }
            var d = res.d;
            var pending = d.pending || [], dead = d.dead || [], audit = (d.audit || []).slice().reverse(); // newest first
            $('pendingCount').textContent = pending.length + ' job' + (pending.length === 1 ? '' : 's');
            $('deadCount').textContent = dead.length + ' job' + (dead.length === 1 ? '' : 's');
            $('auditCount').textContent = audit.length + ' entries — UTC day ' + (d.day || '?');
            renderTable($('pending'), QCOLS, pending, function (r) { return queueRow(r, false); }, 'Queue is empty — nothing is retrying. ✓');
            renderTable($('dead'), QCOLS, dead, function (r) { return queueRow(r, true); }, 'No dead letters. ✓');
            renderTable($('audit'), ACOLS, audit, auditRow, 'No audit entries for this day.');
            setMsg('Loaded ✓ — times shown in your local timezone.', 'ok');
          })
          .catch(function () { setMsg('Network error — could not reach the server.', 'err'); });
      });
})();
