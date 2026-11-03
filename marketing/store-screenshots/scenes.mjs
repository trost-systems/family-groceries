// The scenes, one per caption in captions.yaml. A scene names whose phone it is, whether it needs
// a run of its own (it changes data that other scenes show), and how it gets from the signed-in
// list to its frame. Every scene ends on a paused clock at a named moment and returns `lift`: the
// boxes (CSS pixels) its caption points at, which the frame keeps in view when it crops the screen.
// The sync scene also returns `sender`: the partner's phone and the box the frame lifts out of it.

import { addField, addSheet, itemRow, openTab, typeInto } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { apiAs, pause, step, stepUntil } from './app.mjs';

/** The words a scene types or acts on, per language; the scenarios hold the same items and stores. */
const WORDS = {
  de: { typed: '2 Hafer', tick: 'Vollmilch', sent: 'Eier', partnerAdds: ['Ziegenkäse', 'Radieschen'], partnerStore: 'Wochenmarkt', layoutStore: 'Supermarkt' },
  en: { typed: '2 Oat', tick: 'Milk', sent: 'Eggs', partnerAdds: ['Goat cheese', 'Strawberries'], partnerStore: "Farmers' market", layoutStore: 'Supermarket' },
};

/**
 * No caret in a list frame: a phone opens the list without the keyboard, while the web build
 * focuses the add field (and takes it back after a blur). A key restarts the caret's blink
 * (500 ms on, 500 ms off), so 750 ms later it is always off. Needs the paused clock.
 */
const caretOff = (page) => caretAt(page, 750);

/** The caret restarts its blink on a key, so the frame N ms later always shows it the same. */
async function caretAt(page, ms) {
  await page.keyboard.press('End');
  await step(page, ms);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function box(locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error(`${locator} has no box on screen`);
  return b;
}

/** Anna adds [names] from her phone (the app's own insert, as her), in one statement. */
async function partnerAdds(run, lang) {
  const anna = run.users.anna;
  const api = await apiAs(anna);
  const { data: store, error: e } = await api.from('stores').select('id').eq('name', WORDS[lang].partnerStore).single();
  if (e) throw e;
  const rows = WORDS[lang].partnerAdds.map((name) => ({ household_id: anna.householdId, name, store_id: store.id, status: 'active' }));
  const { error } = await api.from('items').insert(rows);
  if (error) throw error;
  return { anna, rows };
}

export const SCENES = {
  list: {
    member: 'jonas',
    ownRun: true,
    // Jonas's list 1.55 s after Anna added two items at the market: the rows are tinted honey under
    // „2 neu von Anna“ (the app marks them seen after 3 s). One statement, so both arrive together.
    async frame({ page, L, lang, run }) {
      await pause(page);
      const { anna, rows } = await partnerAdds(run, lang);
      await stepUntil(page, page.getByText(L('newItemsFrom', { count: rows.length, name: anna.name })), 800);
      await caretOff(page);
      return { lift: await Promise.all(WORDS[lang].partnerAdds.map((n) => box(itemRow(page, n)))) };
    },
  },
  sync: {
    member: 'anna',
    ownRun: true,
    // Jonas types an item into his add sheet and sends it; his sheet confirms where it went
    // („Hinzugefügt: Eier → Supermarkt“, the item's remembered store). Anna's list shows it 1.55 s
    // after it arrives. The frame is Anna's phone with Jonas's confirmation lifted out of his.
    async frame({ page, L, lang, open }) {
      const jonas = await open('jonas');
      const word = WORDS[lang].sent;
      await pause(page);
      await typeInto(addField(jonas.page, L), word);
      await jonas.page.keyboard.press('Enter');
      // Inside the sheet: the engine also puts the text into a screen-reader announcement.
      const sheet = addSheet(jonas.page, L);
      const confirm = sheet.getByText(L('addedTo', { name: word, store: '' }).trim());
      await confirm.waitFor();
      await pause(jonas.page);
      await caretOff(jonas.page);
      // The confirmation line and its undo button, a little padded: not the divider above it nor
      // the suggestion row below.
      const text = await box(confirm);
      const undo = await box(jonas.page.getByRole('button', { name: L('undo'), exact: true }));
      const top = Math.min(text.y, undo.y) - 6;
      const bottom = Math.max(text.y + text.height, undo.y + undo.height) + 6;
      // The sheet's own columns: on a tablet it is narrower than the screen, with the scrim beside it.
      const { x: sheetX, width: sheetWidth } = await box(sheet);
      await stepUntil(page, page.getByText(L('newItemsFrom', { count: 1, name: jonas.user.name })), 300);
      // The new row arrives at the end of the Kühlregal, below the fold: scroll it up to mid-screen.
      const row = itemRow(page, word);
      const { width, height } = page.viewportSize();
      await page.mouse.move(width / 2, height / 2);
      for (let i = 0; i < 20 && (await box(row)).y > height * 0.45; i++) {
        await page.mouse.wheel(0, 60);
        await step(page, 48);
      }
      await step(page, 300);
      await caretOff(page);
      return {
        lift: [await box(row)],
        sender: { page: jonas.page, box: { x: sheetX + 8, y: top, width: sheetWidth - 16, height: bottom - top } },
      };
    },
  },
  add: {
    member: 'anna',
    // „2 Hafer“ typed: the typed row, then suggestions from the household's purchases and the
    // catalogue, each with the quantity.
    async frame({ page, L, lang }) {
      await typeInto(addField(page, L), WORDS[lang].typed);
      const sheet = addSheet(page, L);
      await sheet.getByRole('button').nth(3).waitFor();
      await page.waitForTimeout(400);
      await pause(page);
      await caretAt(page, 300);
      return { lift: [await box(sheet)] };
    },
  },
  order: {
    member: 'anna',
    // More → Läden → Supermarkt: the store's walking order, its categories numbered.
    async frame({ page, L, lang }) {
      await openTab(page, L, 'tabMore');
      await page.getByRole('button', { name: new RegExp(`^${L('storesTitle')}`) }).click();
      const store = WORDS[lang].layoutStore;
      await page.getByRole('button', { name: `${store} ${L('editStoreLayout')}` }).click();
      const title = page.getByText(L('storeLayoutTitle', { store }));
      await title.waitFor();
      await page.waitForTimeout(600);
      await pause(page);
      await step(page, 500);
      const [before, after] = L('dragCategory', { name: '\u0000' }).split('\u0000').map(escape);
      const handles = page.getByText(new RegExp(`^${before}.+${after}$`));
      return { lift: [await box(title), await box(handles.nth(2))] };
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
      const lift = await box(row);
      await row.click();
      await step(page, 180);
      return { lift: [lift] };
    },
  },
  invite: {
    member: 'anna',
    // More → Partner einladen → Neue Einladung: the code, the link the phones share, valid 7 days.
    appOrigin: true,
    async frame({ page, L }) {
      await openTab(page, L, 'tabMore');
      await page.getByRole('button', { name: new RegExp(`^${L('inviteMember')}`) }).click();
      const create = page.getByRole('button', { name: L('newInvite') });
      await create.click();
      // A phone shows no focus ring after a tap; the test's mouse click leaves one.
      await create.blur();
      const code = page.getByText(new RegExp(`^${L('inviteCodeLabel')} [A-Z2-9]{8}$`));
      await code.waitFor();
      await page.waitForTimeout(400);
      await pause(page);
      await step(page, 500);
      const revoke = page.getByRole('button', { name: new RegExp(`^${L('inviteRevokeLabel', { code: '[A-Z2-9]{8}' })}$`) });
      return { lift: [await box(code), await box(revoke)] };
    },
  },
};
