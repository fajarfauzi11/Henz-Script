// Worker Cava Games: hanya melayani /api/* (wrangler.jsonc → assets.run_worker_first).
// Memakai API Web saja (fetch, Request, Response, Web Crypto); secret lewat env.NAMA.
import { handleView } from './view.js';
import { handlePopular } from './popular.js';
import { handleComments } from './comments.js';
import { json, NO_STORE } from './lib/http.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/api/view') return await handleView(request, env);
      if (path === '/api/popular') return await handlePopular(request, env);
      if (path === '/api/comments') return await handleComments(request, env);
    } catch (err) {
      console.error('api: galat tak terduga', err && err.message);
      return json({ error: 'internal' }, 500, NO_STORE);
    }

    if (path.startsWith('/api/')) return json({ error: 'not_found' }, 404, NO_STORE);
    // Rute non-API tidak seharusnya sampai ke sini; serahkan ke static assets bila ada binding.
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'not_found' }, 404, NO_STORE);
  },
};
