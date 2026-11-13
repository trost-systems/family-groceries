import { C, PHONE, band, crop, raw, windowExact } from '../kit.mjs';
import { FEATURE_CROP, LOCALE, TAGLINE } from '../shots.mjs';

const HEAD = 300;
const LABEL = {
  list: 'Gerade von Anna',
  sync: 'Gerade von Jonas',
  tick: 'Ein Tipp',
  order: 'Halten und ziehen',
  add: 'Aus euren Einkäufen',
  invite: 'Link oder Code teilen',
};
// The lifted row lies exactly over its place in the screen, so nothing shows double; its columns
// stop a gutter short of the canvas edges.
const LIFT_X = [56, 1024];

function panel(shot) {
  const view = windowExact(shot, PHONE.h - HEAD, shot.lift.y);
  const screen = crop({ src: shot.src, top: view.top, bottom: view.bottom, scale: 1 });
  const x = shot.lift.x ?? LIFT_X;
  const lift = band(shot.src, { y: shot.lift.y, x }, 1, 'lift');
  return `<section class="panel" style="left:${shot.index * PHONE.w}px">
<div class="abs" style="left:0;top:${HEAD}px">${screen.html}</div>
<div class="abs headblock"><div class="display">${shot.caption.h}</div><div class="sub">${shot.caption.s}</div></div>
<div class="abs callout" style="left:${x[0]}px;top:${HEAD + shot.lift.y[0] - view.top}px">${lift.html}<div class="tag">${LABEL[shot.key]}</div></div></section>`;
}

export default {
  id: 'FR4',
  name: 'Lupe',
  direction: 'Randlos mit Callouts',
  rationale: 'Die App randlos und groß, ohne Gerät; die entscheidende Zeile hebt sich als Aufkleber mit einem kurzen Etikett heraus.',
  order: ['list', 'sync', 'add', 'order', 'tick', 'invite'],
  captions: {
    list: { h: 'Eure gemeinsame Einkaufsliste', s: 'Für Partner, Familie oder WG. Ohne Werbung.' },
    sync: { h: 'Sofort bei allen auf der Liste', s: 'Du schreibst Kaffee drauf, Anna sieht ihn im Laden.' },
    add: { h: 'Schnell eingetragen', s: 'Mit Menge und Vorschlägen aus euren Einkäufen.' },
    order: { h: 'Sortiert wie dein Laden', s: 'Jeder Laden hat seine eigene Reihenfolge.' },
    tick: { h: 'Keine Werbung. Nur eure Liste.', s: 'Antippen hakt ab.' },
    invite: { h: 'Partner per Link einladen', s: 'Für Familie und WG genauso.' },
  },
  strip: (shots) => ({
    css: `body{background:${C.surface}}
.headblock{left:0;top:0;width:${PHONE.w}px;height:${HEAD}px;padding:0 80px;background:${C.cobalt};border-bottom:6px solid ${C.ink};display:flex;flex-direction:column;justify-content:center;gap:18px}
.headblock .display{font-size:76px;color:${C.white}}
.headblock .sub{font-size:40px;color:${C.honeySoft}}
.lift{border:5px solid ${C.ink};border-radius:30px;box-shadow:0 14px 0 0 ${C.ink},0 0 0 12px ${C.honey}}
.tag{position:absolute;right:28px;bottom:calc(100% - 22px);white-space:nowrap;padding:8px 28px;background:${C.honey};border:4px solid ${C.ink};border-radius:999px;box-shadow:0 6px 0 0 ${C.ink};font-weight:700;font-size:36px;color:${C.ink}}`,
    body: shots.map(panel).join(''),
  }),
  feature: () => {
    const scale = 0.48;
    const fg = crop({ src: raw(LOCALE, FEATURE_CROP.raw), top: 0, bottom: FEATURE_CROP.h, scale });
    const lift = band(raw(LOCALE, FEATURE_CROP.raw), { y: FEATURE_CROP.lift.y, x: LIFT_X }, scale, 'lift');
    return {
      css: `body{background:${C.surface}}
.side{left:0;top:0;bottom:0;width:470px;background:${C.cobalt};border-right:4px solid ${C.ink};display:flex;align-items:center;padding:0 40px 0 72px}
.side .display{font-size:44px;color:${C.white}}
.lift{border:3px solid ${C.ink};border-radius:14px;box-shadow:0 6px 0 0 ${C.ink},0 0 0 6px ${C.honey}}`,
      body: `<div class="abs" style="left:474px;top:0">${fg.html}</div>
<div class="abs side"><div class="display">${TAGLINE}</div></div>
<div class="abs" style="left:${474 + LIFT_X[0] * scale}px;top:${FEATURE_CROP.lift.y[0] * scale}px">${lift.html}</div>`,
    };
  },
};
