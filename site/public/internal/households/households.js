'use strict';

const PHONE = { w: 390, h: 844 };

const T = {
  de: {
    peter: 'Peter (lädt ein)', mia: 'Mia (wird eingeladen)',
    list: 'Liste', more: 'Mehr', field: 'Was brauchst du?', edit: 'Anpassen', items: 'Artikel',
    members: (n) => `${n} ${n === 1 ? 'Mitglied' : 'Mitglieder'}`, itemsN: (n) => `${n} Artikel`,
    fresh: (n) => `${n} neu`,
    households: 'Haushalte', newHh: 'Neuer Haushalt', joinCode: 'Mit Code beitreten', invite: 'Einladen',
    voiceRow: 'Sprachassistenten nutzen:', voiceTitle: 'Standard für Siri, Alexa und KI-Assistenten',
    voiceLine: 'Sagst du keinen Haushalt dazu, landen Sachen hier.',
    switchTo: 'Haushalt wechseln',
    emptyList: 'Noch nichts auf der Liste.',
    plusTitle: 'Noch ein Haushalt?', plusLine: 'Für den Verein, die WG oder die Eltern.',
    createTitle: 'Neuer Haushalt', createLine: 'Danach lädst du deine Leute ein.', name: 'Name', kind: 'Was für ein Haushalt?', create: 'Anlegen',
    inviteTitle: 'Leute einladen', person: 'Eine Person', group: 'Gruppenlink',
    share: 'Link teilen', copy: 'Link kopieren', copied: 'Kopiert', code: 'Code',
    personLine: 'Gilt 7 Tage, für eine Person.',
    groupLine: 'Gilt 30 Tage, bis 50 Personen. Du kannst ihn jederzeit sperren.',
    premium: 'Premium gilt für alle im Haushalt.',
    shareTitle: 'Teilen (Simulation)', shareMsg: (who, hh, code) => `${who} lädt dich zu „${hh}“ in Hummlist ein: app.hummlist.com/join/${code}`,
    cancel: 'Abbrechen',
    sentTo: (n) => `Gesendet an ${n} (Simulation)`,
    joinTitle: 'Mit Code beitreten', joinLine: 'Den Code findest du unter dem Einladungslink.', join: 'Beitreten',
    joinErr: 'Simulation: hinter diesem Code steht kein Haushalt.',
    waiting: 'Noch keine Einladung. Teile links einen Link.',
    landTitle: (who, hh) => `${who} lädt dich zu „${hh}“ ein`,
    browserJoin: 'Im Browser beitreten', getApp: 'App laden',
    yourCode: 'Dein Code:', copyCode: 'Code kopieren',
    codeLine: 'Nach der Installation setzt Hummlist den Code für dich ein (Android) oder du fügst ihn mit einem Tipp ein (iPhone).',
    welcome: 'Willkommen', welcomeLine: 'Schön, dass du da bist.',
    inviteFrom: (who) => `Einladung von ${who}`, pasteCode: 'Code einfügen', ownHh: 'Eigenen Haushalt anlegen',
    hopTitle: 'Auch eine Liste für zuhause?', hopLine: 'Lege einen eigenen Haushalt an und lade deine Leute ein.', later: 'Später',
    steps: ['Link', 'App', 'Liste'],
  },
  en: {
    peter: 'Peter (invites)', mia: 'Mia (is invited)',
    list: 'List', more: 'More', field: 'What do you need?', edit: 'Edit', items: 'items',
    members: (n) => `${n} ${n === 1 ? 'member' : 'members'}`, itemsN: (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
    fresh: (n) => `${n} new`,
    households: 'Households', newHh: 'New household', joinCode: 'Join with code', invite: 'Invite',
    voiceRow: 'Voice assistants use:', voiceTitle: 'Default for Siri, Alexa and AI assistants',
    voiceLine: 'When you don\'t name a household, things land here.',
    switchTo: 'Switch household',
    emptyList: 'Nothing on the list yet.',
    plusTitle: 'Another household?', plusLine: 'For the club, the flat or your parents.',
    createTitle: 'New household', createLine: 'Then you invite your people.', name: 'Name', kind: 'What kind of household?', create: 'Create',
    inviteTitle: 'Invite people', person: 'One person', group: 'Group link',
    share: 'Share link', copy: 'Copy link', copied: 'Copied', code: 'Code',
    personLine: 'Valid for 7 days, for one person.',
    groupLine: 'Valid for 30 days, up to 50 people. You can turn it off any time.',
    premium: 'Premium covers everyone in the household.',
    shareTitle: 'Share (simulation)', shareMsg: (who, hh, code) => `${who} invites you to “${hh}” on Hummlist: app.hummlist.com/join/${code}`,
    cancel: 'Cancel',
    sentTo: (n) => `Sent to ${n} (simulation)`,
    joinTitle: 'Join with code', joinLine: 'You find the code under the invite link.', join: 'Join',
    joinErr: 'Simulation: no household behind this code.',
    waiting: 'No invite yet. Share a link on the left.',
    landTitle: (who, hh) => `${who} invites you to “${hh}”`,
    browserJoin: 'Join in the browser', getApp: 'Get the app',
    yourCode: 'Your code:', copyCode: 'Copy code',
    codeLine: 'After you install it, Hummlist fills in the code for you (Android) or you paste it with one tap (iPhone).',
    welcome: 'Welcome', welcomeLine: 'Good to have you here.',
    inviteFrom: (who) => `Invite from ${who}`, pasteCode: 'Paste code', ownHh: 'Create your own household',
    hopTitle: 'A list for home too?', hopLine: 'Create your own household and invite your people.', later: 'Later',
    steps: ['Link', 'App', 'List'],
  },
};

// Job 168's household kinds; the pick prefills the name.
const KINDS = [
  { id: 'partner', de: 'Partner', en: 'Partner', name: { de: 'Unser Haushalt', en: 'Our home' }, icon: 'heart' },
  { id: 'family', de: 'Familie', en: 'Family', name: { de: 'Familie', en: 'Family' }, icon: 'home' },
  { id: 'flat', de: 'WG', en: 'Flatmates', name: { de: 'Unsere WG', en: 'Our flat' }, icon: 'home' },
  { id: 'club', de: 'Verein/Team', en: 'Club/Team', name: { de: 'Unser Verein', en: 'Our club' }, icon: 'people' },
  { id: 'solo', de: 'Nur ich', en: 'Just me', name: { de: 'Meine Liste', en: 'My list' }, icon: 'person' },
];

const item = (emoji, qty, de, en) => ({ emoji, qty, de, en });
const HOUSEHOLDS = () => ({
  home: {
    name: { de: 'Zuhause', en: 'Home' }, icon: 'home', members: 2, items: 8, premium: true, fresh: 0,
    codes: { person: 'R4WN-8HTC', group: 'H3LP-ZK2V' },
    stores: [
      { name: { de: 'Supermarkt', en: 'Supermarket' }, sections: [
        { de: 'Obst & Gemüse', en: 'Produce', items: [item('🍌', '6×', 'Bananen', 'Bananas'), item('🍎', '1 kg', 'Äpfel', 'Apples')] },
        { de: 'Kühlregal', en: 'Chilled', items: [item('🥛', '2×', 'Vollmilch', 'Whole milk'), item('🧈', '', 'Butter', 'Butter'), item('🥚', '10×', 'Eier', 'Eggs')] },
        { de: 'Brot & Backwaren', en: 'Bakery', items: [item('🥖', '4×', 'Brötchen', 'Rolls')] },
      ] },
      { name: { de: 'Drogerie', en: 'Drugstore' }, sections: [
        { de: 'Haushalt', en: 'Household', items: [item('🪥', '', 'Zahnpasta', 'Toothpaste'), item('🧻', '', 'Küchenrolle', 'Paper towels')] },
      ] },
    ],
  },
  fest: {
    name: { de: 'TSV Sommerfest', en: 'TSV Sommerfest' }, icon: 'people', members: 24, items: 31, premium: false, fresh: 3,
    codes: { person: 'K7Q2-M9XD', group: 'TSV8-GR4P' },
    stores: [
      { name: { de: 'Supermarkt', en: 'Supermarket' }, sections: [
        { de: 'Fleisch & Wurst', en: 'Meat', items: [item('🌭', '40×', 'Grillwürstchen', 'Grill sausages')] },
        { de: 'Brot & Backwaren', en: 'Bakery', items: [item('🥖', '60×', 'Brötchen', 'Rolls')] },
        { de: 'Vorrat', en: 'Pantry', items: [item('🫙', '2×', 'Senf', 'Mustard')] },
        { de: 'Haushalt', en: 'Household', items: [item('🍽️', '100×', 'Pappteller', 'Paper plates'), item('🧻', '', 'Servietten', 'Napkins')] },
      ] },
      { name: { de: 'Getränkemarkt', en: 'Drinks store' }, sections: [
        { de: 'Getränke', en: 'Drinks', items: [item('🧃', '6×', 'Apfelschorle', 'Apple spritzer')] },
      ] },
    ],
  },
  parents: {
    name: { de: 'Eltern', en: 'Parents' }, icon: 'people', members: 3, items: 5, premium: false, fresh: 0,
    codes: { person: 'P2EL-T9RN', group: 'EL7N-QX3M' },
    stores: [
      { name: { de: 'Supermarkt', en: 'Supermarket' }, sections: [
        { de: 'Obst & Gemüse', en: 'Produce', items: [item('🥔', '2 kg', 'Kartoffeln', 'Potatoes'), item('🍅', '', 'Tomaten', 'Tomatoes')] },
        { de: 'Kühlregal', en: 'Chilled', items: [item('🥛', '4×', 'Joghurt', 'Yoghurt')] },
        { de: 'Vorrat', en: 'Pantry', items: [item('☕', '', 'Kaffee', 'Coffee')] },
        { de: 'Haushalt', en: 'Household', items: [item('🧽', '', 'Spülmittel', 'Dish soap')] },
      ] },
    ],
  },
});

// Material icons, outlined (24 px grid).
const ICON = {
  cartFilled: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  home: 'M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z',
  people: 'M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 5.5c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5zm0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z',
  person: 'M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  heart: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  personAdd: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm-6 4c.22-.63 3.06-2 6-2 2.96 0 5.8 1.43 6 2H9zm-3-3v-3h3v-2H6V7H4v3H1v2h3v3z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  chevRight: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  chevLeft: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  share: 'M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  paste: 'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z',
  login: 'M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z',
  send: 'M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3 2 10l15 2-15 2 .01 7L23 12 2.01 3z',
};

const CONTACTS = { peter: [['Mia', 'mint'], ['Lea', 'honey'], ['Jonas', 'cobalt']], mia: [['Ben', 'honey'], ['Oma', 'cobalt'], ['Sara', 'mint']] };

function freshApp(hh) {
  return { hh, screen: 'list', sheet: null, share: false, inv: 'person', copied: '', kind: 'family', draft: null, hop: true, joinErr: false };
}

function freshState(keep = {}) {
  const peter = freshApp('home');
  const mia = freshApp(null);
  mia.stage = 'none';
  mia.copied = '';
  return {
    variant: keep.variant || 's1', lang: keep.lang || 'de', theme: keep.theme || 'light',
    hh: HOUSEHOLDS(), mine: { peter: ['home', 'fest', 'parents'], mia: [] },
    voice: { peter: 'home', mia: null },
    users: { peter, mia },
    invite: null,
    sent: { peter: '', mia: '' },
    enter: null,
    seq: 0,
  };
}

let S = freshState();

const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const tx = () => T[S.lang];
const hname = (id) => S.hh[id].name[S.lang] ?? S.hh[id].name.de;
const act = (name, arg = '') => `data-act="${name}" data-arg="${esc(arg)}"`;
const entering = (user, what) => (S.enter && S.enter.user === user && S.enter.what === what ? ' enter' : '');

// ---------- Actions: every tap is one entry, (user, arg) => state change. ----------

function openSheet(u, user, sheet) {
  u.sheet = sheet;
  u.share = false;
  u.copied = '';
  u.joinErr = false;
  S.enter = { user, what: 'sheet' };
}

function switchTo(u, user, id) {
  u.hh = id;
  if (user === 'peter') S.hh[id].fresh = 0;
}

const ACTIONS = {
  openSwitch: (u, user) => openSheet(u, user, 'switch'),
  closeSheet: (u) => { u.sheet = null; u.share = false; },
  pick: (u, user, id) => { switchTo(u, user, id); u.sheet = null; },
  inviteFor: (u, user, id) => { switchTo(u, user, id); u.inv = 'person'; openSheet(u, user, 'invite'); },
  invite: (u, user) => { u.inv = 'person'; openSheet(u, user, 'invite'); },
  voice: (u, user) => openSheet(u, user, 'voice'),
  setVoice: (u, user, id) => { S.voice[user] = id; u.sheet = 'switch'; },
  newHh: (u, user) => {
    const k = KINDS.find((x) => x.id === u.kind);
    u.draft = k.name[S.lang];
    u.sheet = null;
    u.screen = 'create';
    S.enter = { user, what: 'screen' };
  },
  joinCode: (u, user) => openSheet(u, user, 'join'),
  tryJoin: (u) => { u.joinErr = true; },
  kind: (u, _user, id) => {
    u.kind = id;
    u.draft = KINDS.find((x) => x.id === id).name[S.lang];
  },
  backToList: (u, _user) => { u.screen = 'list'; if (!u.hh) u.stage = 'welcome'; },
  create: (u, user) => {
    const id = `new${++S.seq}`;
    const name = (u.draft || '').trim() || KINDS.find((x) => x.id === u.kind).name[S.lang];
    const code = (n) => `N${S.seq}${'QHTKWX'[n]}${user === 'mia' ? 'M' : 'P'}-${['7DXR', 'V3KC'][n]}`;
    S.hh[id] = { name: { de: name, en: name }, icon: KINDS.find((x) => x.id === u.kind).icon, members: 1, items: 0, premium: false, fresh: 0, codes: { person: code(0), group: code(1) }, stores: [] };
    S.mine[user].push(id);
    if (!S.voice[user]) S.voice[user] = id;
    u.hh = id;
    u.screen = 'list';
    u.hop = false;
    if (u.kind === 'solo') {
      S.enter = { user, what: 'screen' };
    } else {
      u.inv = 'person';
      openSheet(u, user, 'invite');
    }
  },
  inv: (u, _user, mode) => { u.inv = mode; u.copied = ''; },
  copy: (u, _user, what) => { u.copied = what; },
  share: (u, user) => { u.share = true; S.enter = { user, what: 'share' }; },
  cancelShare: (u) => { u.share = false; },
  sendTo: (u, user, who) => {
    u.share = false;
    S.sent[user] = who;
    if (user === 'peter' && who === 'Mia') {
      S.invite = { hh: u.hh, mode: u.inv, code: S.hh[u.hh].codes[u.inv], from: 'Peter' };
      const mia = S.users.mia;
      Object.assign(mia, freshApp(mia.hh), { stage: 'landing', hh: mia.hh });
      S.enter = { user: 'mia', what: 'stage' };
    }
  },
  stage: (u, user, stage) => {
    if (!S.invite) return;
    if (stage === 'app') { ACTIONS.joinInvite(u, user); return; }
    u.stage = stage;
    u.screen = 'list';
    u.sheet = null;
    S.enter = { user, what: 'stage' };
  },
  joinInvite: (u, user) => {
    const id = S.invite.hh;
    if (!S.mine.mia.includes(id)) {
      S.mine.mia.push(id);
      S.hh[id].members += 1;
    }
    if (!S.voice.mia) S.voice.mia = id;
    u.hh = id;
    u.stage = 'app';
    u.screen = 'list';
    u.sheet = null;
    S.enter = { user, what: 'stage' };
  },
  ownHh: (u, user) => { u.stage = 'app'; ACTIONS.newHh(u, user); },
  later: (u) => { u.hop = false; },
  pageTo: (_u, user, idx) => scrollPager(user, Number(idx), true),
};

// ---------- Rendering ----------

function listRows(id) {
  const h = S.hh[id];
  const t = tx();
  if (!h.stores.length) return `<p class="empty">${t.emptyList}</p>`;
  return h.stores.map((store) => {
    const count = store.sections.reduce((n, s) => n + s.items.length, 0);
    const sections = store.sections.map((s, i) => {
      const rows = s.items.map((it) => `<div class="row"><span class="row__emoji">${it.emoji}</span><span class="row__name">${it.qty ? `<b>${esc(it.qty)}</b> ` : ''}${esc(it[S.lang])}</span></div>`).join('');
      return `<div class="section"><span>${esc(s[S.lang])}</span></div>${rows}<!--sec${i}-->`;
    }).join('');
    return `<div class="store"><span class="store__badge hx">${esc(store.name[S.lang])}</span><span class="store__line"></span><span class="store__count"><b>${count}</b> ${t.items}</span>${icon('expand', 'ic ic--s')}</div>${sections}`;
  }).join('');
}

function hopCard(user) {
  const t = tx();
  return `<div class="hop${entering(user, 'stage')}">
    <span class="hop__icon hx">${icon('home', 'ic ic--m')}</span>
    <span class="hop__body"><strong>${t.hopTitle}</strong><span>${t.hopLine}</span></span>
    <span class="hop__actions"><button type="button" class="btn btn--primary btn--s hx" ${act('newHh')}>${t.create}</button><button type="button" class="textbtn" ${act('later')}>${t.later}</button></span>
  </div>`;
}

function listPage(user, id) {
  let rows = listRows(id);
  if (user === 'mia' && S.users.mia.hop) rows = rows.replace('<!--sec0-->', hopCard(user));
  return `<div class="page">${rows}<div class="tail"></div></div>`;
}

function chip(user) {
  const u = S.users[user];
  if (S.variant === 's2') return '';
  if (S.variant === 's3') return `<span class="chip hx" data-chip>${esc(hname(u.hh))}</span>`;
  return `<button type="button" class="chip hx" ${act('openSwitch')} aria-label="${tx().switchTo}"><span>${esc(hname(u.hh))}</span>${icon('expand', 'ic ic--m')}</button>`;
}

function topBar(user) {
  const t = tx();
  const inv = S.variant === 's3' ? `<button type="button" class="iconbtn" ${act('invite')} aria-label="${t.invite}">${icon('personAdd', 'ic')}</button>` : '';
  return `${chip(user)}<div class="topbar hx">${inv}<span class="edit hx">${t.edit}</span></div>`;
}

function pill(user) {
  const t = tx();
  const u = S.users[user];
  const hhSeg = S.variant === 's2'
    ? `<button type="button" class="tab tab--hh hx" ${act('openSwitch')} aria-label="${t.switchTo}">${icon(S.hh[u.hh].icon, 'ic ic--m')}<span>${esc(hname(u.hh))}</span></button><span class="pill__div"></span>`
    : '';
  return `<nav class="pill hx">${hhSeg}<span class="tab tab--on hx">${icon('cartFilled', 'ic ic--m')}<span>${t.list}</span></span><span class="tab">${icon('menu', 'ic ic--m')}<span>${t.more}</span></span></nav>`;
}

function bottomChrome(user) {
  return `<div class="fade"></div><div class="field hx"><span class="field__hint">${tx().field}</span>${icon('mic')}</div>${pill(user)}`;
}

function pager(user) {
  const t = tx();
  const ids = S.mine[user];
  const pages = ids.map((id) => `<section class="pg" data-hh="${id}">${listPage(user, id)}</section>`).join('');
  const plus = `<section class="pg pg--plus"><div class="plus">
    <span class="plus__icon hx">${icon('add', 'ic')}</span>
    <strong>${t.plusTitle}</strong><span>${t.plusLine}</span>
    <button type="button" class="btn btn--primary hx" ${act('newHh')}>${icon('add', 'ic ic--m')}<span>${t.newHh}</span></button>
    <button type="button" class="btn hx" ${act('joinCode')}>${icon('login', 'ic ic--m')}<span>${t.joinCode}</span></button>
  </div></section>`;
  const idx = ids.indexOf(S.users[user].hh);
  const dots = [...ids, '+'].map((id, i) => (id === '+'
    ? `<button type="button" class="dot dot--plus${i === idx ? ' on' : ''}" ${act('pageTo', i)} aria-label="${t.newHh}">${icon('add', 'ic')}</button>`
    : `<button type="button" class="dot${i === idx ? ' on' : ''}" ${act('pageTo', i)} aria-label="${esc(hname(id))}"></button>`)).join('');
  return `<div class="pager" data-pager>${pages}${plus}</div>
    <div class="dots"><button type="button" class="arrow" data-step="-1" aria-label="←">${icon('chevLeft', 'ic ic--m')}</button><span class="dots__row">${dots}</span><button type="button" class="arrow" data-step="1" aria-label="→">${icon('chevRight', 'ic ic--m')}</button></div>`;
}

function listScreen(user) {
  const u = S.users[user];
  const body = S.variant === 's3' ? pager(user) : `<div class="content">${listPage(user, u.hh)}</div>`;
  return `<div class="screen screen--list v-${S.variant}${entering(user, 'screen')}">${body}${topBar(user)}${bottomChrome(user)}</div>`;
}

function createScreen(user) {
  const t = tx();
  const u = S.users[user];
  const chips = KINDS.map((k) => `<button type="button" class="kind hx${u.kind === k.id ? ' on' : ''}" ${act('kind', k.id)} aria-pressed="${u.kind === k.id}">${esc(k[S.lang])}</button>`).join('');
  return `<div class="screen screen--create${entering(user, 'screen')}">
    <button type="button" class="back hx" ${act('backToList')} aria-label="←">${icon('back', 'ic')}</button>
    <div class="create">
      <div class="create__title">${t.createTitle}</div>
      <p class="create__line">${t.createLine}</p>
      <label class="lbl" for="name-${user}">${t.name}</label>
      <div class="input hx"><input id="name-${user}" data-draft="${user}" value="${esc(u.draft || '')}" autocomplete="off"></div>
      <div class="lbl">${t.kind}</div>
      <div class="kinds">${chips}</div>
    </div>
    <button type="button" class="btn btn--primary btn--wide create__go hx" ${act('create')}>${t.create}</button>
  </div>`;
}

function hhIcon(id, size = '') {
  return `<span class="hhicon hx${size}">${icon(S.hh[id].icon, 'ic ic--m')}</span>`;
}

function switchSheet(user) {
  const t = tx();
  const u = S.users[user];
  const rows = S.mine[user].map((id) => {
    const h = S.hh[id];
    const fresh = h.fresh ? `<span class="fresh"><i></i>${t.fresh(h.fresh)}</span>` : '';
    return `<div class="hhrow${id === u.hh ? ' on' : ''}" role="button" tabindex="0" ${act('pick', id)}>
      ${hhIcon(id)}
      <span class="hhrow__text"><span class="hhrow__name"><strong>${esc(hname(id))}</strong>${fresh}</span><span>${t.members(h.members)} · ${t.itemsN(h.items)}</span></span>
      <button type="button" class="iconbtn iconbtn--o hx" ${act('inviteFor', id)} aria-label="${t.invite}: ${esc(hname(id))}">${icon('personAdd', 'ic ic--m')}</button>
      <span class="hhrow__check">${id === u.hh ? icon('check', 'ic') : ''}</span>
    </div>`;
  }).join('');
  const voice = S.voice[user] ? `<button type="button" class="voicerow" ${act('voice')}>${icon('mic', 'ic ic--m')}<span>${t.voiceRow} <b>${esc(hname(S.voice[user]))}</b></span>${icon('chevRight', 'ic ic--m')}</button>` : '';
  return `<div class="sheet__title">${t.households}</div>
    <div class="hhrows">${rows}</div>
    <div class="sheet__actions">
      <button type="button" class="btn hx" ${act('newHh')}>${icon('add', 'ic ic--m')}<span>${t.newHh}</span></button>
      <button type="button" class="btn hx" ${act('joinCode')}>${icon('login', 'ic ic--m')}<span>${t.joinCode}</span></button>
    </div>
    ${voice}`;
}

function voiceSheet(user) {
  const t = tx();
  const rows = S.mine[user].map((id) => `<div class="hhrow${id === S.voice[user] ? ' on' : ''}" role="button" tabindex="0" ${act('setVoice', id)}>
      ${hhIcon(id)}<span class="hhrow__text"><strong>${esc(hname(id))}</strong></span>
      <span class="radio${id === S.voice[user] ? ' on' : ''}"></span></div>`).join('');
  return `<div class="sheet__title sheet__title--s">${t.voiceTitle}</div><p class="sheet__line">${t.voiceLine}</p><div class="hhrows">${rows}</div>`;
}

function joinSheet(user) {
  const t = tx();
  const u = S.users[user];
  return `<div class="sheet__title">${t.joinTitle}</div>
    <div class="input input--code hx"><input placeholder="XXXX-XXXX" autocomplete="off" aria-label="${t.code}"></div>
    <p class="sheet__line">${u.joinErr ? t.joinErr : t.joinLine}</p>
    <button type="button" class="btn btn--primary btn--wide hx" ${act('tryJoin')}>${t.join}</button>`;
}

// Fake QR: finder squares plus a hashed module pattern; not a scannable code.
function qr(seed) {
  const n = 25;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && rnd() < 0.48) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    rects += `<path d="M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5z" fill-rule="evenodd"/><rect x="${fx + 2}" y="${fy + 2}" width="3" height="3"/>`;
  }
  return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR"><rect class="qr__bg" x="-2" y="-2" width="${n + 4}" height="${n + 4}"/>${rects}</svg>`;
}

