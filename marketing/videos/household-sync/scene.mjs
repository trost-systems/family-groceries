// Video 2, household-sync: the two members of „Unser Haushalt“, two real app instances filmed
// on one clock. Anna puts an item on the list; it arrives on Jonas's phone at the measured
// latency; Jonas ticks it off and it leaves both lists. The loop starts and ends on the same lists.

import { captions, esc, frames, page, phone, t, touches } from '../lib.mjs';

const MEMBERS = ['anna', 'jonas'];

export function plan(take, events, lang) {
  const first = (pred) => events.find(pred).t / 1000;
  const open = first((e) => e.client === 'anna' && e.kind === 'press');
  const enter = first((e) => e.client === 'anna' && e.kind === 'key');
  const shown = first((e) => e.kind === 'mark' && e.text.startsWith('shown'));
  const tick = first((e) => e.client === 'jonas' && e.kind === 'press');
  const goneAll = Math.max(...events.filter((e) => e.kind === 'mark' && e.text.startsWith('gone')).map((e) => e.t / 1000));
  const a = frames(open - 1.5);
  const b = frames(goneAll + 2.1);
  const duration = frames(b - a);
  const rel = (s) => frames(s - a);
  const cues = [
    { text: t('household-sync.add', lang), who: 'anna', from: 0, to: rel(enter + 0.15), enter: false },
    { text: t('household-sync.arrive', lang), who: 'jonas', from: rel(enter + 0.15), to: rel(tick - 0.25) },
    { text: t('household-sync.tick', lang), who: 'jonas', from: rel(tick - 0.25), to: rel(goneAll + 1.3) },
    { text: t('household-sync.add', lang), who: 'anna', from: rel(goneAll + 1.3), to: duration, exit: false },
  ];
  // Poster: the item on both lists, the sheet closed, still fresh (mint) on Jonas's.
  const close = events.filter((e) => e.client === 'anna' && e.kind === 'press')[1].t / 1000;
  const poster = frames(rel(close + 0.9));
  const offsets = Object.fromEntries(MEMBERS.map((m) => [m, (take.offsets?.[m] ?? 0) / 1000]));
  const beats = { open, enter, shown, close, tick, gone: goneAll };
  return { a, b, duration, cues, poster, offsets, latency: take.measured, beats: Object.fromEntries(Object.entries(beats).map(([k, v]) => [k, rel(v)])) };
}

// Anna leads: her phone runs off the top edge and holds the add sheet. Jonas's phone steps back
// at her left edge, his real screen top in view (header note and the chilled rows), running off
// the bottom. Wide: Anna on the right, the caption above Jonas's phone. Compact: a deck, Anna on
// top (her head dissolves under the caption), Jonas's phone as a band below, showing its header
// note and the new row.
const LAYOUT = {
  wide: {
    caption: { slot: 'left:calc(30 * var(--u));top:calc(28 * var(--u));width:calc(210 * var(--u))', align: 'left' },
    phones: {
      jonas: { box: { x: 30, y: 150, w: 250.6, h: 220 }, appTop: 0, z: 2 },
      anna: { box: { x: 250, y: -60, w: 303, h: 420 }, appTop: 281.1, z: 3 },
    },
    tags: { jonas: { x: 40, y: 138 }, anna: { x: 488, y: 18 } },
  },
  compact: {
    caption: { slot: 'left:calc(16 * var(--u));top:calc(14 * var(--u));width:calc(326 * var(--u))', align: 'center' },
    phones: {
      anna: { box: { x: 54, y: -204.5, w: 250.6, h: 514.6 }, appTop: 0, z: 3, fadeTop: [252, 284] },
      jonas: { box: { x: 40, y: 264, w: 250.6, h: 200 }, appTop: 0, z: 4 },
    },
    tags: { jonas: { x: 236, y: 252 }, anna: { x: 252, y: 100 } },
  },
};

const AV = { anna: 'tomato', jonas: 'honey' };

function tag(who, lang, at) {
  const name = t(`household-sync.member.${who}`, lang);
  return `<p class="tag" style="left:calc(${at.x} * var(--u));top:calc(${at.y} * var(--u))"><span class="hxp av hxp--${AV[who]}"><b>${esc(name[0])}</b></span>${esc(name)}</p>`;
}

function avatars(who, lang) {
  return who.split('+').map((w) => `<span class="hxp av hxp--${AV[w]}"><b>${esc(t(`household-sync.member.${w}`, lang)[0])}</b></span>`).join('');
}

export function compose({ fmt, lang, events, p }) {
  const L = LAYOUT[fmt];
  const body = [];
  const tweens = [];
  const phones = {};
  for (const m of MEMBERS) {
    const P = L.phones[m];
    phones[m] = phone({ id: m, box: P.box, appTop: P.appTop, z: P.z, fadeTop: P.fadeTop, quiet: m !== 'anna', src: `assets/${m}.mp4`, start: 0, duration: p.duration, mediaStart: p.a + p.offsets[m] });
    body.push(phones[m].html);
  }
  for (const m of MEMBERS) {
    const d = touches({ id: `tap-${m}`, events, client: m, toStage: phones[m].at, toTime: (ms) => ms / 1000 - p.a, from: 0, to: p.duration });
    body.push(d.html);
    tweens.push(...d.tweens);
  }
  for (const [who, at] of Object.entries(L.tags)) body.push(tag(who, lang, at));
  const caps = captions({ id: 'cap', cues: p.cues.map((c) => ({ ...c, iconHtml: avatars(c.who, lang) })), slot: L.caption.slot, align: L.caption.align });
  body.push(caps.html);
  tweens.push(...caps.tweens);
  return page({ fmt, duration: p.duration, title: `household-sync ${lang} ${fmt}`, body: body.join('\n'), tweens });
}
