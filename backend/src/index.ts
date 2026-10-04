/**
 * index.ts — re-exports the configured Express app instance.
 *
 * The actual app setup (middleware, routes, error handlers) lives in app.ts.
 * The server startup (app.listen) lives in server.ts.
 *
 * This file exists so that any code which previously imported from `./index`
 * (e.g. tests) continues to work without changes.
 */
export { default } from './app.js';
