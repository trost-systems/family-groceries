import { C, FEATURE, PHONE, STRIP, comb, band, crop, raw } from '../kit.mjs';
import { FEATURE_CROP, LOCALE, TAGLINE } from '../shots.mjs';

const SCALE = 0.56;
const SCREEN_TOP = 470;
const BEZEL = 20;
const GUTTER = 80;

// The tilted screen in a plain navy bezel (no real device's shape), and the lifted row
// out of it (on the sync shot, the sender's confirmation), flat and larger, straddling the
// bezel's edge on the open side.
function panel(shot) {
  const x0 = shot.index * PHONE.w;
  const flip = shot.index % 2 ? -1 : 1;
  const screen = crop({ src: shot.src, scale: SCALE, cls: 'screen' });
  const devW = screen.w + 2 * BEZEL;
  const devLeft = flip > 0 ? 120 : PHONE.w - 120 - devW;
  const [a, b] = (shot.sender ?? shot.lift).y;
  const lift = shot.senderSrc
    ? band(shot.senderSrc, shot.sender, 0.7, 'lift sticker')
    : band(shot.src, { y: shot.lift.y, x: shot.lift.x ?? [0, 1080] }, 0.7, 'lift sticker');
  const liftTop = Math.min(PHONE.h - lift.h - 140, SCREEN_TOP + BEZEL + ((a + b) / 2) * SCALE - lift.h / 2);
  const liftLeft = flip > 0 ? PHONE.w - lift.w - GUTTER : GUTTER;
  return `<section class="panel" style="left:${x0}px">
<div class="abs head"><div class="display">${shot.caption.h}</div><div class="sub">${shot.caption.s}</div></div>
<div class="abs device" style="left:${devLeft}px;top:${SCREEN_TOP}px;transform:perspective(2600px) rotateY(${10 * flip}deg) rotateX(5deg) rotateZ(${-3 * flip}deg)">${screen.html}</div>
<div class="abs" style="left:${liftLeft}px;top:${liftTop}px;transform:rotate(${2 * flip}deg)">${lift.html}</div></section>`;
}

export default {
  id: 'P3',
  name: 'Schwebend',
  direction: 'Schräg schwebendes Gerät',
  rationale: 'Ein schräg schwebendes Telefon gibt Tiefe; die eine Zeile, um die es geht, springt groß und gerade heraus.',
  order: ['list', 'sync', 'tick', 'order', 'add', 'invite'],
  captions: {
    list: { h: 'Eure gemeinsame Einkaufsliste', s: 'Was Anna aufschreibt, sieht Jonas gelb markiert.' },
    sync: { h: 'Sofort bei allen', s: 'Du schreibst Butter drauf, Anna sieht sie im Laden.' },
    tick: { h: 'Antippen. Erledigt.', s: 'Keine Werbung. Nur eure Liste.' },
    order: { h: 'Sortiert wie dein Laden', s: 'Halten und ziehen. Jeder Laden hat seine Reihenfolge.' },
    add: { h: 'Schnell eingetragen', s: 'Vorschläge aus euren Einkäufen.' },
    invite: { h: 'Partner per Link einladen', s: 'Für Familie und WG genauso.' },
  },
  strip: (shots) => ({
    css: `body{background:${C.honeySoft}}
.head{left:80px;right:80px;top:100px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:22px}
.head .display{font-size:84px;color:${C.ink}}
.head .sub{font-size:40px;color:${C.cobalt}}
.device{padding:${BEZEL}px;background:${C.ink};border-radius:${48 + BEZEL}px;box-shadow:28px 34px 0 0 ${C.cobalt};transform-origin:50% 40%}
.screen{border-radius:48px}
.lift{border-radius:28px;background:${C.white}}`,
    body: comb({ w: STRIP.w, h: STRIP.h, r: 120, color: C.honeyEdge, opacity: 0.35, width: 4 }) + shots.map(panel).join(''),
  }),
  feature: () => {
    const fg = crop({ src: raw(LOCALE, FEATURE_CROP.raw), top: 0, bottom: 1090, scale: 0.3, cls: 'screen' });
    return {
      css: `body{background:${C.honeySoft}}
.t{left:72px;width:380px;top:0;bottom:0;display:flex;align-items:center}
.t .display{font-size:46px;color:${C.ink}}
.device{padding:10px;background:${C.ink};border-radius:30px;box-shadow:14px 16px 0 0 ${C.cobalt}}
.screen{border-radius:20px}`,
      body: `${comb({ w: FEATURE.w, h: FEATURE.h, r: 50, color: C.honeyEdge, opacity: 0.35, width: 2, keep: (x, y) => x < 40 || x > 984 || y < 30 || y > 470 })}
<div class="abs t"><div class="display">${TAGLINE}</div></div>
<div class="abs device" style="left:640px;top:${(FEATURE.h - fg.h) / 2 - 10}px;transform:perspective(1400px) rotateY(-16deg) rotateX(6deg) rotateZ(3deg)">${fg.html}</div>`,
    };
  },
};
