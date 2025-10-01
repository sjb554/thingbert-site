(function () {
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

  const HEART_MODEL = {
    features: ["age","sex","cp","trestbps","chol","fbs","restecg","thalach","exang","oldpeak","slope","ca","thal"],
    mean: [54.549586776859506,0.6818181818181818,3.152892561983471,130.95867768595042,249.8388429752066,0.1446280991735537,0.9793388429752066,149.96280991735537,0.32644628099173556,0.9991735537190083,1.5867768595041323,0.6074380165289256,4.706611570247934],
    scale: [8.978372765440131,0.46577048936179993,0.9734979428100604,17.58610302878636,52.737566192586975,0.35172547832506873,0.9977178384620765,22.639527461380734,0.4689126854952853,1.1206178835595506,0.612128402880701,0.8807083258655833,1.9435945032140787],
    coefficients: [-0.09409607382099947,0.6702412942876892,0.5340701452917718,0.3129064168586705,0.22644767035344435,-0.22545362266064198,0.21339033481831707,-0.35862015511949286,0.38522364616612215,0.1298166963721812,0.36243995545360363,1.116569080523147,0.6730643751795298],
    intercept: 0.07759100607382498
  };

  const form = document.querySelector('#heart-risk-form');
  if (form) {
    const output = document.querySelector('#risk-output');
    const probabilityEl = document.querySelector('#risk-probability');
    const tierEl = document.querySelector('#risk-tier');
    const contextEl = document.querySelector('#risk-context');

    const logistic = (values) => {
      let score = HEART_MODEL.intercept;
      for (let i = 0; i < HEART_MODEL.features.length; i += 1) {
        const centered = (values[i] - HEART_MODEL.mean[i]) / HEART_MODEL.scale[i];
        score += centered * HEART_MODEL.coefficients[i];
      }
      return 1 / (1 + Math.exp(-score));
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const values = HEART_MODEL.features.map((feature) => {
        const raw = formData.get(feature);
        return raw == null || raw === '' ? NaN : Number(raw);
      });

      if (values.some(Number.isNaN)) {
        tierEl.textContent = 'Missing input';
        contextEl.textContent = 'Please complete every field.';
        probabilityEl.textContent = '--%';
        output.classList.remove('hidden');
        return;
      }

      const probability = logistic(values);
      const pct = (probability * 100).toFixed(1);
      probabilityEl.textContent = `${pct}%`;

      let tier;
      let context;
      if (probability < 0.35) {
        tier = 'Lower estimated probability';
        context = 'Model sees a profile similar to lower-risk patients in the training set.';
      } else if (probability < 0.65) {
        tier = 'Moderate estimated probability';
        context = 'Mixed signals—consider the follow-up prompts outlined in the workflow summary before making decisions.';
      } else {
        tier = 'Elevated estimated probability';
        context = 'Profile aligns with patients who frequently had heart disease in the study. Use this as a prompt for professional evaluation.';
      }

      tierEl.textContent = tier;
      contextEl.textContent = context;
      output.classList.remove('hidden');
    });
  }

})();
