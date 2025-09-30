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

  if (revealItems.length) {
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
  }

  const heatmapContainer = document.querySelector('[data-tv-heatmap]');

  if (heatmapContainer) {
    const heatmapConfig = {
      dataSource: 'SPX500',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'en',
      colorTheme: 'light',
      hasTopBar: true,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      hasLegend: true,
      isMonoSize: false,
      width: '100%',
      height: 620
    };

    const refreshAttr = parseInt(heatmapContainer.dataset.refreshMinutes || '', 10);
    const refreshMinutes = Number.isNaN(refreshAttr) ? 5 : Math.max(1, refreshAttr);

    const defaultCopyright = () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'tradingview-widget-copyright';
      const link = document.createElement('a');
      const host = window.location.hostname.replace(/^www\./, '');
      link.href = `https://www.tradingview.com/heatmap/stock/?utm_source=${host}&utm_medium=widget&utm_campaign=stock-heatmap`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'S&P 500 Heatmap by TradingView';
      wrapper.appendChild(link);
      return wrapper;
    };

    const existingCopyright = heatmapContainer.querySelector('.tradingview-widget-copyright');
    const copyrightTemplate = (existingCopyright ? existingCopyright.cloneNode(true) : defaultCopyright());

    const renderWidget = () => {
      heatmapContainer.innerHTML = '';

      const widgetNode = document.createElement('div');
      widgetNode.className = 'tradingview-widget-container__widget';
      heatmapContainer.appendChild(widgetNode);

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
      script.text = JSON.stringify(heatmapConfig);
      heatmapContainer.appendChild(script);

      if (copyrightTemplate) {
        heatmapContainer.appendChild(copyrightTemplate.cloneNode(true));
      }
    };

    renderWidget();

    if (refreshMinutes > 0) {
      setInterval(renderWidget, refreshMinutes * 60 * 1000);
    }
  }
})();
