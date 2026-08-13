/**
 * router.js
 * ---------------------------------------------------------------------------
 * A minimal hash-based router. Hash routing is used deliberately: it works
 * on GitHub Pages (and any static host, or even a plain double-clicked
 * index.html) with zero server-side rewrite rules, since the server only
 * ever sees a request for index.html.
 *
 * Route patterns support a single `:param` segment, e.g. '/preview/:id'.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /** @type {Array<{pattern: string, segments: string[], handler: Function}>} */
  const routes = [];
  let notFoundHandler = null;
  let currentCleanup = null;

  /**
   * @param {string} pattern e.g. '/dashboard' or '/preview/:id'
   * @param {(params: Record<string,string>) => (void|Function)} handler
   *        May return a cleanup function, invoked before the next navigation.
   */
  function registerRoute(pattern, handler) {
    routes.push({ pattern, segments: pattern.split('/').filter(Boolean), handler });
  }

  /**
   * @param {(path: string) => void} handler
   */
  function registerNotFound(handler) {
    notFoundHandler = handler;
  }

  /**
   * @param {string} hash e.g. '#/preview/abc123'
   * @returns {{route: object, params: Record<string,string>}|null}
   */
  function matchRoute(hash) {
    const path = hash.replace(/^#/, '') || '/';
    const pathSegments = path.split('/').filter(Boolean);

    for (const route of routes) {
      if (route.segments.length !== pathSegments.length) continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i += 1) {
        const routeSeg = route.segments[i];
        const pathSeg = pathSegments[i];
        if (routeSeg.startsWith(':')) {
          params[routeSeg.slice(1)] = decodeURIComponent(pathSeg);
        } else if (routeSeg !== pathSeg) {
          matched = false;
          break;
        }
      }
      if (matched) return { route, params };
    }
    return null;
  }

  async function handleHashChange() {
    if (typeof currentCleanup === 'function') {
      try {
        currentCleanup();
      } catch {
        /* view cleanup should never break navigation */
      }
      currentCleanup = null;
    }

    const match = matchRoute(window.location.hash);
    if (!match) {
      if (notFoundHandler) notFoundHandler(window.location.hash);
      return;
    }
    const result = await match.route.handler(match.params);
    if (typeof result === 'function') currentCleanup = result;
  }

  /**
   * Starts listening for hash changes and renders the current route.
   */
  function startRouter() {
    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    } else {
      handleHashChange();
    }
  }

  /**
   * @param {string} path e.g. '/preview/abc123'
   */
  function navigate(path) {
    window.location.hash = `#${path}`;
  }

  /**
   * @returns {string} the current route path, without the leading '#'
   */
  function currentPath() {
    return window.location.hash.replace(/^#/, '') || '/';
  }

  window.BPN = window.BPN || {};
  window.BPN.utils = window.BPN.utils || {};
  window.BPN.utils.router = { registerRoute, registerNotFound, startRouter, navigate, currentPath };
})();
