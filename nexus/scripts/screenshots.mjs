// Screenshots for the PR: desktop and phone, light and dark, a drawer. Needs serve.ts on 55690 and
// e2e/node_modules (npm ci in e2e). Run: node nexus/scripts/screenshots.mjs docs/screenshots/156
import { createRequire } from 'node:module';
import process from 'node:process';
const require = createRequire(new URL('../../e2e/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const out = process.argv[2];
const full = process.argv[3] === 'full';
const browser = await chromium.launch();
const shots = [
  ['desktop-light', 1440, 900, 'light'],
  ['desktop-dark', 1440, 900, 'dark'],
  ['phone-light', 390, 844, 'light'],
  ['phone-dark', 390, 844, 'dark'],
];
const problems = [];
for (const [name, width, height, scheme] of shots) {
  const page = await browser.newPage({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: width < 500 ? 2 : 1,
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${name}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  await page.goto('http://127.0.0.1:55690/');
  await page.waitForSelector('.summary');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  if (name === 'desktop-light' || name === 'phone-dark') {
    const id = await page.evaluate(async () => {
      const snap = await (await fetch('/data/snapshot.json')).json();
      const live = snap.jobs.filter((j) => ['building', 'reviewing', 'fixing'].includes(j.state));
      return live.sort((a, b) => b.steps.length - a.steps.length)[0].id;
    });
    await page.locator(`#now button.job-open[data-job="${id}"]`).click();
    await page.waitForSelector('#drawer[open]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-drawer.png` });
    await page.keyboard.press('Escape');
    const focused = await page.evaluate(() => document.activeElement?.className);
    if (focused !== 'job-open') problems.push(`${name}: focus after Escape on ${focused}`);
  }
  await page.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'no console errors, focus returns');
