import { ICON } from './icons.js';

const PHONE = { w: 390, h: 844 };

const CATS = [
  ['produce', 'Obst & Gemüse', 'Fruit & veg'],
  ['bakery', 'Brot & Backwaren', 'Bread & bakery'],
  ['chilled', 'Kühlregal', 'Chilled'],
  ['pantry', 'Vorrat & Konserven', 'Pantry'],
  ['drinks', 'Getränke', 'Drinks'],
  ['household', 'Haushalt', 'Household'],
];

const STAPLES = [
  ['milk', '🥛', 'Milch', 'Milk', 'chilled'],
  ['bread', '🍞', 'Brot', 'Bread', 'bakery'],
  ['eggs', '🥚', 'Eier', 'Eggs', 'chilled'],
  ['bananas', '🍌', 'Bananen', 'Bananas', 'produce'],
  ['butter', '🧈', 'Butter', 'Butter', 'chilled'],
  ['tomatoes', '🍅', 'Tomaten', 'Tomatoes', 'produce'],
  ['cheese', '🧀', 'Käse', 'Cheese', 'chilled'],
  ['coffee', '☕', 'Kaffee', 'Coffee', 'pantry'],
  ['pasta', '🍝', 'Nudeln', 'Pasta', 'pantry'],
  ['apples', '🍎', 'Äpfel', 'Apples', 'produce'],
  ['water', '💧', 'Wasser', 'Water', 'drinks'],
  ['tp', '🧻', 'Klopapier', 'Toilet paper', 'household'],
];

const STORES = ['EDEKA', 'REWE', 'Lidl', 'Aldi Süd', 'Aldi Nord', 'Kaufland', 'Netto', 'Penny', 'dm', 'Rossmann', 'Baumarkt'];

const KINDS = ['partner', 'family', 'flat', 'club', 'solo'];

