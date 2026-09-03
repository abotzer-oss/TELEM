/* ==========================================================================
   תלם — דפי נחיתה ממומנים · לוגיקה משותפת
   - לכידת UTM → שדות נסתרים
   - שליחת טופס ל-Web3Forms + redirect ל-../toda/
   - מדידה: generate_lead / click_whatsapp / click_call
   ========================================================================== */
(function () {
  'use strict';

  // gtag fallback so מדידה לא שוברת אם GTM לא נטען
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  function track(name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) {}
  }

  /* ---------- UTM capture ---------- */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  function captureUtm() {
    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (k) {
      var val = qs.get(k) || '';
      document.querySelectorAll('input[name="' + k + '"]').forEach(function (input) {
        input.value = val;
      });
    });
    // referrer + landing url לעזרה במעקב
    document.querySelectorAll('input[name="referrer"]').forEach(function (i) { i.value = document.referrer || ''; });
    document.querySelectorAll('input[name="landing_url"]').forEach(function (i) { i.value = window.location.href; });
  }

  /* ---------- click tracking (whatsapp / call) ---------- */
  function bindClickTracking() {
    document.querySelectorAll('[data-track="whatsapp"]').forEach(function (el) {
      el.addEventListener('click', function () { track('click_whatsapp', { page_id: pageId() }); });
    });
    document.querySelectorAll('[data-track="call"]').forEach(function (el) {
      el.addEventListener('click', function () { track('click_call', { page_id: pageId() }); });
    });
  }
  function pageId() {
    var f = document.querySelector('input[name="page_id"]');
    return f ? f.value : '';
  }

  /* ---------- form submit ---------- */
  function bindForms() {
    document.querySelectorAll('form[data-lp-form]').forEach(function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();

        // honeypot — אם סומן ע"י בוט, מתעלמים בשקט (checkbox → בודקים checked, לא value)
        var bot = form.querySelector('input[name="botcheck"]');
        if (bot && bot.checked) { return; }

        var btn = form.querySelector('[type="submit"]');
        var btnText = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'שולח…'; }

        var data = new FormData(form);

        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: data
        })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (json && json.success) {
              track('generate_lead', { page_id: pageId(), currency: 'ILS' });
              window.location.href = '../toda/?from=' + encodeURIComponent(pageId());
            } else {
              throw new Error((json && json.message) || 'submit failed');
            }
          })
          .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = btnText; }
            var err = form.querySelector('.form-error');
            if (err) {
              err.hidden = false;
            } else {
              alert('אירעה תקלה בשליחה. אפשר לפנות אלינו ישירות בוואטסאפ או בטלפון.');
            }
          });
      });
    });
  }

  /* ---------- video facade → iframe ---------- */
  function bindVideoFacade() {
    var buttons = document.querySelectorAll('.video-play');
    if (!buttons.length) { return; }           // no-op שקט בדפים בלי סרטון
    buttons.forEach(function (btn) {
      var fired = false;
      btn.addEventListener('click', function () {
        if (fired) { return; }                 // guard: פעם אחת בלבד
        var id = btn.getAttribute('data-video-id');
        var frame = btn.parentNode;
        if (!id || !frame) { return; }
        fired = true;

        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
                     '?autoplay=1&rel=0&playsinline=1';
        iframe.title = btn.getAttribute('data-video-title') ||
                       btn.getAttribute('aria-label') || 'סרטון';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('width', '100%');
        iframe.setAttribute('height', '100%');
        iframe.style.border = '0';

        frame.replaceChild(iframe, btn);
        track('video_play', { page_id: pageId(), video_id: id });
      });
    });
  }

  function init() {
    captureUtm();
    bindClickTracking();
    bindForms();
    bindVideoFacade();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
