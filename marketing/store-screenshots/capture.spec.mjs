// Films every capture (sets.mjs) into out/raw/<locale>/<capture>/<scene>.png, with <scene>.json:
// the rows its caption points at (`lift`) and, for the sync scene, the band lifted out of the
// partner's phone (`sender`, from <scene>-sender.png), all in capture pixels.
// STORE_SHOTS_LOCALES and STORE_SHOTS_STORES (comma-separated) narrow the set.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, openAs, seed, sharedRun } from './app.mjs';
import { SCENES } from './scenes.mjs';
import { CAPTURES, LOCALES, captures } from './sets.mjs';

const list = (name) => process.env[name]?.split(',').filter(Boolean);

/** A CSS box in capture pixels, as the rows [top, bottom] and columns [left, right]. */
const pixels = (b, dpr) => ({ y: [Math.floor(b.y * dpr), Math.ceil((b.y + b.height) * dpr)], x: [Math.floor(b.x * dpr), Math.ceil((b.x + b.width) * dpr)] });

for (const c of captures({ locales: list('STORE_SHOTS_LOCALES'), stores: list('STORE_SHOTS_STORES') })) {
  test(`${c.locale} ${c.capture} ${c.scene}`, async ({ browser }) => {
    const { lang, scenario } = LOCALES[c.locale];
    const { dpr } = CAPTURES[c.capture];
    const scene = SCENES[c.scene];
    const run = scene.ownRun ? await seed(scenario) : await sharedRun(scenario);
    const opened = [];
    const open = async (handle, opts = {}) => {
      const member = await openAs(browser, { run, handle, capture: c.capture, lang, ...opts });
      opened.push(member);
      return member;
    };
    const { page, L } = await open(scene.member, { appOrigin: scene.appOrigin });
    try {
      const { lift, sender } = await scene.frame({ page, L, lang, run, open });
      const dir = join(OUT, 'raw', c.locale, c.capture);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `${c.scene}.png`) });
      const meta = { dpr, lift: lift.map((b) => pixels(b, dpr)) };
      if (sender) {
        await sender.page.screenshot({ path: join(dir, `${c.scene}-sender.png`) });
        meta.sender = { raw: `${c.scene}-sender.png`, ...pixels(sender.box, dpr) };
      }
      writeFileSync(join(dir, `${c.scene}.json`), `${JSON.stringify(meta)}\n`);
      expect(opened.flatMap((m) => m.errors), 'page errors').toEqual([]);
    } finally {
      for (const m of opened) await m.context.close();
    }
  });
}
