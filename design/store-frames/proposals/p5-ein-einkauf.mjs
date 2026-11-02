import { C, FEATURE, PHONE, SHOT_COUNT, appIcon, avatar, crop, footCard, hexPath, raw } from '../kit.mjs';
import { FEATURE_CROP, LOCALE, TAGLINE } from '../shots.mjs';

const SCALE = 0.62;
const CARD_TOP = 620;
const GUTTER = 80;
const MEMBER = { A: C.honey, J: C.mint };

// Six steps of one week, the current one filled, so every shot says where it sits in the story.
function track(current) {
  const r = 22;
  const gap = (440 - 2 * r) / (SHOT_COUNT - 1);
  const cx = (i) => GUTTER + r + i * gap;
  const nodes = [...Array(SHOT_COUNT)].map((_, i) => {
    const fill = i === current ? C.honey : i < current ? C.ink : C.surface;
    const text = i === current ? C.ink : i < current ? C.white : C.ink;
    return `<path d="${hexPath(cx(i), 44, r, 6)}" fill="${fill}" stroke="${C.ink}" stroke-width="4"/>
<text x="${cx(i)}" y="46" text-anchor="middle" dominant-baseline="central" font-family="Bricolage Grotesque" font-weight="800" font-size="22" fill="${text}">${i + 1}</text>`;
  });
  return `<svg class="abs" style="left:0;top:40px" width="${PHONE.w}" height="90"><line x1="${cx(0)}" y1="44" x2="${cx(SHOT_COUNT - 1)}" y2="44" stroke="${C.ink}" stroke-width="5"/>${nodes.join('')}</svg>`;
}

function panel(shot) {
  const { day, h, s, who, says } = shot.caption;
  const card = footCard(shot, { scale: SCALE, minTop: CARD_TOP, cls: 'card' });
  const brand = shot.index === 0 ? `<div class="brand"><img src="${appIcon}" alt="">Hummlist</div>` : '';
  return `<section class="panel" style="left:${shot.index * PHONE.w}px">${track(shot.index)}
<div class="abs head">${brand}<div class="day">${day}</div><div class="display">${h}</div><div class="sub">${s}</div></div>
<div class="abs" style="left:${GUTTER}px;top:${card.top}px">${card.html}</div>
<div class="abs bubble" style="top:${card.top + 60}px">${avatar(who, MEMBER[who], 96)}<div class="say">${says}</div></div></section>`;
}

export default {
  id: 'P5',
  name: 'Ein Einkauf',
  direction: 'Geschichte in sechs Bildern',
  rationale: 'Eine Woche von Anna und Jonas in sechs Schritten, mit Wochentag und Sprechblase; Bild 1 trägt Name und Versprechen, die Leiste oben zeigt den Fortschritt.',
  order: ['list', 'add', 'sync', 'order', 'tick', 'invite'],
  captions: {
    list: { day: 'Montag', h: 'Die Einkaufsliste, die euer Haushalt mitsummt', s: 'Was Anna aufschreibt, sieht Jonas gelb markiert.', who: 'A', says: 'Butter und Kaffee sind alle.' },
    add: { day: 'Dienstag', h: 'Vier Buchstaben reichen', s: '„3 Jogh“ und der Vorschlag aus euren Einkäufen.', who: 'J', says: 'Joghurt noch!' },
    sync: { day: 'Mittwoch, 18 Uhr', h: 'Anna ist schon im Laden', s: 'Jonas schreibt Butter drauf, sie sieht es sofort.', who: 'A', says: 'Butter? Hab ich.' },
    order: { day: 'Mittwoch, 18:10', h: 'Der Reihe nach durch den Laden', s: 'Jeder Laden hat seine eigene Reihenfolge.', who: 'A', says: 'Erst Gemüse, dann Kühlregal.' },
    tick: { day: 'Mittwoch, 18:25', h: 'Antippen. Erledigt.', s: 'Keine Werbung. Nur eure Liste.', who: 'A', says: 'Milch ist im Wagen.' },
    invite: { day: 'Samstag', h: 'Wer mit einkauft, kommt dazu', s: 'Per Link oder Code, für Familie und WG.', who: 'J', says: 'Meine Schwester will auch mit drauf.' },
  },
  strip: (shots) => ({
    css: `body{background:${C.surface}}
.head{left:80px;right:80px;top:130px;display:flex;flex-direction:column;align-items:flex-start;gap:18px}
.brand{display:flex;align-items:center;gap:14px;font-family:"Bricolage Grotesque";font-weight:800;font-size:40px;color:${C.cobalt}}
.brand img{width:56px;height:56px;border-radius:14px}
.day{padding:6px 24px;border:4px solid ${C.ink};border-radius:999px;background:${C.white};font-weight:700;font-size:30px}
.head .display{font-size:84px;color:${C.ink}}
.head .sub{font-size:40px;color:${C.ink}}
.card{border:5px solid ${C.ink};border-bottom:0;border-radius:44px 44px 0 0;box-shadow:-14px 14px 0 0 ${C.cobalt}}
.bubble{right:${GUTTER}px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;width:300px}
.say{padding:22px 28px;background:${C.white};border:4px solid ${C.ink};border-radius:32px 8px 32px 32px;box-shadow:0 8px 0 0 ${C.ink};font-weight:650;font-size:34px;line-height:1.25}`,
    body: shots.map(panel).join(''),
  }),
  feature: () => {
    const fg = crop({ src: raw(LOCALE, FEATURE_CROP.raw), top: 0, bottom: 930, scale: 0.36, cls: 'card' });
    const steps = ['Aufschreiben', 'Sehen', 'Abhaken'];
    return {
      css: `body{background:${C.surface}}
.t{left:72px;width:390px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:20px}
.steps{display:flex;flex-direction:column;gap:8px}
.step{display:flex;align-items:center;gap:14px;font-family:"Bricolage Grotesque";font-weight:800;font-size:44px;letter-spacing:-0.03em}
.t .sub{font-size:20px;color:${C.muted}}
.card{border:3px solid ${C.ink};border-bottom:0;border-radius:20px 20px 0 0;box-shadow:8px 8px 0 0 ${C.cobalt}}`,
      body: `<div class="abs t"><div class="steps">${steps
        .map((w, i) => `<div class="step"><svg width="44" height="44"><path d="${hexPath(22, 22, 20, 4)}" fill="${i === 2 ? C.mint : i === 1 ? C.honey : C.white}" stroke="${C.ink}" stroke-width="3"/><text x="22" y="23" text-anchor="middle" dominant-baseline="central" font-family="Bricolage Grotesque" font-weight="800" font-size="20">${i + 1}</text></svg>${w}.</div>`)
        .join('')}</div><div class="sub">${TAGLINE}</div></div>
<div class="abs" style="left:${FEATURE.w - 64 - fg.w}px;top:${FEATURE.h - fg.h}px">${fg.html}</div>`,
    };
  },
};
