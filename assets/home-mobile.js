/* Telem home page - mobile hero (under 768px only).
   Adds a real "עוד על תלם" button under the entity paragraph. The paragraph keeps its full
   text in the DOM; on mobile it is clamped to three lines until the button opens it.
   At 768px and up nothing is added (and the button is hidden if the window is widened). */
(function () {
  var mq = window.matchMedia('(max-width: 767px)');
  function init() {
    var el = document.querySelector('.home-v2 .hero .entity');
    if (!el || document.getElementById('heroEntityMore')) return;
    if (!el.id) el.id = 'heroEntity';
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'heroEntityMore';
    b.className = 'm-more';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', el.id);
    b.textContent = 'עוד על תלם';
    b.addEventListener('click', function () {
      var open = el.classList.toggle('is-open');
      b.setAttribute('aria-expanded', String(open));
      b.textContent = open ? 'פחות' : 'עוד על תלם';
    });
    el.insertAdjacentElement('afterend', b);
    function sync() {
      b.hidden = !mq.matches;
      el.classList.toggle('m-collapsible', mq.matches);
    }
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
  }
  function start() {
    if (mq.matches) return init();
    var wait = function () { if (mq.matches) { init(); if (mq.removeEventListener) mq.removeEventListener('change', wait); } };
    if (mq.addEventListener) mq.addEventListener('change', wait);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
