import process from 'node:process';
import { handle } from '../_waitlist.mjs';

export const POST = (request) => handle('confirm', request, { env: process.env, fetch: globalThis.fetch, now: new Date() });
