/// <reference types="vite/client" />

/**
 * Compile-time constant injected by vite.config.ts `define`.
 * Value comes from the BACKEND_API_URL environment variable (set in .env or
 * passed as a Docker build-arg).  Always a string — empty string when unset.
 */
declare const __BACKEND_API_URL__: string;
