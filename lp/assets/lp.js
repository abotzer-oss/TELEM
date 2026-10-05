/* ==========================================================================
   תלם — דפי נחיתה ממומנים · לוגיקה משותפת
   - לכידת UTM → שדות נסתרים
   - שליחת טופס ל-Web3Forms + redirect ל-../toda/
   - מדידה: generate_lead / lead_created (OpenAI Ads) / click_whatsapp / click_call
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
  /* attribution-capture.js רץ לפנינו וממלא מ-sessionStorage (ייחוס מגע ראשון).
     לכן ממלאים כאן רק שדות שנשארו ריקים — אחרת נדרוס ייחוס שנקלט בדף קודם בסשן. */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  function fillIfEmpty(name, val) {
    if (!val) return;
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      if (!input.value) input.value = val;
    });
  }
  function captureUtm() {
    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (k) {
      fillIfEmpty(k, qs.get(k) || '');
    });
    // referrer + landing url לעזרה במעקב
    fillIfEmpty('referrer', document.referrer || '');
    fillIfEmpty('landing_url', window.location.href);
  }

  /* ---------- click tracking (whatsapp / call) ---------- */
  function bindClickTracking() {
    document.querySelectorAll('[data-track="whatsapp"]').forEach(function (el) {
      el.addEventListener('click', function () { track('click_whatsapp', { page_id: pageId() }); oaiqContact(); });
    });
    document.querySelectorAll('[data-track="call"]').forEach(function (el) {
      el.addEventListener('click', function () { track('click_call', { page_id: pageId() }); oaiqContact(); });
    });
  }
  // OpenAI Ads — פנייה ישירה (וואטסאפ / טלפון) נספרת כהמרה נפרדת: contact_click.
  // contact_click אינו אירוע סטנדרטי — חייב לעבור כ-"custom" בדיוק לפי הקוד ב-Ads Manager,
  // אחרת הפיקסל דוחה אותו ("Unsupported event name"). הערוץ נמדד ב-GA4 (click_whatsapp / click_call).
  function oaiqContact() {
    try {
      if (window.oaiq) {
        oaiq("measure", "custom", { type: "custom" }, { custom_event_name: "contact_click" });
      }
    } catch (e) {}
  }
  function pageId() {
    var f = document.querySelector('input[name="page_id"]');
    return f ? f.value : '';
  }

  /* ---------- form submit ---------- */
  /* כל הוולידציה ב-/assets/lead-guard.js — שכבה משותפת לכל טופס באתר.
     אם הקובץ לא נטען, לא נשלח כלום (fail-closed): עדיף ליד חסר מליד ריק. */
  function bindForms() {
    document.querySelectorAll('form[data-lp-form]').forEach(function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();

        var guard = window.TelemLeadGuard;
        if (!guard) { return; }              // fail-closed
        if (!guard.allowSubmit(form)) { return; }

        var btn = form.querySelector('[type="submit"]');
        guard.lock(form, btn);

        // הנתונים נבנים מהטופס שנשלח בלבד, ברגע השליחה.
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
              // OpenAI Ads — ההמרה מדווחת כאן בלבד: אחרי success, פעם אחת לכל שליחה.
              if (window.oaiq) {
                oaiq("measure", "lead_created", { type: "customer_action" });
              }
              // השהיה קצרה כדי שהפיקסלים יספיקו לשלוח את ההמרה לפני המעבר לדף התודה
              setTimeout(function () {
                window.location.href = '../toda/?from=' + encodeURIComponent(pageId());
              }, 600);
            } else {
              throw new Error((json && json.message) || 'submit failed');
            }
          })
          .catch(function () {
            guard.unlock(form, btn);
            guard.formMessage(form, 'אירעה תקלה בשליחה. אפשר לפנות אלינו ישירות בוואטסאפ או בטלפון.');
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
