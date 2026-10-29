 import { renderHome } from './views/home.js';
    import { renderDashboard } from './views/dashboard.js';
    import { renderERP } from './views/erp.js';
    import { renderTech } from './views/tech.js';
    import { renderLogin } from './views/login.js';
    import { renderSignup } from './views/signup.js';

    const routes = {
      '': renderHome,
      '#home': renderHome,
      '#dashboard': renderDashboard,
      '#erp': renderERP,
      '#tech': renderTech,
      '#login': renderLogin,
      '#signup': renderSignup
    };

    export function initRouter() {
      window.addEventListener('hashchange', handleRoute);
      handleRoute(); // Load current route on launch
    }

    function handleRoute() {
      const hash = window.location.hash || '#home';
      const renderFn = routes[hash] || renderHome;

      const appContainer = document.getElementById('app') || document.querySelector('main') ||
  document.body;

      // Highlight active navigation link
      document.querySelectorAll('nav a').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === hash);
      });

      renderFn(appContainer);
    }