import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import { parse } from 'node-html-parser';
import { build, readConfig, FLUTTER_BUNDLES } from '../build.mjs';

export const SITE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_DIR = join(SITE_DIR, 'content');

const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'hummlist-site-'));
  temps.push(dir);
  return dir;
}

// Builds the real content plus `files` (path relative to content/ -> text, or null to delete).
export function buildSite({ files = {}, env = {}, config = {} } = {}) {
  const root = tempDir();
  const contentDir = join(root, 'content');
  const outDir = join(root, 'dist');
  cpSync(CONTENT_DIR, contentDir, { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const file = join(contentDir, rel);
    if (text === null) rmSync(file);
    else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
  }
  const result = build({ contentDir, outDir, env, config: { ...readConfig(), ...config } });
  return { ...result, outDir, page: (route) => readPage(outDir, route) };
}

export function readPage(outDir, route) {
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  return parse(readFileSync(join(outDir, file), 'utf8'));
}

// The site's own pages. Flutter app bundles have an index.html too, but it is an app shell that
// build.mjs checks on its own terms (checkFlutterScripts), not a page with headings and a footer.
export const isFlutterBundle = (file) => FLUTTER_BUNDLES.some((dir) => file.split('\\').join('/').startsWith(dir));

export function htmlRoutes(outDir) {
  return readdirSync(outDir, { recursive: true })
    .filter((f) => f.endsWith('.html') && !isFlutterBundle(f))
    .map((f) => (f === 'index.html' ? '/' : `/${f.slice(0, -5)}`));
}

export function guide({ locale, slug, title = `Title ${slug}`, description = `Description ${slug}`, key = slug, body = `# ${title}\n\nText.\n`, omit = [] }) {
  const fields = { title, description, slug, locale, translation_key: key, updated: '2026-10-01' };
  const lines = Object.entries(fields).filter(([k]) => !omit.includes(k)).map(([k, v]) => `${k}: "${v}"`);
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}

export function legal({ locale, path, key, title = `Legal ${key}`, body = `# ${title}\n\nText.\n` }) {
  return `---\ntitle: "${title}"\ndescription: "About ${key}"\nlocale: ${locale}\npath: ${path}\ntranslation_key: ${key}\nupdated: 2026-10-01\n---\n\n${body}`;
}

export const hrefs = (doc, selector = 'a') => doc.querySelectorAll(selector).map((a) => a.getAttribute('href'));
export const meta = (doc, key) => doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content');
export const alternates = (doc) =>
  Object.fromEntries(doc.querySelectorAll('link[rel="alternate"]').map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]));