function inviteSheet(user) {
  const t = tx();
  const u = S.users[user];
  const h = S.hh[u.hh];
  const code = h.codes[u.inv];
  const copyBtn = (what, label) => `<button type="button" class="btn hx" ${act('copy', what)}>${icon(u.copied === what ? 'check' : 'copy', 'ic ic--m')}<span>${u.copied === what ? t.copied : label}</span></button>`;
  const body = u.inv === 'person'
    ? `<button type="button" class="btn btn--primary btn--wide btn--big hx" ${act('share')}>${icon('share', 'ic')}<span>${t.share}</span></button>
       <div class="codebox"><span class="codebox__main"><span class="codebox__label">${t.code}</span><span class="codebox__code">${code}</span></span>${copyBtn('link', t.copy)}</div>
       <p class="sheet__line">${t.personLine}</p>`
    : `<div class="qrwrap">${qr(code)}</div>
       <p class="sheet__line sheet__line--c">${t.groupLine}</p>
       <div class="sheet__actions"><button type="button" class="btn btn--primary hx" ${act('share')}>${icon('share', 'ic ic--m')}<span>${t.share}</span></button>${copyBtn('group', t.copy)}</div>`;
  const prem = h.premium ? `<p class="premium">${t.premium}</p>` : '';
  return `<div class="sheet__title">${t.inviteTitle}</div>
    <div class="sheet__hh">${hhIcon(u.hh, ' hhicon--s')}<span>${esc(hname(u.hh))}</span></div>
    <div class="segs hx"><button type="button" class="segbtn hx${u.inv === 'person' ? ' on' : ''}" ${act('inv', 'person')}>${icon('person', 'ic ic--m')}<span>${t.person}</span></button><button type="button" class="segbtn hx${u.inv === 'group' ? ' on' : ''}" ${act('inv', 'group')}>${icon('people', 'ic ic--m')}<span>${t.group}</span></button></div>
    ${body}${prem}`;
}

