import { C, FEATURE, PHONE, STRIP, band, comb, crop, footCard, raw } from '../kit.mjs';
import { FEATURE_CROP, LOCALE, TAGLINE } from '../shots.mjs';

const SCALE = 0.64;
const CARD_TOP = 430;
const GUTTER = 80;

// The honey band that runs through all six shots, behind the screens: a route through the week.
function ribbon(w, h, y0, amp, period, width, phase = 0) {
  const pts = [];
  for (let x = -40; x <= w + 40; x += 20) pts.push([x, y0 + amp * Math.sin((2 * Math.PI * x) / period + phase)]);
  const d = `M${pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L')}`;
  return `<svg class="abs" style="left:0;top:0" width="${w}" height="${h}">
<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${width + 12}" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="${C.honey}" stroke-width="${width}" stroke-linejoin="round"/></svg>`;
}

function panel(shot) {
  const x0 = shot.index * PHONE.w;
  const card = footCard(shot, { scale: SCALE, minTop: CARD_TOP, cls: 'card' });
  const right = shot.index % 2 === 0;
  const left = x0 + (right ? PHONE.w - GUTTER - card.w : GUTTER);
  let extra = '';
  if (shot.senderSrc) {
    const s = band(shot.senderSrc, shot.sender, 0.62, 'sat sticker');
    extra = `<div class="abs" style="left:${x0 + PHONE.w - GUTTER - s.w}px;top:${card.top - s.h / 2}px;transform:rotate(-2deg)">${s.html}</div>`;
  }
  const lines = (t) => t.split('\n').join('<br>');
  return `<div class="abs head" style="left:${x0 + GUTTER}px"><div class="display">${shot.caption.h}</div><div class="sub">${lines(shot.caption.s)}</div></div>
<div class="abs" style="left:${left}px;top:${card.top}px">${card.html}</div>${extra}`;
}

export default {
  id: 'P1',
  name: 'Wabenband',
  direction: 'Panorama-Band über alle Bilder',
  rationale: 'Ein Honigband zieht sich durch alle sechs Bilder: Wischen fühlt sich wie ein Weg durch die Woche an, jedes Bild bleibt für sich lesbar.',
  order: ['list', 'sync', 'add', 'order', 'tick', 'invite'],
  captions: {
    list: { h: 'Eure gemeinsame Einkaufsliste', s: 'Für Partner, Familie oder WG.\nOhne Werbung.' },
    sync: { h: 'Sofort bei allen auf der Liste', s: 'Du schreibst Butter drauf,\nAnna sieht sie im Laden.' },
    add: { h: 'Schnell eingetragen', s: 'Mit Menge und Vorschlägen\naus euren Einkäufen.' },
    order: { h: 'Sortiert wie dein Laden', s: 'Halten und ziehen.\nJeder Laden hat seine Reihenfolge.' },
    tick: { h: 'Antippen. Erledigt.', s: 'Keine Werbung. Nur eure Liste.' },
    invite: { h: 'Partner per Link einladen', s: 'Oder den Code teilen.\nFür Familie und WG genauso.' },
  },
  strip: (shots) => ({
    css: `body{background:${C.cobalt}}
.head{top:96px;width:920px;display:flex;flex-direction:column;gap:20px}
.head .display{font-size:84px;color:${C.white}}
.head .sub{font-size:40px;color:${C.honeySoft}}
.card{border:5px solid ${C.ink};border-bottom:0;border-radius:44px 44px 0 0;box-shadow:16px 16px 0 0 ${C.ink}}
.sat{border-radius:26px}`,
    body:
      comb({ w: STRIP.w, h: STRIP.h, r: 150, color: C.white, opacity: 0.06, width: 4 }) +
      ribbon(STRIP.w, STRIP.h, 1220, 430, 2160, 190) +
      shots.map(panel).join(''),
  }),
  feature: () => {
    const fg = crop({ src: raw(LOCALE, FEATURE_CROP.raw), top: 0, bottom: FEATURE_CROP.h, scale: 0.34, cls: 'card' });
    return {
      css: `body{background:${C.cobalt}}
.t{left:72px;width:380px;top:0;bottom:0;display:flex;align-items:center}
.t .display{font-size:46px;color:${C.white}}
.card{border:3px solid ${C.ink};border-bottom:0;border-radius:20px 20px 0 0;box-shadow:8px 8px 0 0 ${C.ink}}`,
      body: `${comb({ w: FEATURE.w, h: FEATURE.h, r: 60, color: C.white, opacity: 0.07, width: 2 })}${ribbon(FEATURE.w, FEATURE.h, 330, 110, 1300, 64, 0.6)}
<div class="abs t"><div class="display">${TAGLINE}</div></div>
<div class="abs" style="left:${FEATURE.w - 64 - fg.w}px;top:${FEATURE.h - fg.h + 8}px">${fg.html}</div>`,
    };
  },
};
