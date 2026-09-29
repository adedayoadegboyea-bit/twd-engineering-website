import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const root = new URL('.', import.meta.url);
const www = new URL('./www/', root);
await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });
await cp(new URL('./www-source/', root), www, { recursive: true });
console.log('Mobile web assets prepared in mobile-app/www');