function shareSheet(user) {
  const t = tx();
  const u = S.users[user];
  const code = S.hh[u.hh].codes[u.inv];
  const who = user === 'peter' ? 'Peter' : 'Mia';
  const people = CONTACTS[user].map(([n, c]) => `<button type="button" class="contact" ${act('sendTo', n)}><span class="avatar avatar--${c}">${n[0]}</span><span>${n}</span></button>`).join('');
  return `<div class="share${entering(user, 'share')}">
    <div class="share__title">${t.shareTitle}</div>
    <div class="share__msg">${icon('link', 'ic ic--m')}<span>${esc(t.shareMsg(who, hname(u.hh), code))}</span></div>
    <div class="contacts">${people}</div>
    <button type="button" class="textbtn share__cancel" ${act('cancelShare')}>${t.cancel}</button>
  </div>`;
}

function sheet(user) {
  const u = S.users[user];
  if (!u.sheet) return '';
  const body = { switch: switchSheet, voice: voiceSheet, join: joinSheet, invite: inviteSheet }[u.sheet](user);
  const enter = entering(user, 'sheet');
  return `<div class="scrim${enter}" ${act('closeSheet')}></div>
    <div class="sheet sheet--${u.sheet}${enter}" role="dialog"><span class="grabber"></span>${body}</div>
    ${u.share ? shareSheet(user) : ''}`;
}

