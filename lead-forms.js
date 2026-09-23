// Lead form handler — submits service requests to Web3Forms (delivers to business inbox)
// Progressive enhancement: without JS, forms still POST directly to the Web3Forms endpoint.
(function () {
  'use strict';

  var ERROR_MSG = 'We could not confirm delivery. Your details are still here. Please try again or call (910) 601-5667. If you already received a confirmation, do not send again.';
  var TIMEOUT_MS = 20000;

  document.querySelectorAll('form[data-lead-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.dataset.sending === 'true') return;
      form.dataset.sending = 'true';
      var navigation = form.querySelectorAll('[data-next], [data-back], [data-edit]');
      navigation.forEach(function (button) { button.disabled = true; });

      var btn = form.querySelector('button[type="submit"]');
      var originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Sending your request<span class="send-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';

      var error = form.querySelector('.form-error');
      if (!error) {
        error = document.createElement('p');
        error.className = 'form-error';
        error.setAttribute('role', 'alert');
        error.setAttribute('aria-live', 'assertive');
        form.appendChild(error);
      }
      error.textContent = '';

      var leadId = form.querySelector('input[name="lead_id"]');
      if (!leadId) {
        leadId = document.createElement('input');
        leadId.type = 'hidden'; leadId.name = 'lead_id'; form.appendChild(leadId);
      }
      if (!leadId.value) leadId.value = 'JTR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

      [['source_url', window.location.href], ['referrer', document.referrer], ['submitted_at', new Date().toISOString()]].forEach(function (item) {
        var field = form.querySelector('input[name="' + item[0] + '"]');
        if (!field) { field = document.createElement('input'); field.type = 'hidden'; field.name = item[0]; form.appendChild(field); }
        field.value = item[1];
      });

      var controller = window.AbortController ? new AbortController() : null;
      var timeout = controller ? window.setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed');
          return res.json();
        })
        .then(function (json) {
          if (timeout) window.clearTimeout(timeout);
          if (!json.success) throw new Error(json.message);
          // A confirmed API response, not proof of inbox delivery or a qualified lead.
          /* Analytics can never hold up confirmation indefinitely. */
          var go = function () { window.location.href = '/thank-you.html'; };
          if (typeof window.jtrMeasureAccepted === 'function') {
            try { window.jtrMeasureAccepted(go); } catch (_) { go(); }
          } else go();
        })
        .catch(function () {
          if (timeout) window.clearTimeout(timeout);
          btn.disabled = false;
          form.dataset.sending = 'false';
          navigation.forEach(function (button) { button.disabled = false; });
          btn.innerHTML = originalHTML;
          error.textContent = ERROR_MSG;
        });
    });
  });
})();
