/**
 * Simple hash-based router for SPA routing.
 */
class Router {
  constructor(routes, defaultRoute = '#/landing') {
    this.routes = routes;
    this.defaultRoute = defaultRoute;
    this.currentRoute = null;

    // Handle back/forward navigation
    window.addEventListener('hashchange', () => this.handleRouting());
  }

  init() {
    this.handleRouting();
  }

  navigate(hash) {
    window.location.hash = hash;
  }

  handleRouting() {
    let hash = window.location.hash || this.defaultRoute;
    
    // Normalize hash
    if (!hash.startsWith('#')) {
      hash = '#' + hash;
    }

    // Find route handler
    const handler = this.routes[hash] || this.routes[this.defaultRoute];
    
    if (handler) {
      this.currentRoute = hash;
      
      // Animate transition out
      const appContent = document.getElementById('content-area');
      if (appContent) {
        appContent.classList.add('animate-fade-in');
        
        // Execute render logic
        handler();

        // Refresh Lucide icons
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }

        // Reset scroll position
        appContent.scrollTop = 0;
        
        // Remove animation class after done
        setTimeout(() => {
          appContent.classList.remove('animate-fade-in');
        }, 500);
      }
    }
  }
}

window.Router = Router;
