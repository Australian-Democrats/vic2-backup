/*
 * Keystatic image-upload guard (Layer 1 of the bad-image defence; Layer 2 is the
 * deploy-gate's normalise-images self-heal, Layer 3 the gate's integrity test).
 *
 * Keystatic in GitHub storage mode commits from the browser (GraphQL
 * createCommitOnBranch with base64 file contents; REST contents PUT as a fallback
 * path). The Worker never sees the bytes, so validation has to happen here: this
 * script wraps window.fetch inside the /keystatic admin, sniffs the magic bytes of
 * any image file about to be committed, and BLOCKS the save with a plain-English
 * explanation when the bytes don't match the file extension (the classic case: an
 * iPhone HEIC photo renamed .jpg, which browsers can't display and the deploy gate
 * rightly rejects).
 *
 * Injected into the Keystatic admin HTML by src/middleware.ts. Never loaded on
 * public pages. If this script breaks, Keystatic still works — the wrapper passes
 * everything it doesn't positively block straight through, and Layers 2 + 3 still
 * stand behind it.
 */
(function () {
  'use strict';
  if (window.__adImageGuardInstalled) return;
  window.__adImageGuardInstalled = true;

  var IMG_EXT = /\.(png|jpe?g|webp|gif|svg|ico)$/i;

  // Identical signature set to regression-testing's site-validation sniff.
  function sniff(bytes) {
    function ascii(from, to) {
      var s = '';
      for (var i = from; i < to && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
    if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
    if (bytes.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'gif';
    if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'ico';
    if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') {
      var brand = ascii(8, 12);
      if (/^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)/.test(brand)) return 'heic';
      if (/^avif/.test(brand)) return 'avif';
      return 'iso-media';
    }
    var head = ascii(0, Math.min(bytes.length, 256)).replace(/^\s+/, '').toLowerCase();
    if (head.indexOf('<?xml') === 0 || head.indexOf('<svg') === 0 || head.indexOf('<svg') !== -1) return 'svg';
    return null;
  }

  var EXT_OK = { png: ['png'], jpg: ['jpg'], jpeg: ['jpg'], webp: ['webp'], gif: ['gif'], svg: ['svg'], ico: ['ico'] };

  function friendlyName(kind) {
    return {
      heic: 'an iPhone/HEIC photo',
      avif: 'an AVIF image',
      'iso-media': 'a video or HEIF container file',
      png: 'a PNG image', jpg: 'a JPEG image', webp: 'a WebP image',
      gif: 'a GIF image', svg: 'an SVG file', ico: 'an icon file',
    }[kind] || 'an unrecognised file type';
  }

  // Decode just enough base64 to sniff (up to ~192 bytes).
  function headBytes(b64) {
    try {
      var bin = atob(b64.slice(0, 256).replace(/[^A-Za-z0-9+/=]/g, ''));
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (e) { return new Uint8Array(0); }
  }

  // { path, contents } -> problem object or null
  function checkFile(path, b64contents) {
    var m = /\.([a-z0-9]+)$/i.exec(path || '');
    if (!m || !IMG_EXT.test(path)) return null;
    var ext = m[1].toLowerCase();
    var allowed = EXT_OK[ext];
    if (!allowed) return null;
    var bytes = headBytes(b64contents || '');
    if (!bytes.length) return null; // can't judge — let it through, Layers 2+3 remain
    var kind = sniff(bytes);
    if (kind && allowed.indexOf(kind) !== -1) return null;
    return { path: path, ext: ext, kind: kind };
  }

  function explain(problems) {
    var lines = problems.map(function (p) {
      var name = p.path.split('/').pop();
      var what = p.kind ? friendlyName(p.kind) : 'not a recognised image (possibly corrupt)';
      var advice;
      if (p.kind === 'heic') {
        advice = 'iPhone photos are saved as HEIC, which websites cannot display. ' +
          'Convert it to JPEG first: on iPhone, Settings → Camera → Formats → ' +
          '“Most Compatible” (then re-take/re-export), or open the photo on a computer ' +
          'and export/save it as JPEG. Then upload the converted file here.';
      } else if (!p.kind) {
        advice = 'The file appears damaged. Re-export it from your photo tool and try again.';
      } else {
        advice = 'Re-save/export it as a real .' + p.ext + ' file (or upload it with the matching ' +
          'extension) and try again.';
      }
      return '“' + name + '” is ' + what + ', but its file name says .' + p.ext + '.\n\n' + advice;
    });
    return 'This image can’t be published:\n\n' + lines.join('\n\n') +
      '\n\nNothing has been saved — fix the file and click Save again. ' +
      '(This check protects the website: a mismatched image would show as broken for visitors ' +
      'and would block the production deploy.)';
  }

  function showBlockedMessage(problems) {
    var msg = explain(problems);
    try {
      var el = document.createElement('div');
      el.setAttribute('role', 'alertdialog');
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(28,43,41,.7);display:flex;align-items:center;justify-content:center;padding:24px;';
      var box = document.createElement('div');
      box.style.cssText = 'max-width:560px;background:#fffdf7;color:#1c2b29;border:2px solid #1c2b29;box-shadow:6px 6px 0 #1c2b29;border-radius:8px;padding:24px;font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap;max-height:80vh;overflow:auto;';
      var h = document.createElement('div');
      h.textContent = 'Image upload blocked';
      h.style.cssText = 'font-weight:700;font-size:18px;margin-bottom:12px;';
      var body = document.createElement('div');
      body.textContent = msg;
      var btn = document.createElement('button');
      btn.textContent = 'OK, I’ll fix the file';
      btn.style.cssText = 'margin-top:16px;padding:10px 18px;background:#fcd666;color:#1c2b29;border:2px solid #1c2b29;border-radius:6px;font-weight:700;cursor:pointer;box-shadow:3px 3px 0 #1c2b29;';
      btn.onclick = function () { el.remove(); };
      box.appendChild(h); box.appendChild(body); box.appendChild(btn); el.appendChild(box);
      document.body.appendChild(el);
    } catch (e) {
      try { window.alert(msg); } catch (e2) { /* headless */ }
    }
  }

  function collectProblems(bodyText) {
    var problems = [];
    try {
      var data = JSON.parse(bodyText);
      // GraphQL createCommitOnBranch: variables.input.fileChanges.additions[{path, contents}]
      var input = data && data.variables && data.variables.input;
      var additions = input && input.fileChanges && input.fileChanges.additions;
      if (Array.isArray(additions)) {
        additions.forEach(function (a) {
          var p = checkFile(a && a.path, a && a.contents);
          if (p) problems.push(p);
        });
      }
      // REST PUT /repos/:owner/:repo/contents/:path — { content: base64 }
      if (typeof data.content === 'string' && data.message !== undefined) {
        // Path comes from the URL, checked by caller via urlPath.
        problems.__restContent = data.content;
      }
    } catch (e) { /* not JSON — ignore */ }
    return problems;
  }

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var body = init && typeof init.body === 'string' ? init.body : null;
      if (body && (method === 'POST' || method === 'PUT')) {
        var isGitHubWrite = /api\.github\.com\/graphql/.test(url) ||
          /\/graphql(\?|$)/.test(url) ||
          (/\/repos\/[^/]+\/[^/]+\/contents\//.test(url) && method === 'PUT');
        if (isGitHubWrite) {
          var problems = collectProblems(body);
          if (problems.__restContent) {
            var urlPath = decodeURIComponent(url.split('/contents/')[1] || '').split('?')[0];
            var p = checkFile(urlPath, problems.__restContent);
            if (p) problems.push(p);
            delete problems.__restContent;
          }
          if (problems.length) {
            showBlockedMessage(problems);
            return Promise.reject(new Error('Image upload blocked: ' +
              problems.map(function (p) { return p.path + ' is ' + (p.kind || 'unrecognised') + ' not .' + p.ext; }).join('; ') +
              ' — see the on-screen message for how to fix it.'));
          }
        }
      }
    } catch (e) { /* guard must never break saving — fall through */ }
    return origFetch.apply(this, arguments);
  };
})();