function waitingScreen() {
  return `<div class="screen screen--wait"><span class="wait__icon hx">${icon('link', 'ic')}</span><p>${tx().waiting}</p></div>`;
}

function landingScreen(user) {
  const t = tx();
  const inv = S.invite;
  const h = S.hh[inv.hh];
  const u = S.users[user];
  const prem = h.premium ? `<p class="land__small">${t.premium}</p>` : '';
  return `<div class="screen screen--land${entering(user, 'stage')}">
    <div class="url">${icon('lock', 'ic ic--s')}<span>app.hummlist.com/join/${inv.code}</span></div>
    <div class="land">
      <div class="wordmark">Hummlist</div>
      <div class="land__card">
        ${hhIcon(inv.hh, ' hhicon--l')}
        <div class="land__title">${esc(t.landTitle(inv.from, hname(inv.hh)))}</div>
        <div class="land__meta">${t.members(h.members)} · ${t.itemsN(h.items)}</div>
      </div>
      <button type="button" class="btn btn--primary btn--wide btn--big hx" ${act('stage', 'app')}>${t.browserJoin}</button>
      <div class="land__label">${t.getApp}</div>
      <div class="land__stores"><button type="button" class="btn hx" ${act('stage', 'welcome')}>App Store</button><button type="button" class="btn hx" ${act('stage', 'welcome')}>Google Play</button></div>
      ${prem}
      <div class="land__code"><span class="codebox__main"><span class="codebox__label">${t.yourCode}</span><span class="codebox__code">${inv.code}</span></span><button type="button" class="btn btn--s hx" ${act('copy', 'code')}>${icon(u.copied === 'code' ? 'check' : 'copy', 'ic ic--s')}<span>${u.copied === 'code' ? t.copied : t.copyCode}</span></button></div>
      <p class="land__small">${t.codeLine}</p>
    </div>
  </div>`;
}

