/**
 * Vercel Serverless Function entry point.
 *
 * Semua request ke /api/* diarahkan ke sini oleh vercel.json.
 * File ini membungkus Express app sebagai handler serverless Vercel.
 */
import app from '../backend/src/app.js';

export default app;