const T = {
  de: {
    value: 'Eine Einkaufsliste für euren Haushalt. <mark>Live auf jedem Handy.</mark>',
    google: 'Mit Google anmelden', apple: 'Mit Apple anmelden', email: 'Weiter mit E-Mail', legal: 'Impressum · Datenschutz',
    usage: 'Nutzungsdaten',
    consentQ: 'Darf Hummlist Nutzungsdaten erfassen?',
    consentBody: 'Hummlist (Anbieter: Peter Trost) möchte verstehen, welche Funktionen genutzt werden, Fehler finden, messen, ob sich Hummlist trägt, und neue Funktionen schrittweise freischalten. Dafür speichert Hummlist eine zufällige Kennung auf diesem Gerät und sendet damit pseudonyme Nutzungsdaten, Fehlerberichte, die Kennung deines Haushalts und technische Angaben zu Gerät oder Browser an unseren Dienstleister PostHog (Server in der EU). Listeninhalte, Namen und E-Mail-Adressen werden nie gesendet. Du kannst jederzeit unter Mehr → Nutzungsdaten widerrufen. Mehr in der Datenschutzerklärung.',
    privacy: 'Datenschutzerklärung', deny: 'Nicht erlauben', allow: 'Erlauben',
    welcomeTitle: 'Willkommen bei Hummlist',
    welcomeText: 'Hummlist teilt eine Einkaufsliste mit allen in deinem Haushalt. Erstelle einen neuen Haushalt oder nimm eine Einladung an.',
    createTitle: 'Haushalt erstellen', createHint: 'Eine neue Liste, zu der du danach deinen Partner einlädst.',
    joinTitle: 'Einladung annehmen', joinHint: 'Du hast einen Link oder einen Code bekommen.',
    kindTitle: 'Mit wem kaufst du ein?',
    kindSub: 'Danach richten sich Name, Einladung und deine ersten Tipps.',
    kinds: { partner: 'Partner·in', family: 'Familie', flat: 'WG', club: 'Verein oder Team', solo: 'Nur ich' },
    skip: 'Überspringen', next: 'Weiter',
    nameLabel: 'Name des Haushalts',
    names: { partner: 'Unser Haushalt', family: 'Unsere Familie', flat: 'Unsere WG', club: 'Unser Verein', solo: 'Meine Liste', none: 'Unser Haushalt' },
    stores: 'Läden', storesHint: 'Wähl die Läden, in denen ihr einkauft. In dieser Reihenfolge stehen sie in der Liste.',
    ownStore: 'Eigenen Laden hinzufügen', storeNote: 'Ladennamen verwenden wir nur, damit du siehst, für welchen Laden eine Liste ist.',
    starterTitle: 'Was fehlt gerade?',
    starterSub: 'Tipp an, was auf die Liste soll. Hummlist sortiert es für dich.',
    starterEmpty: 'Noch leer. Was du antippst, landet hier, schon einsortiert.',
    yourList: (solo) => (solo ? 'Deine Liste' : 'Eure Liste'),
    items: (n) => (n === 1 ? '1 Artikel' : `${n} Artikel`),
    nextWith: (n) => (n ? `Weiter mit ${n}` : 'Weiter'),
    inviteTitle: { partner: 'Partner einladen', family: 'Familie einladen', flat: 'Mitbewohner einladen', club: 'Mitglieder einladen', none: 'Partner einladen' },
    inviteBody: (kind, n) => {
      if (kind === 'club') return n ? `Schick jedem Mitglied einen eigenen Link. Alle sehen dieselbe Liste und die ${n} Artikel sofort.` : 'Schick jedem Mitglied einen eigenen Link. Alle sehen dieselbe Liste.';
      return n ? `Teile die Liste mit der Person, mit der du einkaufst. Sie sieht deine ${n} Artikel sofort.` : 'Teile den Link oder den Code mit der Person, mit der du einkaufst. Die Einladung gilt 7 Tage und für eine Person.';
    },
    waiting: (n) => (n ? `${n} Artikel warten schon` : 'Die Liste ist noch leer'),
    code: 'Code', valid: 'gültig 7 Tage',
    later: 'Später', invite: 'Einladen', toList: 'Weiter zur Liste', shareAgain: 'Erneut teilen',
    edit: 'Anpassen', field: 'Was brauchst du?', list: 'Liste', more: 'Mehr',
    empty: 'Die Liste ist leer. Tippe unten ein, was fehlt.',
    first: 'Erste Schritte', hide: 'Ausblenden',
    stepStarted: 'Liste angelegt', stepJoined: 'Haushalt beigetreten',
    stepInvite: { partner: 'Partner einladen', family: 'Familie einladen', flat: 'Mitbewohner einladen', club: 'Mitglieder einladen', none: 'Jemanden einladen' },
    stepInviteSub: 'Sieht deine Artikel sofort und kann selbst etwas draufsetzen.',
    stepInviteSubClub: 'Alle sehen dieselbe Liste und können selbst etwas draufsetzen.',
    kindPayoff: (n) => `Vorschlag für den Namen: „${n}“`,
    howInvite: ['Du teilst den Link, zum Beispiel im Chat.', 'Die Person meldet sich an und tritt bei.', 'Ab dann seht ihr dieselbe Liste, live.'],
    stepVoice: 'Per Sprache hinzufügen', stepVoiceSub: 'Tipp aufs Mikrofon und sag: „Milch und Brot“.',
    stepShop: 'Einmal einkaufen', stepShopSub: 'Tippen hakt ab · Halten bearbeitet',
    stepAi: 'KI-Assistenten verbinden', stepAiSub: 'Mehr → Zugänge. Er setzt Dinge auf eure Liste.', open: 'Öffnen',
    of: (a, b) => `${a} von ${b}`,
    tipHidden: 'Für immer ausgeblendet. Wieder lesbar unter Mehr → Tipps.',
  },
  en: {
    value: 'One shopping list for your household. <mark>Live on every phone.</mark>',
    google: 'Sign in with Google', apple: 'Sign in with Apple', email: 'Continue with email', legal: 'Imprint · Privacy',
    usage: 'Usage data',
    consentQ: 'May Hummlist collect usage data?',
    consentBody: 'Hummlist (run by Peter Trost) wants to see which features are used, find bugs, measure whether Hummlist pays for itself and switch new features on step by step. For that, Hummlist stores a random ID on this device and uses it to send pseudonymous usage data, error reports, your household\'s ID and technical details of your device or browser to our service provider PostHog (servers in the EU). List contents, names and e-mail addresses are never sent. You can withdraw any time under More → Usage data. More in the privacy policy.',
    privacy: 'privacy policy', deny: 'Don\'t allow', allow: 'Allow',
    welcomeTitle: 'Welcome to Hummlist',
    welcomeText: 'Hummlist shares one shopping list with everyone in your household. Create a new household or accept an invite.',
    createTitle: 'Create a household', createHint: 'A new list; you invite your partner next.',
    joinTitle: 'Join with an invite', joinHint: 'You got a link or a code.',
    kindTitle: 'Who do you shop with?',
    kindSub: 'This sets the name, the invite and your first tips.',
    kinds: { partner: 'Partner', family: 'Family', flat: 'Flatmates', club: 'Club or team', solo: 'Just me' },
    skip: 'Skip', next: 'Continue',
    nameLabel: 'Household name',
    names: { partner: 'Our household', family: 'Our family', flat: 'Our flat', club: 'Our club', solo: 'My list', none: 'Our household' },
    stores: 'Stores', storesHint: 'Pick the stores you shop at. Your list shows them in this order.',
    ownStore: 'Add your own store', storeNote: 'We use shop names only so you can see which shop a list is for.',
    starterTitle: 'What do you need right now?',
    starterSub: 'Tap what should go on the list. Hummlist sorts it for you.',
    starterEmpty: 'Still empty. Whatever you tap lands here, already sorted.',
    yourList: () => 'Your list',
    items: (n) => (n === 1 ? '1 item' : `${n} items`),
    nextWith: (n) => (n ? `Continue with ${n}` : 'Continue'),
    inviteTitle: { partner: 'Invite your partner', family: 'Invite your family', flat: 'Invite your flatmates', club: 'Invite members', none: 'Invite your partner' },
    inviteBody: (kind, n) => {
      if (kind === 'club') return n ? `Send each member their own link. Everyone sees the same list and the ${n} items right away.` : 'Send each member their own link. Everyone sees the same list.';
      return n ? `Share the list with the person you shop with. They see your ${n} items right away.` : 'Share the link or the code with the person you shop with. The invite is valid for 7 days and for one person.';
    },
    waiting: (n) => (n ? `${n} items already waiting` : 'The list is still empty'),
    code: 'Code', valid: 'valid 7 days',
    later: 'Later', invite: 'Invite', toList: 'Go to the list', shareAgain: 'Share again',
    edit: 'Edit', field: 'What do you need?', list: 'List', more: 'More',
    empty: 'The list is empty. Type below what you need.',
    first: 'First steps', hide: 'Hide',
    stepStarted: 'List started', stepJoined: 'Joined the household',
    stepInvite: { partner: 'Invite your partner', family: 'Invite your family', flat: 'Invite your flatmates', club: 'Invite members', none: 'Invite someone' },
    stepInviteSub: 'They see your items right away and can add their own.',
    stepInviteSubClub: 'Everyone sees the same list and can add to it.',
    kindPayoff: (n) => `Suggested name: “${n}”`,
    howInvite: ['You share the link, in a chat for example.', 'They sign in and join.', 'From then on you see the same list, live.'],
    stepVoice: 'Add by voice', stepVoiceSub: 'Tap the mic and say: “milk and bread”.',
    stepShop: 'Do one shop', stepShopSub: 'Tap ticks off · Hold to edit',
    stepAi: 'Connect an AI assistant', stepAiSub: 'More → Access. It puts things on your list.', open: 'Open',
    of: (a, b) => `${a} of ${b}`,
    tipHidden: 'Hidden for good. Readable again under More → Tips.',
  },
};

