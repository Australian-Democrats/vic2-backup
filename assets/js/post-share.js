/* Post pages: progressive enhancement for the share row ONLY.
   JS-off, the three share anchors (Facebook / X / email) work as plain links
   and the two buttons below stay hidden. */
(function () {
  'use strict';
  var status = document.querySelector('.post-share-status');
  var say = function (msg) {
    if (!status) return;
    status.textContent = msg;
    setTimeout(function () { status.textContent = ''; }, 1500);
  };

  var copy = document.querySelector('.post-share-copy');
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(copy.getAttribute('data-copy-url')).then(
        function () { say('Copied'); },
        function () { say('Copy failed'); }
      );
    });
  }

  var native = document.querySelector('.post-share-native');
  if (native && navigator.share) {
    native.hidden = false;
    native.addEventListener('click', function () {
      navigator.share({
        title: native.getAttribute('data-share-title') || document.title,
        url: native.getAttribute('data-share-url') || location.href,
      }).catch(function () { /* user dismissed the sheet */ });
    });
  }
})();
