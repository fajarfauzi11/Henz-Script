/**
 * Vercel Speed Insights initialization
 * Loads and configures Speed Insights for performance monitoring
 */

(function() {
  // Import and inject Speed Insights
  import('https://cdn.jsdelivr.net/npm/@vercel/speed-insights@2.0.0/dist/index.mjs')
    .then(module => {
      const { injectSpeedInsights } = module;
      
      // Initialize Speed Insights
      injectSpeedInsights({
        // Automatically detect route from current page
        route: window.location.pathname,
        // Enable debug mode in development
        debug: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      });
      
      console.log('Vercel Speed Insights initialized');
    })
    .catch(err => {
      console.warn('Failed to load Speed Insights:', err);
    });
})();