const STEPS = [
  { id: 'login', label: 'Sign-in', badge: 'changed' },
  { id: 'consent', label: 'Usage data', badge: 'same' },
  { id: 'welcome', label: 'Welcome', badge: 'same' },
  { id: 'kind', label: 'Who', badge: 'new' },
  { id: 'create', label: 'Name + stores', badge: 'changed' },
  { id: 'starter', label: 'What you need', badge: 'new' },
  { id: 'invite', label: 'Invite', badge: 'changed' },
  { id: 'list', label: 'List', badge: 'changed' },
];

const NOTES = {
  login: {
    title: 'Sign-in with a value line',
    why: 'Today nothing says what Hummlist is before the account wall (research B: sign-in before value is the biggest bad friction). One line, no extra step.',
    data: 'None new.',
    event: 'None (no consent yet).',
  },
  consent: {
    title: 'Analytics question, unchanged',
    why: 'Legal text and equal buttons stay byte for byte (versioned 2026-11-01). Everything below that goes to PostHog needs this yes.',
    data: 'The answer, on the device and on the server (exists).',
    event: '<code>first_open</code> after a yes (exists).',
  },
  welcome: {
    title: 'Create or join, unchanged',
    why: 'An invite link still skips straight to the join screen, so a joiner reaches the shared list in sign-in, consent, join. „Einladung annehmen“ here jumps to the list as a joiner sees it.',
    data: 'None new.',
    event: '<code>onboarding_step_viewed {step: welcome}</code>',
  },
  kind: {
    title: 'New: who do you shop with?',
    why: 'Good friction: one tap that visibly changes the next screens (name prefill, invite title and copy, checklist, which hints). „Nur ich“ drops the invite step. „Verein oder Team“ opens the club path (multi-member invite copy, AI assistant item). Skip is a full button.',
    data: '<code>households.kind</code> (partner, family, flat, club, solo). Art. 6(1)(b): it configures what the user sees. Shared with job 169.',
    event: '<code>onboarding_step_viewed {step: kind}</code>; the answer rides on <code>onboarding_completed {kind}</code>.',
  },
  create: {
    title: 'Name and stores, prefilled',
    why: 'Today\'s screen; the name comes from the answer before. The store pick already passes the good-friction test: the list is grouped in this order.',
    data: 'Name, stores, their order (exist). Art. 6(1)(b).',
    event: '<code>household_created {default_stores, store_count}</code> (exists).',
  },
  starter: {
    title: 'New: what do you need right now?',
    why: 'Ends the empty first list and pays off the step before: each tap lands sorted in the live list (labor illusion, IKEA effect). Real items through the normal add, so the classifier runs (Q-O2). The invite that follows can say how many items are waiting.',
    data: 'The items themselves (list content, Art. 6(1)(b)). Never sent to PostHog.',
    event: '<code>item_added {source: starter}</code> (new source value), count in <code>onboarding_completed {starter_count}</code>.',
  },
  invite: {
    title: 'Invite with something to share',
    why: 'Same step and share sheet as today (N-18: the user shares the link, Hummlist never emails). Title and copy follow the answer; the card shows what the invitee will see. Skipping is fine: the checklist and the invite-partner hint offer it again.',
    data: 'Invite code (exists).',
    event: '<code>invite_sent {channel, context: onboarding}</code> (exists).',
  },
  list: {
    title: 'First steps on the list',
    why: 'Takes the gesture card\'s slot (one card at a time) and folds its sentence into „Einmal einkaufen“. Three items, the first already done (endowed progress). Tap rows to tick them; the card leaves when all are done or on ✕. Solo gets the voice item, a club the AI assistant item.',
    data: 'Checklist state on the device only (§ 25 (2) no. 2 TDDDG).',
    event: '<code>onboarding_completed</code>, <code>checklist_step_done {step}</code>, <code>checklist_dismissed {open_steps}</code>.',
  },
};