function welcomeScreen(user) {
  const t = tx();
  const inv = S.invite;
  const h = S.hh[inv.hh];
  return `<div class="screen screen--welcome${entering(user, 'stage')}">
    <div class="welcome">
      <div class="wordmark">Hummlist</div>
      <div class="welcome__title">${t.welcome}</div>
      <p class="welcome__line">${t.welcomeLine}</p>
      <div class="invcard">
        <span class="invcard__from">${t.inviteFrom(inv.from)}</span>
        <div class="invcard__hh">${hhIcon(inv.hh)}<span><strong>${esc(hname(inv.hh))}</strong><span>${t.members(h.members)} · ${t.itemsN(h.items)}</span></span></div>
        <button type="button" class="btn btn--primary btn--wide hx" ${act('joinInvite')}>${t.join}</button>
      </div>
      <button type="button" class="paste" ${act('joinInvite')}>${icon('paste', 'ic ic--s')}<span>${t.pasteCode}</span></button>
    </div>
    <button type="button" class="textbtn welcome__own" ${act('ownHh')}>${t.ownHh}</button>
  </div>`;
}

function phoneBody(user) {
  const u = S.users[user];
  if (user === 'mia' && u.stage !== 'app') {
    return { none: waitingScreen, landing: landingScreen, welcome: welcomeScreen }[u.stage](user);
  }
  return (u.screen === 'create' ? createScreen(user) : listScreen(user)) + sheet(user);
}

