/* תלם v2 — תפריט נייד ותפריט "שירותים" בכותרת העליונה */
(function () {
  'use strict';
  function init() {
    var btn = document.getElementById('tv2MenuBtn');
    var menu = document.getElementById('tv2Menu');
    if (btn && menu) {
      btn.addEventListener('click', function () {
        var open = menu.hasAttribute('hidden');
        if (open) { menu.removeAttribute('hidden'); } else { menu.setAttribute('hidden', ''); }
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'סגור תפריט' : 'פתח תפריט');
      });
      menu.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a[href^="#"]')) {
          menu.setAttribute('hidden', '');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }
    var dds = document.querySelectorAll('.tv2-dd');
    Array.prototype.forEach.call(dds, function (dd) {
      var b = dd.querySelector('.tv2-dd-btn');
      if (!b) return;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !dd.classList.contains('open');
        dd.classList.toggle('open', open);
        b.setAttribute('aria-expanded', String(open));
      });
    });
    document.addEventListener('click', function (e) {
      Array.prototype.forEach.call(dds, function (dd) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          var b = dd.querySelector('.tv2-dd-btn');
          if (b) b.setAttribute('aria-expanded', 'false');
        }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      Array.prototype.forEach.call(dds, function (dd) {
        dd.classList.remove('open');
        var b = dd.querySelector('.tv2-dd-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (menu && !menu.hasAttribute('hidden')) {
        menu.setAttribute('hidden', '');
        if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* scrollbar width -> --sbw, so the full-bleed hero (100vw) lines up with the page */
(function () {
  'use strict';
  function sbw() {
    var w = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', (w > 0 ? w : 0) + 'px');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sbw); else sbw();
  window.addEventListener('resize', sbw);
})();