const HINTS = [
  {
    id: 'edit-long-press', surface: 'card', icon: 'edit',
    de: ['Artikel bearbeiten', 'Halte einen Artikel gedrückt, ohne ihn zu ziehen, und ändere Menge, Marke, Laden und mehr.'],
    en: ['Edit an item', 'Press and hold an item without dragging it to change its quantity, brand, store and more.'],
    trigger: '5 items on the list, never long-pressed.', retired: 'The first long-press.', where: 'Card at the top of the list', platforms: 'All',
  },
  {
    id: 'quick-add-amounts', surface: 'card', icon: 'numbered',
    de: ['Menge gleich mittippen', 'Schreib „2 Gurken“ oder „Milch 2 l“, und Hummlist erkennt die Menge.'],
    en: ['Type the amount too', 'Write “2 cucumbers” or “milk 2 l” and Hummlist picks up the amount.'],
    trigger: '5 typed adds without an amount.', retired: 'An add with an amount.', where: 'Card at the top of the list', platforms: 'All',
  },
  {
    id: 'dictation', surface: 'above', icon: 'mic', ring: 'mic',
    de: ['Sag einfach, was fehlt', 'Tipp aufs Mikrofon und sprich: „Milch, zwei Gurken und Klopapier“.'],
    en: ['Just say it', 'Tap the mic and say: “milk, two cucumbers and toilet paper”.'],
    trigger: '10 typed adds, mic never used.', retired: 'The mic used once.', where: 'Bubble above the add field, pointing at the mic', platforms: 'iOS, Android',
  },
  {
    id: 'siri', surface: 'card', icon: 'voice',
    de: ['Mit Siri hinzufügen', 'Sag „Etwas auf Hummlist setzen“, wenn die Hände voll sind.'],
    en: ['Add with Siri', 'Say “Add to Hummlist” when your hands are full.'],
    trigger: '3 active days, no Siri add yet.', retired: 'The first Siri add.', where: 'Card at the top of the list', platforms: 'iOS (17+), once the native Siri hold ends',
  },
  {
    id: 'store-order', surface: 'below', icon: 'swap', ring: 'edit',
    de: ['Sortiert wie dein Laden', 'Unter Anpassen ziehst du die Abteilungen in die Reihenfolge deines Wegs durch den Laden.'],
    en: ['Sorted like your store', 'Under Edit, drag the sections into the order you walk through the store.'],
    trigger: 'First finished shop in a household with a store.', retired: 'A category reorder.', where: 'Bubble under „Anpassen“, outside the hex', platforms: 'All',
  },
  {
    id: 'add-store', surface: 'below', icon: 'store', ring: 'edit',
    de: ['Noch ein Laden?', 'Unter Anpassen legst du Läden an. Die Liste zeigt dann, was wohin gehört.'],
    en: ['Another store?', 'Add stores under Edit. The list then shows what goes where.'],
    trigger: '3 active days, household has no store.', retired: 'A store added.', where: 'Bubble under „Anpassen“, outside the hex', platforms: 'All',
  },
  {
    id: 'invite-partner', surface: 'card', icon: 'personAdd', action: 'invite',
    de: ['Zu zweit einkaufen', 'Wer mit dir einkauft, sieht deine Liste sofort und kann selbst etwas draufsetzen.'],
    en: ['Shop together', 'Whoever shops with you sees your list right away and can add to it.'],
    trigger: '1 member, 3 items, 1 day after creation.', retired: 'A member joins.', where: 'Card with the invite button (invite moment 3, job 169)', platforms: 'All',
  },
  {
    id: 'second-household', surface: 'card', icon: 'homeAdd',
    de: ['Noch eine Liste?', 'Für den Verein oder die WG: Unter Mehr legst du einen zweiten Haushalt an.'],
    en: ['Another list?', 'For your club or flat: add a second household under More.'],
    trigger: '14 active days.', retired: 'A second household exists.', where: 'Card at the top of the list', platforms: 'All, ships with job 169',
  },
  {
    id: 'ai-assistant', surface: 'card', icon: 'bot', action: 'open',
    de: ['Liste per KI-Assistent', 'Verbinde deinen KI-Assistenten unter Mehr → Zugänge. Er setzt dann Dinge auf eure Liste.'],
    en: ['Your list from an AI assistant', 'Connect your AI assistant under More → Access. It then puts things on your list.'],
    trigger: 'Household kind club, or 7 active days on web or desktop.', retired: 'An assistant connected.', where: 'Card at the top of the list', platforms: 'Web, macOS, Windows, Linux',
  },
  {
    id: 'home-widget', surface: 'card', icon: 'widgets',
    de: ['Liste auf dem Home-Bildschirm', 'Halte den Home-Bildschirm gedrückt und füge das Hummlist-Widget hinzu.'],
    en: ['List on your home screen', 'Press and hold the home screen and add the Hummlist widget.'],
    trigger: '5 active days.', retired: 'A widget placed.', where: 'Card at the top of the list', platforms: 'iOS, Android',
  },
];

const HINT_RULES = [
  'One hint on screen; the checklist and the gesture card share the slot.',
  'At most one new hint per session and per 24 h; none in the first 10 s, in onboarding, or over a sheet, dialog or keyboard.',
  'Shown only after its trigger; never for a feature already used.',
  '✕ means never again; 3 showings without a tap retire it; 3 ✕ in a row pause all hints for 14 days.',
  'Title plus two short sentences, one action, the real icon; no premium upsell.',
  'Every hint readable again under More → Tips. State stays on the device; hint events only after the analytics yes.',
];

const state = {
  lang: 'de', theme: 'light', motion: 'full', size: 'fit',
  step: 'login', kind: null, stores: [], starter: [], invited: false, joined: false,
  ticked: new Set(), voiced: false, ai: false, cardGone: false,
  hint: 'edit-long-press', hidden: new Set(),
};

