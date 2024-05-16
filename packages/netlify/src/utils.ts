import type { GetEnv } from 'astro/runtime/server/astro-env.js';

export const getEnv: GetEnv = (key) => process.env[key];