function phone(user) {
  return `<div class="phone" data-user="${user}">
    ${phoneBody(user)}
    <div class="status"><span>9:41</span><span class="status__icons"><i class="sig"></i><i class="wifi"></i><i class="bat"></i></span></div>
    <div class="dynisland"></div>
    <div class="home"></div>
  </div>`;
}

function stepper() {
  const t = tx();
  const stage = S.users.mia.stage;
  const at = { none: -1, landing: 0, welcome: 1, app: 2 }[stage];
  const targets = ['landing', 'welcome', 'app'];
  return `<ol class="stepper">${t.steps.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><button type="button" ${S.invite ? '' : 'disabled'} data-user="mia" ${act('stage', targets[i])}><span class="stepper__n">${i < at ? icon('check', 'ic ic--s') : i + 1}</span><span>${s}</span></button></li>`).join('')}</ol>`;
}

function render() {
  const t = tx();
  const sent = (user) => `<p class="sent" aria-live="polite">${S.sent[user] ? `${icon('send', 'ic ic--s')}<span>${esc(t.sentTo(S.sent[user]))}</span>` : ''}</p>`;
  document.getElementById('frames').innerHTML = ['peter', 'mia'].map((user) => `<figure class="frame" data-id="${user}">
    <figcaption><strong>${t[user]}</strong></figcaption>
    <div class="viewport">${phone(user)}</div>
    ${user === 'mia' ? stepper() : ''}${sent(user)}
  </figure>`).join('');
  const html = document.documentElement;
  html.lang = S.lang;
  html.dataset.theme = S.theme;
  S.enter = null;
  layout();
  document.querySelectorAll('.hx').forEach((el) => hexObserver.observe(el));
  ['peter', 'mia'].forEach((user) => scrollPager(user, S.mine[user].indexOf(S.users[user].hh), false));
}

// ---------- S3 pager ----------

function scrollPager(user, idx, smooth) {
  const el = document.querySelector(`.phone[data-user=${user}] [data-pager]`);
  if (!el || idx < 0) return;
  el.scrollTo({ left: idx * PHONE.w, behavior: smooth ? 'smooth' : 'instant' });
  if (!smooth) syncPager(user, el);
}

function syncPager(user, el) {
  const ids = S.mine[user];
  const idx = Math.round(el.scrollLeft / PHONE.w);
  const ph = el.closest('.phone');
  ph.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('on', i === idx));
  if (idx < ids.length) {
    S.users[user].hh = ids[idx];
    if (user === 'peter') S.hh[ids[idx]].fresh = 0;
    const c = ph.querySelector('[data-chip]');
    c.textContent = hname(ids[idx]);
  }
  ph.querySelector('[data-chip]').classList.toggle('chip--off', idx >= ids.length);
}

document.addEventListener('scroll', (ev) => {
  const el = ev.target;
  if (!(el instanceof Element) || !el.matches('[data-pager]')) return;
  clearTimeout(el.settle);
  el.settle = setTimeout(() => syncPager(el.closest('.phone').dataset.user, el), 90);
}, true);

// ---------- Layout and hex shapes ----------

function layout() {
  const vw = document.documentElement.clientWidth;
  const vh = globalThis.innerHeight;
  const narrow = vw < 820;
  const gap = narrow ? 12 : 40;
  const col = narrow ? vw - 2 * gap : (vw - 3 * gap) / 2;
  let s = Math.min(1, col / PHONE.w);
  if (!narrow) {
    const top = document.querySelector('.bar').offsetHeight;
    s = Math.min(s, Math.max(0.7, (vh - top - 130) / PHONE.h));
  }
  document.documentElement.style.setProperty('--s', String(s));
}

const TIP = 0.2887;
function hexPath(w, h, inset, r) {
  const tip = Math.min(h * TIP, w / 2);
  const pts = [[tip, 0], [w - tip, 0], [w, h / 2], [w - tip, h], [tip, h], [0, h / 2]]
    .map(([x, y]) => [inset + x * (w - 2 * inset) / w, inset + y * (h - 2 * inset) / h]);
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const toward = (a, b, len) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      const k = Math.min(len, l / 2) / l;
      return [a[0] + dx * k, a[1] + dy * k];
    };
    const a = toward(p, prev, r);
    const b = toward(p, next, r);
    d += `${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return `${d}Z`;
}