const t = () => T[state.lang];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;
const chrome = '<div class="status"><span>9:41</span><span class="status__icons"><i class="sig"></i><i class="wifi"></i><i class="bat"></i></span></div><div class="dynisland"></div><div class="home"></div>';
const kindKey = () => state.kind ?? 'none';
const solo = () => state.kind === 'solo';
const staple = (id) => STAPLES.find((s) => s[0] === id);
const name = (s) => (state.lang === 'de' ? s[2] : s[3]);
const catName = (c) => (state.lang === 'de' ? c[1] : c[2]);
const visibleSteps = () => STEPS.filter((s) => !(s.id === 'invite' && solo()));

function rowsByCategory(ids, cls, fresh) {
  return CATS.map((c) => {
    const inCat = ids.filter((id) => staple(id)[4] === c[0]);
    if (!inCat.length) return '';
    return `<div class="section">${esc(catName(c))}</div>` + inCat.map((id) => {
      const s = staple(id);
      const gone = state.step === 'list' && state.ticked.has(id);
      if (gone) return '';
      return `<button type="button" class="row ${cls} ${id === fresh ? 'row--new' : ''}" data-act="tick" data-id="${id}"><span class="row__emoji" aria-hidden="true">${s[1]}</span><span class="row__name">${esc(name(s))}</span></button>`;
    }).join('');
  }).join('');
}

function dots(active) {
  const flow = ['kind', 'create', 'starter', 'invite'].filter((id) => !(id === 'invite' && solo()));
  return `<div class="dots" aria-hidden="true">${flow.map((id) => `<i class="${id === active ? 'on' : ''}"></i>`).join('')}</div>`;
}

const SCREENS = {
  login: () => `<div class="scr login">
      <img class="login__icon" src="/favicon.svg" alt="">
      <h3 class="login__name">Hummlist</h3>
      <p class="login__value">${t().value}</p>
      <button type="button" class="prov" data-act="go" data-to="consent"><b>G</b>${esc(t().google)}</button>
      <button type="button" class="prov prov--dark" data-act="go" data-to="consent">${esc(t().apple)}</button>
      <button type="button" class="btn hx" data-act="go" data-to="consent">${esc(t().email)}</button>
      <div class="login__legal">${esc(t().legal)}</div>
    </div>`,
  consent: () => `<div class="scr">
      <div class="appbar"><span></span><span>${esc(t().usage)}</span>${icon('logout')}</div>
      <h3 class="consent__q">${esc(t().consentQ)}</h3>
      <p class="consent__body">${esc(t().consentBody)}</p>
      <span class="consent__link">${esc(t().privacy)}</span>
      <div class="scr__grow"></div>
      <div class="scr__actions">
        <button type="button" class="btn hx" data-act="go" data-to="welcome">${esc(t().deny)}</button>
        <button type="button" class="btn hx" data-act="go" data-to="welcome">${esc(t().allow)}</button>
      </div>
    </div>`,
  welcome: () => `<div class="scr">
      <div class="welcome__brand"><img src="/favicon.svg" alt=""><span>Hummlist</span></div>
      <h3 class="scr__title">${esc(t().welcomeTitle)}</h3>
      <p class="scr__sub">${esc(t().welcomeText)}</p>
      <button type="button" class="choice sticker" data-act="go" data-to="kind">${icon('homeAdd')}<div><strong>${esc(t().createTitle)}</strong><span>${esc(t().createHint)}</span></div></button>
      <button type="button" class="choice sticker" data-act="join">${icon('group')}<div><strong>${esc(t().joinTitle)}</strong><span>${esc(t().joinHint)}</span></div></button>
    </div>`,
  kind: () => `<div class="scr">
      ${dots('kind')}
      <h3 class="scr__title">${esc(t().kindTitle)}</h3>
      <p class="scr__sub">${esc(t().kindSub)}</p>
      <div class="opts" role="radiogroup" aria-label="${esc(t().kindTitle)}">
        ${KINDS.map((k) => `<button type="button" role="radio" class="opt sticker" aria-checked="${state.kind === k}" data-act="kind" data-kind="${k}">${icon(state.kind === k ? 'checkCircle' : 'radio')}${esc(t().kinds[k])}</button>`).join('')}
      </div>
      ${state.kind ? `<p class="payoff">${esc(t().kindPayoff(t().names[state.kind]))}</p>` : ''}
      <div class="scr__grow"></div>
      <div class="scr__actions">
        <button type="button" class="btn hx" data-act="kind-skip">${esc(t().skip)}</button>
        <button type="button" class="btn btn--primary hx" data-act="go" data-to="create" ${state.kind ? '' : 'disabled'}>${esc(t().next)}</button>
      </div>
    </div>`,
  create: () => `<div class="scr">
      ${dots('create')}
      <h3 class="scr__title">${esc(t().createTitle)}</h3>
      <p class="label">${esc(t().nameLabel)}</p>
      <div class="field-hx hx">${esc(t().names[kindKey()])}</div>
      <p class="label">${esc(t().stores)}</p>
      <p class="hint">${esc(t().storesHint)}</p>
      <div class="chips">${STORES.map((s) => `<button type="button" class="chip hx" aria-pressed="${state.stores.includes(s)}" data-act="store" data-store="${esc(s)}">${state.stores.includes(s) ? icon('check') : ''}${esc(s)}</button>`).join('')}</div>
      <button type="button" class="textbtn">${icon('add', 'ic ic--s')}${esc(t().ownStore)}</button>
      <p class="hint">${esc(t().storeNote)}</p>
      <div class="scr__grow"></div>
      <div class="scr__actions">
        <button type="button" class="btn hx" data-act="stores-skip">${esc(t().skip)}</button>
        <button type="button" class="btn btn--primary hx" data-act="go" data-to="starter">${esc(t().createTitle)}</button>
      </div>
    </div>`,
  starter: (fresh) => `<div class="scr">
      ${dots('starter')}
      <h3 class="scr__title">${esc(t().starterTitle)}</h3>
      <p class="scr__sub">${esc(t().starterSub)}</p>
      <div class="chips starter__chips">${STAPLES.map((s) => `<button type="button" class="chip hx" aria-pressed="${state.starter.includes(s[0])}" data-act="staple" data-id="${s[0]}">${state.starter.includes(s[0]) ? icon('check') : icon('add')}${esc(name(s))}</button>`).join('')}</div>
      <div class="mini sticker">
        <div class="mini__head"><b>${esc(t().yourList(solo()))}</b><span>${esc(t().items(state.starter.length))}</span></div>
        ${state.starter.length ? rowsByCategory(state.starter, '', fresh) : `<p class="mini__empty">${esc(t().starterEmpty)}</p>`}
      </div>
      <div class="scr__actions">
        <button type="button" class="btn hx" data-act="starter-skip">${esc(t().skip)}</button>
        <button type="button" class="btn btn--primary hx" data-act="starter-next">${esc(t().nextWith(state.starter.length))}</button>
      </div>
    </div>`,
  invite: () => {
    const n = state.starter.length;
    const names = state.starter.slice(0, 4).map((id) => `<li>${esc(name(staple(id)))}</li>`).join('') + (n > 4 ? `<li>+${n - 4}</li>` : '');
    return `<div class="scr">
      ${dots('invite')}
      <h3 class="scr__title">${esc(t().inviteTitle[kindKey()])}</h3>
      <p class="scr__sub">${esc(t().inviteBody(state.kind, n))}</p>
      <div class="invite-card sticker">
        <p class="invite-card__name">${esc(t().names[kindKey()])}</p>
        <p class="invite-card__meta">${esc(t().waiting(n))}</p>
        ${n ? `<ul>${names}</ul>` : ''}
        ${state.invited ? `<div class="invite-code"><span>${esc(t().code)}</span><b>K7QM2XPD</b><span>${esc(t().valid)}</span></div>` : ''}
      </div>
      <ol class="how">${t().howInvite.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <div class="scr__grow"></div>
      <div class="scr__actions">
        <button type="button" class="btn hx" data-act="go" data-to="list">${esc(state.invited ? t().toList : t().later)}</button>
        <button type="button" class="btn btn--primary hx" data-act="invite">${icon('share', 'ic ic--s')}${esc(state.invited ? t().shareAgain : t().invite)}</button>
      </div>
    </div>`;
  },
  list: () => `<div class="scr listscr">
      <div class="content"><div class="page">${checklist()}${listBody()}</div></div>
      <div class="topbar hx">${esc(t().edit)}</div>
      <div class="fade"></div>
      <div class="addfield hx"><span>${esc(t().field)}</span><button type="button" class="x" data-act="mic" aria-label="Mic">${icon('mic')}</button></div>
      <div class="pill hx"><span class="tab tab--on hx">${icon('cart')}${esc(t().list)}</span><span class="tab hx">${icon('menu')}${esc(t().more)}</span></div>
    </div>`,
};

