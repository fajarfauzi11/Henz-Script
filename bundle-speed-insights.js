/**
 * Bundle script for Vercel Speed Insights
 * Bundles the speed-insights.js module into a standalone script
 */
const esbuild = require('esbuild');
const path = require('path');

async function bundle() {
  try {
    await esbuild.build({
      entryPoints: ['speed-insights.js'],
      bundle: true,
      minify: true,
      format: 'iife',
      outfile: 'public/js/speed-insights.bundle.js',
      platform: 'browser',
      target: 'es2015',
      logLevel: 'info'
    });
    console.log('✓ Speed Insights bundle created successfully');
  } catch (error) {
    console.error('Error bundling Speed Insights:', error);
    process.exit(1);
  }
}

bundle();
