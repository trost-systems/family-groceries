import { C, FEATURE, PHONE, band, crop, footCard, raw } from '../kit.mjs';
import { FEATURE_CROP, LOCALE, TAGLINE } from '../shots.mjs';

const SCALE = 0.86;
const CARD_TOP = 540;
const GUTTER = 80;

function panel(shot) {
  const card = footCard(shot, { scale: SCALE, minTop: CARD_TOP, cls: 'card' });
  const left = (PHONE.w - card.w) / 2;
  let extra = '';
  if (shot.senderSrc) {
    const s = band(shot.senderSrc, shot.sender, 0.7, 'sat sticker');
    extra = `<div class="abs" style="left:${GUTTER}px;top:${card.top - s.h / 2}px;transform:rotate(-2deg)">${s.html}</div>`;
  }
  const [h1, h2] = shot.caption.h;
  return `<section class="panel" style="left:${shot.index * PHONE.w}px">
<div class="abs head"><div class="display">${h1}<br>${h2}</div><div class="sub">${shot.caption.s}</div></div>
<div class="abs" style="left:${left}px;top:${card.top}px">${card.html}</div>${extra}</section>`;
}

export default {
  id: 'P2',
  name: 'Großschrift',
  direction: 'Große Überschriften',
  rationale: 'Zwei Zeilen, die man im Suchergebnis lesen kann: riesige Bricolage-Schrift auf Honig, die echte App läuft unten aus dem Bild.',
  order: ['list', 'sync', 'add', 'order', 'tick', 'invite'],
  captions: {
    list: { h: ['Eine Liste.', 'Für alle.'], s: 'Für Partner, Familie oder WG. Ohne Werbung.' },
    sync: { h: ['Du schreibst.', 'Anna sieht’s.'], s: 'Sofort bei allen auf der Liste.' },
    add: { h: ['Kurz getippt,', 'schon drauf.'], s: 'Mit Menge und Vorschlägen aus euren Einkäufen.' },
    order: { h: ['Dein Laden,', 'dein Weg.'], s: 'Halten und ziehen. Jeder Laden hat seine Reihenfolge.' },
    tick: { h: ['Tipp.', 'Erledigt.'], s: 'Keine Werbung. Nur eure Liste.' },
    invite: { h: ['Komm mit', 'auf die Liste.'], s: 'Partner per Link oder Code einladen.' },
  },
  strip: (shots) => ({
    css: `body{background:${C.honey}}
.head{left:${GUTTER}px;right:${GUTTER}px;top:96px;display:flex;flex-direction:column;gap:26px}
.head .display{font-size:132px;color:${C.ink}}
.head .sub{font-size:40px;color:${C.ink};max-width:900px}
.card{border:5px solid ${C.ink};border-bottom:0;border-radius:44px 44px 0 0;box-shadow:16px 16px 0 0 ${C.ink}}
.sat{border-radius:26px}`,
    body: shots.map(panel).join(''),
  }),
  feature: () => {
    // Ends where the canvas cuts it: right of the item names, and in the gap above the Kaffee row.
    const fg = crop({ src: raw(LOCALE, FEATURE_CROP.raw), top: 0, bottom: 930, x: [0, 760], scale: 0.5, cls: 'card' });
    return {
      css: `body{background:${C.honey}}
.t{left:72px;width:420px;top:0;bottom:0;display:flex;align-items:center}
.t .display{font-size:52px}
.t em{font-style:normal;color:${C.cobalt}}
.card{border:3px solid ${C.ink};border-right:0;border-bottom:0;border-radius:24px 0 0 0;box-shadow:-9px 9px 0 0 ${C.ink}}`,
      body: `<div class="abs t"><div class="display">${TAGLINE.replace('mitsummt.', '<em>mitsummt.</em>')}</div></div>
<div class="abs" style="left:${FEATURE.w - fg.w}px;top:${FEATURE.h - fg.h}px">${fg.html}</div>`,
    };
  },
};