function listBody() {
  if (!state.starter.length) {
    const offer = STAPLES.slice(0, 6);
    return `<div class="empty"><div class="empty__hex hx">${icon('cart')}</div><p>${esc(t().empty)}</p>
      <div class="chips">${offer.map((s) => `<button type="button" class="chip hx" data-act="staple-list" data-id="${s[0]}">${icon('add')}${esc(name(s))}</button>`).join('')}</div></div>`;
  }
  return rowsByCategory(state.starter, '', null);
}

function checklistItems() {
  const k = state.kind;
  const items = [{ done: true, title: state.joined ? t().stepJoined : t().stepStarted }];
  if (!state.joined) {
    if (k === 'solo') items.push({ done: state.voiced, title: t().stepVoice, sub: t().stepVoiceSub });
    else items.push({ done: state.invited, title: t().stepInvite[kindKey()], sub: k === 'club' ? t().stepInviteSubClub : t().stepInviteSub, act: 'invite', label: t().invite });
  }
  if (k === 'club') {
    items.push({ done: state.ai, title: t().stepAi, sub: t().stepAiSub, act: 'ai', label: t().open });
  } else {
    const n = state.starter.length;
    const left = state.starter.filter((id) => !state.ticked.has(id)).length;
    items.push({ done: n > 0 && left === 0, title: t().stepShop, sub: n ? `${t().stepShopSub} · ${t().of(n - left, n)}` : t().stepShopSub });
  }
  return items;
}