const hexObserver = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) continue;
    let svg = el.querySelector(':scope > svg.hexbg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hexbg');
      svg.setAttribute('aria-hidden', 'true');
      svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
      el.prepend(svg);
    }
    const sw = parseFloat(getComputedStyle(el).getPropertyValue('--hx-sw')) || 0;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.firstChild.setAttribute('d', hexPath(w, h, sw / 2, 8 * h / 48));
  }
});

// ---------- Events ----------

document.addEventListener('click', (ev) => {
  const seg = ev.target.closest('.seg button');
  if (seg) {
    const control = seg.parentElement.dataset.control;
    S[control] = seg.dataset.value;
    seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
    if (control === 'variant') Object.values(S.users).forEach((u) => { u.sheet = null; u.share = false; });
    render();
    return;
  }
  if (ev.target.closest('[data-reset]')) {
    S = freshState(S);
    render();
    return;
  }
  const arrow = ev.target.closest('.arrow');
  if (arrow) {
    const ph = arrow.closest('.phone');
    const el = ph.querySelector('[data-pager]');
    const max = S.mine[ph.dataset.user].length;
    scrollPager(ph.dataset.user, Math.max(0, Math.min(max, Math.round(el.scrollLeft / PHONE.w) + Number(arrow.dataset.step))), true);
    return;
  }
  const a = ev.target.closest('[data-act]');
  if (!a) return;
  const user = a.dataset.user || a.closest('.phone')?.dataset.user;
  const fn = ACTIONS[a.dataset.act];
  if (!user || !fn) return;
  fn(S.users[user], user, a.dataset.arg);
  if (a.dataset.act === 'pageTo') return;
  render();
});

document.addEventListener('input', (ev) => {
  const user = ev.target.dataset && ev.target.dataset.draft;
  if (user) S.users[user].draft = ev.target.value;
});

globalThis.addEventListener('resize', layout);
render();
