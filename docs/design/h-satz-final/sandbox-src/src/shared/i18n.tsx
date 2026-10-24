import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Lang, Localized } from './types'

const STRINGS = {
  appName: { de: 'Familieneinkauf', en: 'Family Groceries' },
  tabList: { de: 'Liste', en: 'List' },
  tabMore: { de: 'Mehr', en: 'More' },
  addPlaceholder: { de: 'Was brauchst du?', en: 'What do you need?' },
  addHint: { de: 'z. B. „2x Milch 1,5 %“ oder „Windeln Pampers Größe 3“', en: 'e.g. “2x milk” or “Windeln Pampers Größe 3”' },
  suggestions: { de: 'Antippen zum Hinzufügen', en: 'Tap to add' },
  added: { de: 'Hinzugefügt', en: 'Added' },
  checkedOff: { de: 'abgehakt', en: 'checked off' },
  deleted: { de: 'gelöscht', en: 'deleted' },
  gestureHint: { de: 'Tippen hakt ab · Halten bearbeitet · Halten und ziehen verschiebt', en: 'Tap to check off · Hold to edit · Hold and drag to move' },
  gotIt: { de: 'Verstanden', en: 'Got it' },
  undo: { de: 'Rückgängig', en: 'Undo' },
  close: { de: 'Schließen', en: 'Close' },
  name: { de: 'Bezeichnung', en: 'Name' },
  brand: { de: 'Marke', en: 'Brand' },
  props: { de: 'Eigenschaften', en: 'Details' },
  qty: { de: 'Menge', en: 'Qty' },
  store: { de: 'Laden', en: 'Store' },
  category: { de: 'Kategorie', en: 'Category' },
  done: { de: 'Fertig', en: 'Done' },
  delete: { de: 'Löschen', en: 'Delete' },
  addedBy: { de: 'von', en: 'by' },
  items: { de: 'Artikel', en: 'items' },
  emptyList: { de: 'Alles erledigt. Leere Liste.', en: 'All done. Nothing left.' },
  dragHint: { de: 'Gedrückt halten zum Verschieben', en: 'Press and hold to move' },
  editHint: { de: 'Halten und loslassen zum Bearbeiten', en: 'Hold and release to edit' },
  recentlyBought: { de: 'Zuletzt gekauft', en: 'Recently bought' },
  settings: { de: 'Einstellungen', en: 'Settings' },
  household: { de: 'Haushalt', en: 'Household' },
  members: { de: 'Mitglieder', en: 'Members' },
  storesAndCategories: { de: 'Läden & Kategorien', en: 'Stores & categories' },
  language: { de: 'Sprache', en: 'Language' },
  notifications: { de: 'Benachrichtigungen', en: 'Notifications' },
  integrations: { de: 'Siri & MCP', en: 'Siri & MCP' },
  account: { de: 'Konto', en: 'Account' },
  logout: { de: 'Abmelden', en: 'Log out' },
  loggedOut: { de: 'Abgemeldet (Mock)', en: 'Logged out (mock)' },
  legal: { de: 'Rechtliches', en: 'Legal' },
  imprint: { de: 'Impressum', en: 'Imprint' },
  privacy: { de: 'Datenschutz', en: 'Privacy policy' },
  licenses: { de: 'Open-Source-Lizenzen', en: 'Open source licenses' },
  back: { de: 'Zurück', en: 'Back' },
  version: { de: 'Version', en: 'Version' },
  on: { de: 'An', en: 'On' },
  allDirections: { de: 'Alle Entwürfe', en: 'All directions' },
  srcCurrent: { de: 'Unverändert', en: 'Unchanged' },
  srcTyped: { de: 'Wie getippt', en: 'As typed' },
  srcHistory: { de: 'Schon mal gekauft', en: 'Bought before' },
  srcPack: { de: 'Andere Packung', en: 'Other pack' },
  srcVariant: { de: 'Andere Sorte', en: 'Other kind' },
  srcSize: { de: 'Andere Größe', en: 'Other size' },
  srcBrand: { de: 'Andere Marke', en: 'Other brand' },
  srcCatalog: { de: 'Aus dem Katalog', en: 'From the catalogue' },
  storeAuto: { de: 'Laden: automatisch', en: 'Store: automatic' },
  categoryAuto: { de: 'Kategorie: automatisch', en: 'Category: automatic' },
  addTitle: { de: 'Hinzufügen', en: 'Add' },
  editTitle: { de: 'Bearbeiten', en: 'Edit' },
  enterHint: { de: 'Antippen fügt hinzu · ↵ nimmt den ersten Vorschlag', en: 'Tap to add · ↵ takes the first suggestion' },
  enterHintEdit: { de: 'Antippen übernimmt · ↵ nimmt den ersten Vorschlag', en: 'Tap to apply · ↵ takes the first suggestion' },
  typeToSuggest: { de: 'Tippe los, zum Beispiel „Windeln Pampers Größe 3“. Jeder Vorschlag ist antippbar.', en: 'Start typing, e.g. “Windeln Pampers Größe 3”. Every suggestion is tappable.' },
  collapsedCount: { de: 'zugeklappt', en: 'collapsed' },
  expand: { de: 'Aufklappen', en: 'Expand' },
  collapse: { de: 'Zuklappen', en: 'Collapse' },
  clear: { de: 'Leeren', en: 'Clear' },
  round1: { de: 'Runde 1', en: 'Round 1' },
  round2: { de: 'Runde 2', en: 'Round 2' },
  round3: { de: 'Runde 3', en: 'Round 3' },
  cancel: { de: 'Abbrechen', en: 'Cancel' },
  editHintFields: { de: 'Gespeichert wird nur, was du änderst', en: 'Only what you change is saved' },
  brandNone: { de: 'ohne Marke', en: 'no brand' },
  propsExample: { de: 'z. B. Bio, 1 l', en: 'e.g. organic, 1 l' },
  qtyMinus: { de: 'Eins weniger', en: 'One less' },
  qtyPlus: { de: 'Eins mehr', en: 'One more' },
} satisfies Record<string, Localized>

export type StringKey = keyof typeof STRINGS

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: StringKey) => string
  /** pick from a Localized record, e.g. category names */
  l: (value: Localized) => string
}

const Ctx = createContext<I18n | null>(null)

const STORAGE_KEY = 'fg-lang'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'de'))
  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l)
    document.documentElement.lang = l
    setLangState(l)
  }
  const value: I18n = { lang, setLang, t: (key) => STRINGS[key][lang], l: (v) => v[lang] }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside LangProvider')
  return v
}
