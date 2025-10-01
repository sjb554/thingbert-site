(function () {
  'use strict';

  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  const setNavState = (expanded) => {
    if (!navToggle || !nav) {
      return;
    }

    navToggle.setAttribute('aria-expanded', String(expanded));
    navToggle.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
    nav.classList.toggle('open', expanded);
  };

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      setNavState(!expanded);
    });

    nav.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.closest('a')) {
        setNavState(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setNavState(false);
      }
    });
  }

  const revealItems = document.querySelectorAll('[data-reveal]');

  if (!revealItems.length) {
    return;
  }

  const activate = (el) => {
    el.classList.add('is-visible');
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    revealItems.forEach((el) => {
      const delay = el.dataset.revealDelay;
      if (delay) {
        el.style.transitionDelay = delay;
      }
      observer.observe(el);
    });
  } else {
    revealItems.forEach(activate);
  }
})();