function checklist() {
  if (state.cardGone) return '';
  const items = checklistItems();
  const done = items.filter((i) => i.done).length;
  return `<div class="card sticker" id="checklist">
    <div class="card__head">${icon('checkCircle')}<div><p class="card__title">${esc(t().first)}</p>
      <div class="progress"><i data-w="${Math.round((done / items.length) * 100)}"></i></div></div>
      <button type="button" class="x" data-act="card-x" aria-label="${esc(t().hide)}">${icon('close')}</button></div>
    <ul class="check">${items.map((i) => `<li class="${i.done ? 'done' : ''}">${icon(i.done ? 'checkCircle' : 'radio')}<div><span>${esc(i.title)}</span>${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</div>${!i.done && i.act ? `<button type="button" class="btn btn--small hx" data-act="${i.act}">${esc(i.label)}</button>` : ''}</li>`).join('')}</ul>
  </div>`;
}

function renderSteps() {
  document.getElementById('steps').innerHTML = visibleSteps().map((s, i) =>
    `<li><button type="button" data-act="go" data-to="${s.id}" ${s.id === state.step ? 'aria-current="step"' : ''}>${i + 1} ${esc(s.label)}<span class="tag">${s.badge === 'same' ? '' : s.badge}</span></button></li>`).join('');
}

function renderFlowNotes() {
  const n = NOTES[state.step];
  const step = STEPS.find((s) => s.id === state.step);
  const badge = { new: ['badge--new', 'New step'], changed: ['badge--changed', 'Changed'], same: ['badge--same', 'As today'] }[step.badge];
  document.getElementById('flow-notes').innerHTML = `<h3>${n.title}</h3><span class="badge ${badge[0]}">${badge[1]}</span>
    <dl><dt>Why</dt><dd>${n.why}</dd><dt>Data</dt><dd>${n.data}</dd><dt>PostHog</dt><dd>${n.event}</dd></dl>`;
}

function renderFlow(fresh) {
  const phone = document.getElementById('flow');
  phone.innerHTML = chrome + SCREENS[state.step](fresh);
  phone.querySelectorAll('.progress i').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  observe(phone);
  renderSteps();
  renderFlowNotes();
}

// Hints phone: the list as on main, with one hint in its place.
const DEMO = {
  de: [['dm', [['', [['🪥', 'Zahnpasta']]]]], ['Lidl', [['Kühlregal', [['🥛', '<b>2 l</b> Vollmilch'], ['🧈', 'Butter']]], ['Obst & Gemüse', [['🍌', '<b>6×</b> Bananen'], ['🍅', 'Tomaten']]]]]],
  en: [['dm', [['', [['🪥', 'Toothpaste']]]]], ['Lidl', [['Chilled', [['🥛', '<b>2 l</b> whole milk'], ['🧈', 'Butter']]], ['Fruit & veg', [['🍌', '<b>6×</b> bananas'], ['🍅', 'Tomatoes']]]]]],
};

function demoList() {
  return DEMO[state.lang].map(([store, secs]) => {
    const count = secs.reduce((a, s) => a + s[1].length, 0);
    return `<div class="store"><span class="store__badge hx">${store}</span><span class="store__line"></span><span class="store__count"><b>${count}</b> ${state.lang === 'de' ? 'Artikel' : count === 1 ? 'item' : 'items'}</span></div>` +
      secs.map(([sec, rows]) => (sec ? `<div class="section">${sec}</div>` : '') + rows.map(([e, n]) => `<div class="row"><span class="row__emoji" aria-hidden="true">${e}</span><span class="row__name">${n}</span></div>`).join('')).join('');
  }).join('');
}

function hintBox(h, cls) {
  const [title, body] = h[state.lang];
  const action = h.action === 'invite' ? t().invite : h.action === 'open' ? t().open : null;
  return `<div class="${cls} sticker" id="hint-box">
    <div class="card__head">${icon(h.icon)}<div><p class="card__title">${esc(title)}</p><p class="card__body">${esc(body)}</p></div>
    <button type="button" class="x" data-act="hint-x" aria-label="${state.lang === 'de' ? 'Tipp ausblenden' : 'Hide tip'}">${icon('close')}</button></div>
    ${action ? `<div class="card__actions"><button type="button" class="btn btn--small hx">${esc(action)}</button></div>` : ''}
  </div>`;
}

function renderHints() {
  const h = HINTS.find((x) => x.id === state.hint);
  const hidden = state.hidden.has(h.id);
  const top = h.surface === 'card' ? (hidden ? `<div class="dismissed">${esc(t().tipHidden)}</div>` : hintBox(h, 'card')) : '';
  const floating = h.surface !== 'card' && !hidden ? hintBox(h, `callout callout--${h.surface}`) + `<div class="ring ring--${h.ring}"></div>` : '';
  const floatingHidden = h.surface !== 'card' && hidden ? `<div class="callout callout--${h.surface} dismissed">${esc(t().tipHidden)}</div>` : '';
  const phone = document.getElementById('hints');
  phone.innerHTML = chrome + `<div class="scr listscr">
      <div class="content"><div class="page">${top}${demoList()}</div></div>
      <div class="topbar hx">${esc(t().edit)}</div>
      <div class="fade"></div>
      <div class="addfield hx"><span>${esc(t().field)}</span>${icon('mic')}</div>
      <div class="pill hx"><span class="tab tab--on hx">${icon('cart')}${esc(t().list)}</span><span class="tab hx">${icon('menu')}${esc(t().more)}</span></div>
      ${floating}${floatingHidden}
    </div>`;
  observe(phone);
  document.getElementById('picker').innerHTML = HINTS.map((x) => `<button type="button" data-act="hint" data-id="${x.id}" aria-pressed="${x.id === state.hint}">${x.id}</button>`).join('');
  document.getElementById('hint-notes').innerHTML = `<h3><code>${h.id}</code></h3>
    <dl><dt>Trigger</dt><dd>${h.trigger}</dd><dt>Retired by</dt><dd>${h.retired}</dd><dt>Surface</dt><dd>${h.where}</dd><dt>Platforms</dt><dd>${h.platforms}</dd><dt>PostHog</dt><dd><code>hint_shown</code>, <code>hint_dismissed</code>, <code>hint_acted</code> with <code>hint_id</code>, after the analytics yes only.</dd></dl>
    <ul class="rules">${HINT_RULES.map((r) => `<li>${r}</li>`).join('')}</ul>`;
}

function render() {
  const root = document.documentElement;
  root.lang = state.lang;
  root.dataset.theme = state.theme;
  root.dataset.motion = state.motion;
  layout();
  renderFlow(null);
  renderHints();
}

function layout() {
  const vw = document.documentElement.clientWidth;
  const vh = globalThis.innerHeight;
  const s = state.size === 'real' ? 1 : Math.max(0.5, Math.min(1, (vh - 270) / PHONE.h, (vw - 24) / PHONE.w));
  document.documentElement.style.setProperty('--s', String(s));
}

// Hex shapes: pointed ends with the token tip ratio and rounded corners, redrawn whenever a box resizes.
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
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      const k = Math.min(len, l / 2) / l;
      return [a[0] + dx * k, a[1] + dy * k];
    };
    const a = toward(p, prev, r);
    const b = toward(p, next, r);
    d += `${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return `${d}Z`;
}

// The empty-state hex stands on its point like the app's, so its path is drawn upright.
function uprightHex(w, h, inset) {
  const pts = [[w / 2, 0], [w, h / 4], [w, 3 * h / 4], [w / 2, h], [0, 3 * h / 4], [0, h / 4]]
    .map(([x, y]) => [inset + x * (w - 2 * inset) / w, inset + y * (h - 2 * inset) / h]);
  return `M${pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join('L')}Z`;
}

const hexObserver = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
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
    svg.firstChild.setAttribute('d', el.classList.contains('empty__hex') ? uprightHex(w, h, sw / 2) : hexPath(w, h, sw / 2, 8 * h / 48));
  }
});
const observe = (root) => root.querySelectorAll('.hx').forEach((el) => hexObserver.observe(el));

function go(to) {
  if (to === 'invite' && solo()) to = 'list';
  state.step = to;
  if (to === 'login') Object.assign(state, { kind: null, stores: [], starter: [], invited: false, joined: false, ticked: new Set(), voiced: false, ai: false, cardGone: false });
  renderFlow(null);
}

function leaveCard(after) {
  const card = document.getElementById('checklist');
  if (!card) return after();
  card.classList.add('card--gone');
  setTimeout(after, state.motion === 'reduced' ? 120 : 260);
}

function maybeFinish() {
  if (!state.cardGone && checklistItems().every((i) => i.done)) {
    setTimeout(() => leaveCard(() => { state.cardGone = true; renderFlow(null); }), 600);
  }
}

const ACTIONS = {
  go: (el) => go(el.dataset.to),
  join: () => {
    Object.assign(state, { joined: true, kind: 'partner', starter: ['milk', 'bread', 'bananas', 'tp'], invited: true, ticked: new Set(), cardGone: false });
    go('list');
  },
  kind: (el) => { state.kind = el.dataset.kind; renderFlow(null); },
  'kind-skip': () => { state.kind = null; go('create'); },
  store: (el) => {
    const s = el.dataset.store;
    state.stores = state.stores.includes(s) ? state.stores.filter((x) => x !== s) : [...state.stores, s];
    renderFlow(null);
  },
  'stores-skip': () => { state.stores = []; go('starter'); },
  staple: (el) => {
    const id = el.dataset.id;
    const on = state.starter.includes(id);
    state.starter = on ? state.starter.filter((x) => x !== id) : [...state.starter, id];
    renderFlow(on ? null : id);
  },
  'staple-list': (el) => { state.starter = [...state.starter, el.dataset.id]; renderFlow(null); },
  'starter-skip': () => { state.starter = []; go('invite'); },
  'starter-next': () => go('invite'),
  invite: () => { state.invited = true; renderFlow(null); if (state.step === 'list') maybeFinish(); },
  ai: () => { state.ai = true; renderFlow(null); maybeFinish(); },
  mic: () => { if (solo()) { state.voiced = true; renderFlow(null); maybeFinish(); } },
  tick: (el) => {
    if (state.step !== 'list') return;
    el.classList.add('row--gone');
    setTimeout(() => { state.ticked.add(el.dataset.id); renderFlow(null); maybeFinish(); }, state.motion === 'reduced' ? 120 : 260);
  },
  'card-x': () => leaveCard(() => { state.cardGone = true; renderFlow(null); }),
  hint: (el) => { state.hint = el.dataset.id; renderHints(); },
  'hint-x': () => {
    const box = document.getElementById('hint-box');
    box.classList.add('card--gone');
    setTimeout(() => { state.hidden.add(state.hint); renderHints(); }, state.motion === 'reduced' ? 120 : 260);
  },
};

document.addEventListener('click', (ev) => {
  const seg = ev.target.closest('.seg button');
  if (seg) {
    state[seg.parentElement.dataset.control] = seg.dataset.value;
    seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
    render();
    return;
  }
  const el = ev.target.closest('[data-act]');
  if (el && !el.disabled && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
});

if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  state.motion = 'reduced';
  document.querySelectorAll('[data-control=motion] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === 'reduced')));
}
globalThis.addEventListener('resize', layout);
render();
