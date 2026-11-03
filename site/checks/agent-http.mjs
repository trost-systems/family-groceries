// The built site served the way Vercel serves it (scripts/preview.mjs applies vercel.json), fetched
// the way an agent does (job 93, docs/AGENT_FIRST.md): the agent files, every link in llms.txt and
// every sitemap URL answer 200 with the content type an agent needs to read them.
import { markdownUrls, parseLlms } from '../agent.mjs';

const TYPES = {
  '/llms.txt': 'text/plain; charset=utf-8',
  '/llms-full.txt': 'text/plain; charset=utf-8',
  '/robots.txt': 'text/plain; charset=utf-8',
  '/sitemap.xml': 'application/xml',
};
const typeFor = (path) => TYPES[path] ?? (path.endsWith('.md') ? 'text/markdown; charset=utf-8' : path.endsWith('.yaml') ? null : 'text/html; charset=utf-8');

// { problems: [{ check, url, message }], skipped: [{ check, reason }] } for the site at origin.
export async function checkServed({ origin, siteUrl, publicApi }) {
  const problems = [];
  const skipped = [];
  const local = (url) => (url.startsWith(`${siteUrl}/`) ? origin + url.slice(siteUrl.length) : null);
  const get = async (check, url) => {
    const path = new URL(url).pathname;
    const res = await fetch(url, { redirect: 'manual' });
    const body = await res.text();
    const type = res.headers.get('content-type');
    if (res.status !== 200) problems.push({ check, url: path, message: `answers ${res.status}, want 200` });
    else if (typeFor(path) && type !== typeFor(path)) problems.push({ check, url: path, message: `Content-Type is "${type}", want "${typeFor(path)}"` });
    return res.status === 200 ? body : null;
  };

  for (const path of Object.keys(TYPES)) await get('agent-files', origin + path);

  const llms = await get('llms-txt', `${origin}/llms.txt`);
  if (llms !== null) {
    const { items, head } = parseLlms(llms);
    for (const url of [...items.map((i) => i.url), ...markdownUrls(head)]) {
      const target = local(url.split('#')[0]);
      if (target) await get('llms-txt', target);
    }
  }

  const sitemap = await get('sitemap', `${origin}/sitemap.xml`);
  for (const [, loc] of sitemap?.matchAll(/<loc>([^<]*)<\/loc>/g) ?? []) {
    const target = local(loc);
    if (!target) {
      problems.push({ check: 'sitemap', url: loc, message: `is not on ${siteUrl}` });
      continue;
    }
    const html = await get('sitemap', target);
    const canonical = html && /<link rel="canonical" href="([^"]*)">/.exec(html)?.[1];
    if (html && canonical !== loc) problems.push({ check: 'sitemap', url: loc, message: `serves a page whose canonical URL is ${canonical}` });
  }

  if (publicApi) await get('openapi', `${origin}/openapi.yaml`);
  else skipped.push({ check: 'openapi', reason: 'public-api rollout is off in releases/flags.json' });
  return { problems, skipped };
}
