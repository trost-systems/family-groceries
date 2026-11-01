// quick-add: type the start of a word, tap the catalogue suggestion, close the sheet, the item
// sits in its category on the list. Frame 1 (GIF, PNG) is that end state.
import { addField, addSheet, itemRow } from '../../verify-hummlist/helpers/lib.mjs';

export const scenario = { de: 'demo-familie', en: 'demo-family-en' };
// The catalogue is German in both UI languages, so the English cut types a word both share.
const typed = { de: 'Joghu', en: 'Ched' };
const item = { de: 'Joghurt', en: 'Cheddar' };

/** How long the end state holds in the loop, and as the GIF's first frame. */
export const hold = 1600;
export const posterHold = 900;

export const alt = {
  de: 'Hummlist: „Joghu“ ins Feld „Was brauchst du?“ tippen, den Vorschlag „Joghurt“ antippen, und Joghurt steht unter Kühlregal auf der Liste.',
  en: 'Hummlist: type "Ched" into "What do you need?", tap the suggestion "Cheddar", and Cheddar appears under Chilled on the list.',
};

export async function play({ page, L, lang, tap, pause }) {
  await pause(900);
  await tap(addField(page, L));
  await pause(250);
  const field = addField(page, L);
  for (const ch of typed[lang]) {
    await page.keyboard.insertText(ch);
    await pause(110);
  }
  if ((await field.inputValue()) !== typed[lang]) throw new Error(`the add field reads "${await field.inputValue()}"`);
  const row = addSheet(page, L).getByRole('button', { name: new RegExp(`^${item[lang]}, ${L('suggestionCatalog')}`) });
  await row.waitFor({ timeout: 10_000 });
  await pause(1100);
  await tap(row);
  await addSheet(page, L).getByText(new RegExp(`^✓ .*${item[lang]}`)).waitFor({ timeout: 10_000 });
  await pause(1200);
  await tap(addSheet(page, L).getByRole('button', { name: L('close'), exact: true }));
  await itemRow(page, item[lang]).first().waitFor({ timeout: 10_000 });
  await addSheet(page, L).waitFor({ state: 'detached', timeout: 10_000 });
  await pause(500);
}
