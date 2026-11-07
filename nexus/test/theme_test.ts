import { assert, assertEquals } from '@std/assert';
import { themeCss } from '../scripts/theme.ts';

Deno.test('the toggle copy keeps the system default and lets data-theme win', async () => {
  const tokens = await Deno.readTextFile(new URL('../../site/public/tokens.css', import.meta.url));
  const css = themeCss(tokens);
  const darkBody = /:root\[data-theme="dark"\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(darkBody.includes('--hl-color-surface: #0b1024;'), 'dark surface under data-theme=dark');
  assert(/^:root \{[^}]*--hl-color-surface: #f7f7f2;/m.test(css), 'light surface by default');
  assert(css.includes(':root:not([data-theme="light"])'), 'system dark unless light is chosen');
  assertEquals((css.match(/--hl-color-surface:/g) ?? []).length, 3);
});
