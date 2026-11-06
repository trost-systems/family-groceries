// Scores a capture (capture.mjs): per fetched file its raw, gzip (level 9) and brotli (quality
// 11, window 22) size; the score is the brotli total. Prints the one JSON line of measure.sh.
//
//   node score.mjs <build dir> <capture json> <build seconds> <git sha>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const [buildDir, captureJson, buildSeconds, sha] = process.argv.slice(2);
const capture = JSON.parse(captureJson);
if (!capture.ready) throw new Error('score: the list never showed');

const files = {};
let raw = 0;
let gzip = 0;
let brotli = 0;
for (const file of capture.files) {
  const data = readFileSync(join(buildDir, file));
  const sizes = {
    raw: data.length,
    gzip: gzipSync(data, { level: 9 }).length,
    br: brotliCompressSync(data, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 22 },
    }).length,
  };
  files[file] = sizes;
  raw += sizes.raw;
  gzip += sizes.gzip;
  brotli += sizes.br;
}
// The dart2js fallback (browsers without WasmGC) is not on the scored path; listed for context.
const js = readFileSync(join(buildDir, 'main.dart.js'));
console.log(
  JSON.stringify({
    goal: 'hc-web-bundle',
    score: brotli,
    higher_is_better: false,
    parts: {
      seed: 0,
      compression: 'brotli q11 lgwin22 (score), gzip -9 (part)',
      files_fetched: capture.files.length,
      total_raw: raw,
      total_gzip: gzip,
      total_br: brotli,
      files,
      dart2js_main_raw: js.length,
      dart2js_main_gzip: gzipSync(js, { level: 9 }).length,
      build_seconds: Number(buildSeconds),
    },
    git: sha,
    at: new Date().toISOString(),
  }),
);
