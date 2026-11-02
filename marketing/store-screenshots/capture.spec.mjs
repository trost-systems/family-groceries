// Films the raw app frame of every shot (sets.mjs) into out/raw/<locale>/<device>/<scene>.png.
// STORE_SHOTS_LOCALES and STORE_SHOTS_STORES (comma-separated) narrow the set.
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { OUT, openAs, seed, sharedRun } from './app.mjs';
import { SCENES } from './scenes.mjs';
import { LOCALES, shots } from './sets.mjs';

const list = (name) => process.env[name]?.split(',').filter(Boolean);

for (const shot of shots({ locales: list('STORE_SHOTS_LOCALES'), stores: list('STORE_SHOTS_STORES') })) {
  test(`${shot.locale} ${shot.device} ${shot.n}-${shot.scene}`, async ({ browser }) => {
    const { lang, scenario } = LOCALES[shot.locale];
    const scene = SCENES[shot.scene];
    const run = scene.ownRun ? await seed(scenario) : await sharedRun(scenario);
    const { context, page, L, errors } = await openAs(browser, { run, handle: scene.member, device: shot.device, lang, dark: scene.dark });
    try {
      await scene.frame({ page, L, lang, run });
      await page.screenshot({ path: join(OUT, 'raw', shot.locale, shot.device, `${shot.scene}.png`) });
      expect(errors, 'page errors').toEqual([]);
    } finally {
      await context.close();
    }
  });
}
