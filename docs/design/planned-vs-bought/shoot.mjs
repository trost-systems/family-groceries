// Drives every approach through the shared scenarios and writes screenshots.
// Usage: node shoot.mjs <base-url> <out-dir> [playwright-module-dir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const [base, out, pwDir = `${process.env.HOME}/family-groceries/e2e/node_modules/`] = process.argv.slice(2);
const { chromium } = createRequire(pwDir)('playwright');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 });
const phone = page.locator('.phone');
const screen = page.locator('#screen');
const failures = [];
const expect = async (label, text) => {
  const got = await screen.innerText();
  if (!got.includes(text)) failures.push(`${label}: missing "${text}"\n---\n${got}\n---`);
};
const open = async (hash) => {
  await page.goto(`${base}#${hash}`);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
};
const shot = (name) => phone.screenshot({ path: `${out}/${name}.png` });

const approaches = [
  'snapshot-vs-ticked-list', 'trip-review-unplanned', 'weekly-plan-kept',
  'aisle-plan-badge', 'two-column-receipt-optional',
];
for (const a of approaches) {
  for (const [s, prices] of [['basic', 0], ['basic', 1], ['empty', 0], ['during', 1], ['nothing', 0]]) {
    await open(`a=${a}&s=${s}&prices=${prices}${a === 'trip-review-unplanned' ? '&done=1&review=1' : ''}`);
    await shot(`${a}--${s}${prices ? '-prices' : ''}`);
  }
}

await open('a=snapshot-vs-ticked-list&s=basic&played=0');
await expect('1 before', 'Einkauf starten');
await page.getByRole('button', { name: 'Einkauf starten' }).click();
await page.getByRole('button', { name: 'Milch abhaken', exact: true }).click();
await page.getByLabel('Artikel').fill('Schokolade');
await page.getByRole('button', { name: 'Schon gekauft' }).click();
await page.getByRole('button', { name: 'Ben schreibt etwas dazu' }).click();
await expect('1 driven', '1 von 2 von der Liste gekauft · 1 zusätzlich');
await expect('1 driven', 'von Ben');
await shot('drive--snapshot-vs-ticked-list');

await open('a=trip-review-unplanned&s=basic&prices=1');
await page.getByRole('button', { name: 'Einkauf beenden' }).click();
await expect('2 review', 'Nicht auf der Liste beim Start');
await expect('2 review', 'Zusammen: 1,99');
await page.getByRole('button', { name: 'War geplant' }).click();
await expect('2 reclass', '3 von 3 von der Liste');
await expect('2 reclass', 'Wie geplant (2)');
await shot('drive--trip-review-reclassified');

await open('a=trip-review-unplanned&s=during');
await page.getByRole('button', { name: 'Einkauf beenden' }).click();
await expect('2 during', 'Nicht gekauft (2)');
await expect('2 during', '1 von 2 von der Liste');
await page.getByRole('button', { name: 'Entfernen' }).first().click();
await expect('2 remove keeps counts', '1 von 2 von der Liste');
await expect('2 remove', 'Entfernt');
await shot('drive--trip-review-during');

await open('a=trip-review-unplanned&s=nothing&done=1&review=1');
await expect('2 nothing', 'Nichts gekauft.');
await open('a=trip-review-unplanned&s=empty&done=1&review=1');
await expect('2 empty', 'Ohne Liste gekauft');

await open('a=weekly-plan-kept&s=during&prices=1');
await page.getByRole('button', { name: /Heute · Supermarkt/ }).click();
await expect('3 expanded', 'Heute abhaken');
await page.getByRole('button', { name: 'Butter abhaken', exact: true }).click();
await expect('3 counts', 'zusätzlich');
await expect('3 prices', 'Preis fehlt bei');
await expect('3 live', 'läuft, ');
await page.getByRole('button', { name: 'Einkauf beenden' }).click();
await expect('3 ended', '1 von 2 geplanten gekauft');
await shot('drive--weekly-today-open');

await open('a=aisle-plan-badge&s=during');
await expect('4 badge', 'neu');
await shot('drive--aisle-badge-during');

await open('a=two-column-receipt-optional&s=during&prices=1');
await page.getByRole('button', { name: 'Bon-Spalte' }).click();
await expect('5 receipt', 'BON');
await expect('5 receipt', 'Vorschau: einen Bon-Abgleich gibt es noch nicht.');
await shot('drive--two-column-receipt-column');

await page.setViewportSize({ width: 800, height: 1000 });
await open('a=snapshot-vs-ticked-list&s=basic');
await page.screenshot({ path: `${out}/index.png` });

await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ok: shots in ${out}`);
