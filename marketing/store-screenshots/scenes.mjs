// The scenes, one per caption in captions.yaml. A scene names whose phone it is, whether it needs
// a run of its own (it changes data that other scenes show), and how it gets from the signed-in
// list to its frame. Every scene ends on a paused clock at a named moment.

import { addField, addSheet, itemRow, typeInto } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { apiAs, pause, step, stepUntil } from './app.mjs';

/** The words a scene types or acts on, per language; the scenarios hold the same items. */
const WORDS = {
  de: { prefix: 'Hafer', tick: 'Brötchen', partnerAdds: ['Ziegenkäse', 'Radieschen'], partnerStore: 'Wochenmarkt' },
  en: { prefix: 'Oat', tick: 'Bread rolls', partnerAdds: ['Goat cheese', 'Radishes'], partnerStore: "Farmers' market" },
};

/** No caret in a list frame: a phone opens the list without the keyboard (the web build focuses the field). */
async function unfocus(page) {
  await page.evaluate(() => document.activeElement?.blur());
}

/** The caret restarts its blink on a key, so the frame N ms later always shows it the same. */
async function caretAt(page, ms) {
  await page.keyboard.press('End');
  await step(page, ms);
}

export const SCENES = {
  list: {
    member: 'anna',
    async frame({ page }) {
      await unfocus(page);
      await pause(page);
      await step(page, 500);
    },
  },
  add: {
    member: 'anna',
    async frame({ page, L, lang }) {
      await typeInto(addField(page, L), WORDS[lang].prefix);
      await addSheet(page, L).getByRole('button').nth(3).waitFor();
      await page.waitForTimeout(400);
      await pause(page);
      await caretAt(page, 300);
    },
  },
  tick: {
    member: 'anna',
    // The tap commits only after the row has left (440 ms); the frame is taken at 180 ms, when
    // the strike-through has crossed the name, and the clock never gets further, so the shared
    // run's list stays as seeded.
    async frame({ page, lang }) {
      await unfocus(page);
      const row = itemRow(page, WORDS[lang].tick);
      await row.waitFor();
      await pause(page);
      await row.click();
      await step(page, 180);
    },
  },
  sync: {
    member: 'jonas',
    ownRun: true,
    // Anna adds two items at the market from her phone (the app's own insert, as her) while
    // Jonas's list is open; the frame is 1.2 s after they arrive, with the "2 neu von Anna" note.
    async frame({ page, L, lang, run }) {
      await unfocus(page);
      const anna = run.users.anna;
      const api = await apiAs(anna);
      const { data: store, error: e } = await api.from('stores').select('id').eq('name', WORDS[lang].partnerStore).single();
      if (e) throw e;
      await pause(page);
      for (const name of WORDS[lang].partnerAdds) {
        const { error } = await api.from('items').insert({ household_id: anna.householdId, name, store_id: store.id, status: 'active' });
        if (error) throw error;
      }
      const note = page.getByText(L('newItemsFrom', { count: WORDS[lang].partnerAdds.length, name: anna.name }));
      await stepUntil(page, note, 1200);
    },
  },
  due: {
    member: 'anna',
    async frame({ page, L }) {
      await addField(page, L).click();
      await addSheet(page, L).getByRole('button').nth(3).waitFor();
      await page.waitForTimeout(400);
      await pause(page);
      await caretAt(page, 300);
    },
  },
  dark: {
    member: 'anna',
    dark: true,
    async frame({ page }) {
      await unfocus(page);
      await pause(page);
      await step(page, 500);
    },
  },
};
