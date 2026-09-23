// Lead form handler — hardens and submits service requests through /api/submit-lead,
// which verifies the email domain (MX), hosts the tree photo, and forwards to Web3Forms.
// Progressive enhancement: without JS, forms still POST directly to the Web3Forms endpoint.
(function () {
  'use strict';

  var ERROR_MSG = 'We could not confirm delivery. Your details are still here. Please try again or call (910) 601-5667. If you already received a confirmation, do not send again.';
  var EMAIL_MSG = 'That email address does not look real or deliverable. Please double-check it and try again.';
  var PHOTO_MSG = 'We could not process your photo. Please try a different image and send again.';
  var TIMEOUT_MS = 60000;

  function showError(form, msg) {
    var error = form.querySelector('.form-error');
    if (!error) {
      error = document.createElement('p');
      error.className = 'form-error';
      error.setAttribute('role', 'alert');
      error.setAttribute('aria-live', 'assertive');
      form.appendChild(error);
    }
    error.textContent = msg;
  }

  // Downscale the tree photo client-side so uploads stay small and fast.
  function preparePhoto(file) {
    return new Promise(function (resolve, reject) {
      var URL_ = window.URL || window.webkitURL;
      var img = new Image();
      var url = URL_.createObjectURL(file);
      img.onload = function () {
        try {
          URL_.revokeObjectURL(url);
          var max = 1280;
          var w = img.naturalWidth || max, h = img.naturalHeight || max;
          var scale = Math.min(1, max / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({ base64: dataUrl.split(',')[1], name: file.name || 'tree-photo.jpg' });
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL_.revokeObjectURL(url); reject(new Error('photo decode')); };
      img.src = url;
    });
  }

  document.querySelectorAll('form[data-lead-form]').forEach(function (form) {
    // Photo picker: show the chosen file name + thumbnail, and tint the
    // button sage like a picked town card.
    (function () {
      var picker = form.querySelector('[data-photo-picker]');
      if (!picker) return;
      var fileInput = picker.querySelector('input[type="file"]');
      var fileText = picker.querySelector('[data-photo-text]');
      var fileThumb = picker.querySelector('[data-photo-thumb]');
      var thumbImg = fileThumb ? fileThumb.querySelector('img') : null;
      var URL_ = window.URL || window.webkitURL;
      var lastUrl = null;
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        picker.classList.toggle('has-file', !!f);
        if (fileText) fileText.textContent = f ? f.name : 'Choose a photo';
        if (lastUrl && URL_) { try { URL_.revokeObjectURL(lastUrl); } catch (_) {} lastUrl = null; }
        if (fileThumb) {
          if (f && thumbImg && URL_) {
            lastUrl = URL_.createObjectURL(f);
            thumbImg.src = lastUrl;
            fileThumb.hidden = false;
          } else {
            fileThumb.hidden = true;
            if (thumbImg) thumbImg.removeAttribute('src');
          }
        }
      });
    })();
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
      showError(form, '');

      function fail(msg) {
        btn.disabled = false;
        form.dataset.sending = 'false';
        navigation.forEach(function (button) { button.disabled = false; });
        btn.innerHTML = originalHTML;
        showError(form, msg);
      }
      function done() {
        // A confirmed API response, not proof of inbox delivery or a qualified lead.
        /* Analytics can never hold up confirmation indefinitely. */
        var go = function () { window.location.href = '/thank-you.html'; };
        if (typeof window.jtrMeasureAccepted === 'function') {
          try { window.jtrMeasureAccepted(go); } catch (_) { go(); }
        } else go();
      }

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

      var payload = {};
      Array.from(new FormData(form).entries()).forEach(function (entry) {
        if (entry[0] === 'photo') return; // the file travels separately, as downscaled base64
        if (typeof entry[1] === 'string') payload[entry[0]] = entry[1];
      });

      var photoInput = form.querySelector('input[type="file"][name="photo"]');
      var photoFile = photoInput && photoInput.files && photoInput.files[0];
      var photoPromise = photoFile
        ? preparePhoto(photoFile).then(
            function (p) { return { ok: true, photo: p }; },
            function () { return { ok: false }; })
        : Promise.resolve({ ok: true, photo: null });

      var controller = window.AbortController ? new AbortController() : null;
      var timeout = controller ? window.setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;

      photoPromise.then(function (pr) {
        if (!pr.ok || !pr.photo) { fail(PHOTO_MSG); return null; }
        payload.photoBase64 = pr.photo.base64;
        payload.photoName = pr.photo.name;
        return fetch('/api/submit-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });
      }).then(function (res) {
        if (res === null) return null;
        if (!res.ok && res.status !== 400 && res.status !== 502) throw new Error('Request failed');
        return res.json().catch(function () { throw new Error('Request failed'); });
      }).then(function (json) {
        if (json === null) return;
        if (timeout) window.clearTimeout(timeout);
        if (!json.success) {
          fail(json.error === 'email' ? EMAIL_MSG : json.error === 'photo' ? PHOTO_MSG : ERROR_MSG);
          return;
        }
        done();
      }).catch(function () {
        if (timeout) window.clearTimeout(timeout);
        fail(ERROR_MSG);
      });
    });
  });
})();
