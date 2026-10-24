import { describe, expect, it } from 'vitest'
import { round2State } from './mockData'
import { reducer, sectionsOf } from './store'
import type { ListState } from './types'

const idOf = (s: ListState, name: string) => s.items.find((i) => i.name === name)!.id
const namesIn = (s: ListState, storeId: string, categoryId: string) =>
  sectionsOf(s)
    .find((x) => x.store.id === storeId)!
    .categories.find((c) => c.category.id === categoryId)!
    .items.map((i) => i.name)
const place = (s: ListState, name: string, anchor: string, edge: 'before' | 'after') =>
  reducer(s, { type: 'place', id: idOf(s, name), anchorId: idOf(s, anchor), edge })

describe('place', () => {
  it('puts an item right before its anchor', () => {
    const s = round2State()
    expect(namesIn(s, 'edeka', 'kuehl')).toEqual(['Milch', 'Joghurt'])
    expect(namesIn(place(s, 'Joghurt', 'Milch', 'before'), 'edeka', 'kuehl')).toEqual(['Joghurt', 'Milch'])
  })

  it('puts an item right after its anchor', () => {
    const s = round2State()
    expect(namesIn(place(s, 'Bananen', 'Gurken', 'after'), 'edeka', 'obst')).toEqual(['Gurken', 'Bananen'])
  })

  it('adopts the anchor category within a store', () => {
    const next = place(round2State(), 'Gurken', 'Milch', 'after')
    expect(namesIn(next, 'edeka', 'kuehl')).toEqual(['Milch', 'Gurken', 'Joghurt'])
    expect(namesIn(next, 'edeka', 'obst')).toEqual(['Bananen'])
  })

  it('adopts the anchor store and category across stores', () => {
    const next = place(round2State(), 'Zahnpasta', 'Pizza', 'before')
    expect(namesIn(next, 'lidl', 'tk')).toEqual(['Zahnpasta', 'Pizza'])
    expect(namesIn(next, 'dm', 'drogerie')).toEqual(['Feuchttücher'])
    expect(sectionsOf(next).find((x) => x.store.id === 'lidl')!.count).toBe(4)
  })

  it('is a no-op on itself or an unknown id', () => {
    const s = round2State()
    const milch = idOf(s, 'Milch')
    expect(reducer(s, { type: 'place', id: milch, anchorId: milch, edge: 'before' })).toBe(s)
    expect(reducer(s, { type: 'place', id: 'nope', anchorId: milch, edge: 'after' })).toBe(s)
    expect(reducer(s, { type: 'place', id: milch, anchorId: 'nope', edge: 'after' })).toBe(s)
  })

  it('keeps the new order across a check and an undo', () => {
    let s = place(round2State(), 'Joghurt', 'Milch', 'before')
    const id = idOf(s, 'Joghurt')
    s = reducer(s, { type: 'setChecked', id, checked: true })
    s = reducer(s, { type: 'setChecked', id, checked: false })
    expect(namesIn(s, 'edeka', 'kuehl')).toEqual(['Joghurt', 'Milch'])
  })
})
