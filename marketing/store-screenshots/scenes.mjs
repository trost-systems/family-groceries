// The scenes, one per caption in captions.yaml. A scene names whose phone it is, whether it needs
// a run of its own (it changes data that other scenes show), and how it gets from the signed-in
// list to its frame. Every scene ends on a paused clock at a named moment.

import { addField, addSheet, itemRow, typeInto } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { apiAs, pause, step, stepUntil } from './app.mjs';

/** The words a scene types or acts on, per language; the scenarios hold the same items. */
const WORDS = {
  de: { prefix: 'Hafer', tick: 'Brötchen', edit: 'Äpfel', partnerAdds: ['Ziegenkäse', 'Radieschen'], partnerStore: 'Wochenmarkt' },
  en: { prefix: 'Oat', tick: 'Bread rolls', edit: 'Apples', partnerAdds: ['Goat cheese', 'Radishes'], partnerStore: "Farmers' market" },
};

/**
 * No caret in a list frame: a phone opens the list without the keyboard, while the web build
 * focuses the add field (and takes it back after a blur). A key restarts the caret's blink
 * (500 ms on, 500 ms off), so 750 ms later it is always off. Needs the paused clock.
 */
async function caretOff(page) {
  await page.keyboard.press('End');
  await step(page, 750);
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
      await pause(page);
      await caretOff(page);
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
      const row = itemRow(page, WORDS[lang].tick);
      await row.waitFor();
      await pause(page);
      await caretOff(page);
      await row.click();
      await step(page, 180);
    },
  },
  sync: {
    member: 'jonas',
    ownRun: true,
    // Anna adds two items at the market from her phone (the app's own insert, as her) while
    // Jonas's list is open; the frame is 1.55 s after they arrive, with the "2 neu von Anna"
    // note (the app marks them seen after 3 s).
    async frame({ page, L, lang, run }) {
      const anna = run.users.anna;
      const api = await apiAs(anna);
      const { data: store, error: e } = await api.from('stores').select('id').eq('name', WORDS[lang].partnerStore).single();
      if (e) throw e;
      await pause(page);
      // One statement, so both rows reach Jonas in the same frame.
      const rows = WORDS[lang].partnerAdds.map((name) => ({ household_id: anna.householdId, name, store_id: store.id, status: 'active' }));
      const { error } = await api.from('items').insert(rows);
      if (error) throw error;
      const note = page.getByText(L('newItemsFrom', { count: rows.length, name: anna.name }));
      await stepUntil(page, note, 800);
      await caretOff(page);
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
  edit: {
    member: 'anna',
    // A hold, a swipe or a right click opens the edit sheet; a right click is the one a pointer has.
    async frame({ page, L, lang }) {
      await itemRow(page, WORDS[lang].edit).click({ button: 'right' });
      await page.getByRole('group', { name: L('editSheet'), exact: true }).waitFor();
      await page.waitForTimeout(400);
      await pause(page);
      await caretOff(page);
    },
  },
  dark: {
    member: 'anna',
    dark: true,
    async frame({ page }) {
      await pause(page);
      await caretOff(page);
    },
  },
};
