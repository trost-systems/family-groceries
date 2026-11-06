// Counts the pixels two screenshots differ in above y = <bottom> (the input field's blinking
// caret sits below it). Decodes both PNGs in Chromium. Prints {"differing": n, "compared": m}.
//
//   node pixeldiff.mjs <a.png> <b.png> <bottom>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'e2e', 'package.json'));
const { chromium } = require('playwright-core');
const [a, b, bottom] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const result = await page.evaluate(
  async ([a, b, bottom]) => {
    const pixels = async (b64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return { w: bitmap.width, data: ctx.getImageData(0, 0, bitmap.width, bottom).data };
    };
    const [pa, pb] = [await pixels(a), await pixels(b)];
    let differing = 0;
    for (let i = 0; i < pa.data.length; i += 4) {
      if (pa.data[i] !== pb.data[i] || pa.data[i + 1] !== pb.data[i + 1] || pa.data[i + 2] !== pb.data[i + 2]) differing++;
    }
    return { differing, compared: pa.data.length / 4 };
  },
  [readFileSync(a).toString('base64'), readFileSync(b).toString('base64'), Number(bottom)],
);
await browser.close();
console.log(JSON.stringify(result));
