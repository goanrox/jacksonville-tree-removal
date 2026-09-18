// Local event bridge. Does not send data, set cookies, or load an analytics vendor.
// Connect only after the correct property and consent behavior are verified.
(function () {
  'use strict';
  var allowed = ['page_view', 'phone_click', 'request_accepted'];
  var pages = ['/', '/index.html', '/contact.html', '/tree-removal.html', '/emergency-storm-tree-removal.html', '/service-areas.html', '/faq.html', '/how-it-works.html', '/privacy.html', '/terms.html', '/thank-you.html'];
  var path = window.location.pathname;
  if (!pages.includes(path)) return;
  if (path === '/index.html') path = '/';
  var internal = window.location.hostname !== 'onslowtreeremoval.com';
  try {
    if (new URLSearchParams(window.location.search).get('internal_test') === '1') {
      window.sessionStorage.setItem('jtr_internal_test', '1');
      internal = true;
    }
    if (window.sessionStorage.getItem('jtr_internal_test') === '1') internal = true;
  } catch (_) { /* Local test detection still works without storage. */ }
  function emit(name) {
    if (internal || !allowed.includes(name)) return;
    document.dispatchEvent(new CustomEvent('jtr:metric', {detail: {name: name, page_path: path}}));
  }
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="tel:"]');
    if (link) emit('phone_click'); // Never prevent or delay the call link.
  });
  document.addEventListener('jtr:request-accepted', function () { emit('request_accepted'); });
  emit('page_view');
})();
