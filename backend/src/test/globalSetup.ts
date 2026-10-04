import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vitest globalSetup — runs in the main process BEFORE any test files are imported.
 * Loads .env.test so DATABASE_URL is set before Prisma initialises its singleton.
 */
export function setup() {
  const envPath = resolve(process.cwd(), '.env.test');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      // Strip surrounding quotes from value
      const raw = trimmed.slice(eqIdx + 1).trim();
      const value = raw.replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
    console.log('[globalSetup] Loaded .env.test — DATABASE_URL points to blog_test_db');
  } catch {
    console.warn('[globalSetup] Could not read .env.test, falling back to .env');
  }
}
