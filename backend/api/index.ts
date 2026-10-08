/**
 * Vercel Serverless Function entry point.
 *
 * Vercel tidak bisa menjalankan Express sebagai long-running server.
 * File ini membungkus Express app sebagai handler serverless.
 */
import app from '../src/app.js';

export default app;
