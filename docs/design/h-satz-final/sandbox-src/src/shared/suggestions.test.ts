import { describe, expect, it } from 'vitest'
import { HISTORY } from './mockData'
import { suggestionsFor } from './suggestions'

const brief = 'Windeln Pampers Größe 3'

describe('suggestionsFor', () => {
  it('puts the literal parse first, then at least three alternatives', () => {
    const list = suggestionsFor(brief, { history: HISTORY })
    expect(list[0].source).toBe('typed')
    expect(list[0].draft).toMatchObject({ name: 'Windeln', brand: 'Pampers', storeId: 'dm', categoryId: 'drogerie' })
    expect(list[0].draft.props).toContain('Größe 3')
    expect(list.length).toBeGreaterThanOrEqual(4)
    expect(new Set(list.map((s) => s.key)).size).toBe(list.length)
  })

  it('offers history, other packs, the neighbouring sizes and other brands for the brief example', () => {
    const list = suggestionsFor(brief, { history: HISTORY })
    const sources = list.map((s) => s.source)
    expect(sources).toEqual(expect.arrayContaining(['history', 'pack', 'size', 'brand']))
    expect(list.find((s) => s.source === 'history')!.draft.props).toEqual(['Größe 4', 'Big Pack'])
    expect(list.filter((s) => s.source === 'size').map((s) => s.draft.props)).toEqual([
      ['Größe 4', 'Standard Pack'],
      ['Größe 2', 'Standard Pack'],
    ])
    expect(list.filter((s) => s.source === 'brand').map((s) => s.draft.brand)).toEqual(['Babylove', 'Huggies'])
  })

  it('history that matches the parse exactly is not offered twice', () => {
    const list = suggestionsFor('Windeln Pampers Größe 4 Big Pack', { history: HISTORY })
    expect(list.filter((s) => s.draft.props.includes('Größe 4') && s.draft.props.includes('Big Pack') && s.draft.brand === 'Pampers')).toHaveLength(1)
    expect(list[0].source).toBe('typed')
  })

  it('completes a prefix from the catalogue and keeps the typed quantity', () => {
    const list = suggestionsFor('2 Mi')
    expect(list[0]).toMatchObject({ source: 'typed', draft: { name: 'Mi' } })
    const milk = list.find((s) => s.source === 'catalog' && s.draft.name === 'Milch')
    expect(milk?.draft).toMatchObject({ qty: '2', categoryId: 'kuehl' })
  })

  it('finds compound history items through the product, e.g. Wasser -> Mineralwasser', () => {
    const list = suggestionsFor('Wasser', { history: HISTORY })
    expect(list.some((s) => s.source === 'history' && s.draft.name === 'Mineralwasser')).toBe(true)
    expect(list.filter((s) => s.source === 'brand').map((s) => s.draft.brand)).toEqual(['Gerolsteiner', 'Volvic'])
  })

  it('a typed quantity carries over to a history suggestion', () => {
    const h = suggestionsFor('3x Windeln', { history: HISTORY }).find((s) => s.source === 'history')
    expect(h?.draft.qty).toBe('3')
  })

  it('caps the list and returns nothing for blank input', () => {
    expect(suggestionsFor('Windeln', { history: HISTORY, limit: 3 })).toHaveLength(3)
    expect(suggestionsFor('   ')).toEqual([])
  })

  it('an unknown word still yields exactly one selectable suggestion', () => {
    const list = suggestionsFor('Quittengelee')
    expect(list).toHaveLength(1)
    expect(list[0].draft).toMatchObject({ name: 'Quittengelee', categoryId: 'sonst' })
  })
})
