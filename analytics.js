// Vercel Web Analytics: cookieless pageview counting, no personal data.
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
(function () { var s = document.createElement('script'); s.defer = true; s.src = '/_vercel/insights/script.js'; document.head.appendChild(s); })();
// Minimal, opt-in GA4 collection. No form values or URL queries are collected here.
(function () {
  'use strict';
  var id = 'G-PHRPMVG7S3', host = 'onslowtreeremoval.com';
  var internal = location.hostname !== host, active = false, loaded = false;
  var choice = '', key = 'jtr_analytics_choice';
  var diagnostic = new URLSearchParams(location.search).get('analytics_check') === '1';
  try {
    if (new URLSearchParams(location.search).get('internal_test') === '1') { sessionStorage.setItem('jtr_internal_test', '1'); internal = true; }
    internal = internal || sessionStorage.getItem('jtr_internal_test') === '1';
    choice = localStorage.getItem(key) || '';
  } catch (_) {}
  if (internal) return;
  var paths = ['/', '/index.html', '/contact.html', '/tree-removal.html', '/emergency-storm-tree-removal.html', '/service-areas.html', '/faq.html', '/how-it-works.html', '/privacy.html', '/terms.html', '/thank-you.html'];
  if (!paths.includes(location.pathname)) return;
  var path = location.pathname === '/index.html' ? '/' : location.pathname;
  window.dataLayer = window.dataLayer || [];
  function tag() { window.dataLayer.push(arguments); }
  function start() {
    if (active) return;
    active = true;
    window['ga-disable-' + id] = false;
    if (!loaded) {
      tag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      tag('js', new Date());
      var config = {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: 'https://' + host + path, page_referrer: '', page_title: 'Onslow Tree Removal'};
      if (diagnostic) { config.debug_mode = true; config.traffic_type = 'internal'; }
      tag('config', id, config);
      var script = document.createElement('script'); script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      script.referrerPolicy = 'no-referrer'; document.head.appendChild(script); loaded = true;
    } else tag('consent', 'update', {analytics_storage: 'granted'});
    var ref = '';
    try { var r = new URL(document.referrer); if (['www.google.com', 'www.bing.com', 'www.facebook.com', 'm.facebook.com'].includes(r.hostname)) ref = r.origin + '/'; } catch (_) {}
    tag('event', diagnostic ? 'measurement_test' : 'page_view', {page_location: 'https://' + host + path, page_referrer: ref});
  }
  document.addEventListener('jtr:metric', function (event) {
    if (active && event.detail && event.detail.name === 'phone_click') tag('event', diagnostic ? 'phone_click_test' : 'phone_click', {page_path: path, transport_type: 'beacon'});
  });
  window.jtrMeasureAccepted = function (done) {
    if (!active) { done(); return; }
    var finished = false;
    function finish() { if (!finished) { finished = true; done(); } }
    setTimeout(finish, 600);
    tag('event', diagnostic ? 'request_accepted_test' : 'request_accepted', {page_path: path, transport_type: 'beacon', event_callback: finish, event_timeout: 500});
  };
  var panel = document.createElement('section'); panel.className = 'analytics-choice'; panel.setAttribute('aria-label', 'Optional analytics');
  panel.innerHTML = '<p>Help us improve this local resource? Allow optional Google Analytics to measure visits and button clicks. We do not send your form details. <a href="/privacy.html">Privacy</a></p><div><button type="button" data-allow>Allow analytics</button><button type="button" data-decline>No thanks</button></div>';
  var settings = document.createElement('button'); settings.type = 'button'; settings.className = 'analytics-settings'; settings.textContent = 'Analytics choices';
  function save(value) {
    choice = value; try { localStorage.setItem(key, value); } catch (_) {}
    panel.hidden = true; settings.hidden = false;
    if (value === 'allow') start();
    else { active = false; window['ga-disable-' + id] = true; if (loaded) tag('consent', 'update', {analytics_storage: 'denied'}); }
  }
  panel.querySelector('[data-allow]').addEventListener('click', function () { save('allow'); });
  panel.querySelector('[data-decline]').addEventListener('click', function () { save('decline'); });
  settings.addEventListener('click', function () { panel.hidden = false; settings.hidden = true; });
  document.body.appendChild(panel); document.body.appendChild(settings);
  panel.hidden = !!choice; settings.hidden = !choice;
  if (choice === 'allow') start();
})();
