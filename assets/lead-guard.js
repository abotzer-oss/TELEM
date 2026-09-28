/* ==========================================================================
   תלם — שומר לידים · ולידציה משותפת לכל טופס באתר
   מטרה: אף ליד ריק לא יוצא מהדפדפן.
   שכבות הגנה:
     1. required / pattern ב-HTML (הדפדפן חוסם גם בלי JS)
     2. checkValidity() לפני כל שליחה
     3. בדיקת JS מפורשת: שם וטלפון לא ריקים אחרי trim, טלפון ישראלי תקין
     4. honeypot + זמן מינימלי מטעינת העמוד
     5. נעילת כפתור נגד שליחה כפולה
   ========================================================================== */
(function () {
  'use strict';

  var MIN_SECONDS = 3;                 // זמן מינימלי מטעינת העמוד עד שליחה
  var LOADED_AT = Date.now();

  /* ---------- טלפון ישראלי ---------- */
  function normalizePhone(value) {
    var d = String(value == null ? '' : value).replace(/\D/g, '');
    d = d.replace(/^00/, '');                       // 00972…
    if (d.indexOf('972') === 0) { d = d.slice(3); } // +972…
    return d.replace(/^0+/, '');                    // 0 מוביל / כפול
  }
  function isValidILPhone(value) {
    // נייד 05X / 07X · קווי 02,03,04,08,09 — תשע או עשר ספרות
    return /^(5\d|7[2-9]|[23489])\d{7}$/.test(normalizePhone(value));
  }

  /* ---------- הודעות שגיאה ליד השדה ---------- */
  var ERR_CLASS = 'lead-field-error';

  function errorEl(field) {
    var id = (field.id || field.name || 'f') + '-err';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('p');
      el.id = id;
      el.className = ERR_CLASS;
      el.setAttribute('role', 'alert');
      el.style.cssText = 'color:#b4452f;font-size:13px;font-weight:600;margin:4px 0 0;text-align:right';
      field.insertAdjacentElement('afterend', el);
    }
    return el;
  }

  function showError(field, message) {
    var el = errorEl(field);
    el.textContent = message;
    el.hidden = false;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', el.id);
  }

  function clearErrors(form) {
    form.querySelectorAll('.' + ERR_CLASS).forEach(function (el) {
      el.textContent = '';
      el.hidden = true;
    });
    form.querySelectorAll('[aria-invalid]').forEach(function (f) {
      f.removeAttribute('aria-invalid');
    });
    var box = form.querySelector('.form-error');
    if (box) { box.hidden = true; }
  }

  function formMessage(form, message) {
    var box = form.querySelector('.form-error');
    if (box) {
      box.textContent = message;
      box.hidden = false;
      return;
    }
    var btn = form.querySelector('[type="submit"]');
    if (btn) { showError(btn, message); }
  }

  /* ---------- trim לכל שדות הטקסט ---------- */
  function trimFields(form) {
    form.querySelectorAll('input, textarea').forEach(function (f) {
      if (f.type === 'checkbox' || f.type === 'radio' || f.type === 'file') { return; }
      if (typeof f.value === 'string') { f.value = f.value.trim(); }
    });
  }

  /* ---------- בוטים ---------- */
  function isBot(form) {
    var hp = form.querySelector('input[name="botcheck"]');
    if (hp && (hp.type === 'checkbox' ? hp.checked : hp.value)) { return true; }
    var hp2 = form.querySelector('input[name="company_website"]');
    return !!(hp2 && hp2.value);
  }
  function tooFast() {
    return (Date.now() - LOADED_AT) < MIN_SECONDS * 1000;
  }

  /* ---------- הוולידציה עצמה ---------- */
  function validate(form) {
    clearErrors(form);
    trimFields(form);

    var first = null;
    function fail(field, msg) {
      showError(field, msg);
      if (!first) { first = field; }
    }

    var name = form.querySelector('[name="name"]');
    var phone = form.querySelector('[name="phone"]');

    if (name && !name.value) {
      fail(name, 'נא למלא שם מלא.');
    } else if (name && name.value.length < 2) {
      fail(name, 'נא למלא שם מלא (לפחות שתי אותיות).');
    }

    if (phone && !phone.value) {
      fail(phone, 'נא למלא מספר טלפון.');
    } else if (phone && !isValidILPhone(phone.value)) {
      fail(phone, 'מספר הטלפון אינו תקין. לדוגמה: 050-1234567');
    }

    // checkValidity() — תופס required / pattern / type="email" בשאר השדות
    if (!first && typeof form.checkValidity === 'function' && !form.checkValidity()) {
      form.querySelectorAll(':invalid').forEach(function (f) {
        if (f === form || f.type === 'hidden') { return; }
        fail(f, f.validationMessage || 'נא לבדוק את השדה הזה.');
      });
    }

    if (first) {
      try { first.focus(); } catch (e) {}
      return false;
    }
    return true;
  }

  /* ---------- שער יחיד לכל טופס ---------- */
  /* מחזיר true רק אם מותר לשלוח. אחרת מציג שגיאה ומחזיר false. */
  function allowSubmit(form) {
    if (isBot(form)) { return false; }
    if (!validate(form)) { return false; }
    if (tooFast()) {
      formMessage(form, 'רגע אחד — נסו לשלוח שוב בעוד שנייה.');
      return false;
    }
    if (form.dataset.sending === '1') { return false; }
    return true;
  }

  function lock(form, btn) {
    form.dataset.sending = '1';
    if (btn) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = 'שולח…'; }
  }
  function unlock(form, btn) {
    form.dataset.sending = '';
    if (btn) { btn.disabled = false; if (btn.dataset.label) { btn.textContent = btn.dataset.label; } }
  }

  window.TelemLeadGuard = {
    MIN_SECONDS: MIN_SECONDS,
    normalizePhone: normalizePhone,
    isValidILPhone: isValidILPhone,
    validate: validate,
    allowSubmit: allowSubmit,
    clearErrors: clearErrors,
    formMessage: formMessage,
    lock: lock,
    unlock: unlock
  };
})();
