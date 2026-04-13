/**
 * BoostKaro Language Toggle — Hindi / English
 * Uses data-hi and data-en attributes on elements.
 * Default: Hindi ('hi')
 */

(function () {
  const STORAGE_KEY = 'bk_lang';
  let currentLang = localStorage.getItem(STORAGE_KEY) || 'hi';

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    // Update all translatable elements
    document.querySelectorAll('[data-hi]').forEach(function (el) {
      const text = el.getAttribute('data-' + lang);
      if (text !== null) {
        // Preserve child elements (like <span>, <strong>) — only set if no child elements
        if (el.children.length === 0) {
          el.textContent = text;
        } else {
          // For elements with children, use innerHTML stored in data attr
          const htmlAttr = el.getAttribute('data-' + lang + '-html');
          if (htmlAttr) el.innerHTML = htmlAttr;
        }
      }
    });

    // Handle elements that use data-{lang}-html for rich content
    document.querySelectorAll('[data-hi-html]').forEach(function (el) {
      const html = el.getAttribute('data-' + lang + '-html');
      if (html !== null) el.innerHTML = html;
    });

    // Handle placeholder translations
    document.querySelectorAll('[data-hi-placeholder]').forEach(function (el) {
      const ph = el.getAttribute('data-' + lang + '-placeholder');
      if (ph !== null) el.setAttribute('placeholder', ph);
    });

    // Toggle button label
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
      btn.textContent = lang === 'hi' ? 'EN' : 'हि';
      btn.setAttribute('title', lang === 'hi' ? 'Switch to English' : 'हिंदी में देखें');
    }

    // Handle lang-block sections (show/hide full blocks per language)
    document.querySelectorAll('.lang-block').forEach(function (el) {
      const blockLang = el.getAttribute('data-lang');
      el.style.display = blockLang === lang ? '' : 'none';
    });

    // Update html lang attribute
    document.documentElement.setAttribute('lang', lang === 'hi' ? 'hi' : 'en');
  }

  function toggleLang() {
    applyLang(currentLang === 'hi' ? 'en' : 'hi');
  }

  // Run on DOM ready
  function init() {
    // Apply saved/default lang
    applyLang(currentLang);

    // Wire up toggle button
    const btn = document.getElementById('langToggleBtn');
    if (btn) btn.addEventListener('click', toggleLang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
