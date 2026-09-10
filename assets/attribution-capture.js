(function () {
  'use strict';

  var CLICK_IDS = ['gclid', 'msclkid', 'wbraid', 'gbraid', 'fbclid'];
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var STORE_KEY = 'telem_attr';

  function params() {
    try { return new URLSearchParams(window.location.search); }
    catch (e) { return null; }
  }

  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function save(data) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { /* private mode */ }
  }

  function collect() {
    var stored = load();
    var qs = params();
    if (qs) {
      CLICK_IDS.concat(UTMS).forEach(function (key) {
        var value = qs.get(key);
        if (value && !stored[key]) stored[key] = value;
      });
    }
    if (!stored.landing_url) stored.landing_url = window.location.href;
    if (!stored.referrer) stored.referrer = document.referrer || 'direct';
    if (!stored.first_seen) stored.first_seen = new Date().toISOString();
    save(stored);
    return stored;
  }

  function setField(form, name, value) {
    if (!value) return;
    var field = form.querySelector('input[name="' + name + '"]');
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.appendChild(field);
    }
    field.value = value;
  }

  function fill() {
    var data = collect();
    var forms = document.querySelectorAll('form[data-lp-form]');
    Array.prototype.forEach.call(forms, function (form) {
      Object.keys(data).forEach(function (key) {
        setField(form, key, data[key]);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fill);
  } else {
    fill();
  }
})();
