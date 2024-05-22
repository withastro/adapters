import type { GetEnv } from 'astro:env/setup';

export const getEnv: GetEnv = (key) => process.env[key];
