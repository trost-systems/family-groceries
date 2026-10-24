import { describe, expect, it } from 'vitest'
import { canonicalProps, localizeProps, memoryFromItems, parse, suggest } from './parser'
import { initialState } from './mockData'

describe('parse', () => {
  it('splits the brief example into fields', () => {
    expect(parse('Windeln Pampers Größe 3')).toEqual({
      name: 'Windeln',
      brand: 'Pampers',
      props: ['Größe 3', 'Standard Pack'],
      qty: '1',
      emoji: '👶',
      storeId: 'dm',
      categoryId: 'drogerie',
    })
  })

  it('is stable on every prefix while typing', () => {
    const text = 'Windeln Pampers Größe 3'
    for (let i = 1; i <= text.length; i++) expect(() => parse(text.slice(0, i))).not.toThrow()
    expect(parse('Windeln Pampers Größe').props).toEqual(['Standard Pack'])
    expect(parse('Windeln Pam').name).toBe('Windeln Pam')
  })

  it.each([
    ['2x Milch', { name: 'Milch', qty: '2' }],
    ['Milch x2', { name: 'Milch', qty: '2' }],
    ['3 Stück Gurken', { name: 'Gurken', qty: '3' }],
    ['Gurken 3 Stück', { name: 'Gurken', qty: '3' }],
    ['zwei Gurken', { name: 'Gurken', qty: '2' }],
    ['5 Bananen', { name: 'Bananen', qty: '5' }],
  ])('quantity: %s', (input, expected) => {
    expect(parse(input)).toMatchObject(expected)
  })

  it.each([
    ['Feuchttücher Babylove 4er Pack', ['4er Pack']],
    ['Cola Zero 0,5l', ['0,5 l']],
    ['Klopapier 3-lagig 16 Rollen', ['3-lagig', '16 Rollen']],
    ['milk 2%', ['2 %']],
    ['Hackfleisch 500g', ['500 g']],
    ['Milch 1,5% 1 l', ['1,5 %', '1 l']],
    ['Windeln Gr. 4 Big Pack', ['Größe 4', 'Big Pack']],
    ['Eier 10er', ['10er Pack']],
  ])('properties: %s', (input, props) => {
    expect(parse(input).props).toEqual(props)
  })

  it('keeps product lines in the name and reads container counts as quantity', () => {
    expect(parse('Cola Zero 0,5l')).toMatchObject({ name: 'Cola Zero', categoryId: 'getraenke' })
    expect(parse('3 packs of pasta')).toMatchObject({ name: 'Pasta', qty: '3', categoryId: 'vorrat' })
    expect(parse('2 Dosen Tomaten')).toMatchObject({ name: 'Tomaten', qty: '2' })
    expect(parse('Klopapier 3-lagig 16 Rollen')).toMatchObject({ name: 'Klopapier', categoryId: 'haushalt' })
  })

  it('classifies German compounds by their head noun', () => {
    expect(parse('Vollkornbrot')).toMatchObject({ name: 'Vollkornbrot', categoryId: 'brot' })
    expect(parse('Hafermilch')).toMatchObject({ name: 'Hafermilch', categoryId: 'kuehl' })
  })

  it('understands English', () => {
    expect(parse('2 bananas')).toMatchObject({ name: 'Bananas', qty: '2', categoryId: 'obst' })
    expect(parse('diapers Pampers size 4')).toMatchObject({ name: 'Diapers', brand: 'Pampers', storeId: 'dm' })
    expect(parse('diapers size 4').props).toContain('Größe 4')
  })

  it('normalizes inflections but keeps synonyms as typed', () => {
    expect(parse('windel').name).toBe('Windeln')
    expect(parse('Semmeln')).toMatchObject({ name: 'Semmeln', categoryId: 'brot' })
  })

  it('infers the product from a brand alone', () => {
    expect(parse('Pampers')).toMatchObject({ name: 'Windeln', brand: 'Pampers', storeId: 'dm' })
  })

  it('falls back to Sonstiges for unknown items', () => {
    expect(parse('Geschenkpapier')).toMatchObject({ name: 'Geschenkpapier', categoryId: 'sonst', storeId: 'edeka' })
  })

  it('prefers household memory for store and category', () => {
    const memory = memoryFromItems(initialState().items)
    expect(parse('Cola', memory).storeId).toBe('dm')
    expect(parse('Pizza', memory).storeId).toBe('lidl')
  })
})

describe('suggest', () => {
  it('offers the parse first, then one-tap variants', () => {
    const s = suggest('Windeln Pampers Größe 3')
    expect(s[0].props).toEqual(['Größe 3', 'Standard Pack'])
    expect(s.map((d) => `${d.brand} ${d.props.join(' ')}`)).toEqual([
      'Pampers Größe 3 Standard Pack',
      'Pampers Größe 3 Big Pack',
      'Pampers Größe 3 Maxi Pack',
      'Babylove Größe 3 Standard Pack',
    ])
  })

  it('is empty for empty input', () => {
    expect(suggest('  ')).toEqual([])
  })
})

describe('localizeProps', () => {
  it('shows canonical German props in English', () => {
    expect(localizeProps(['Größe 3', 'Standard Pack', '4er Pack', '1,5 %', 'Bio', '16 Rollen', '3-lagig', 'Skyr Style'], 'en')).toEqual([
      'Size 3', 'Standard pack', '4-pack', '1.5 %', 'Organic', '16 rolls', '3-ply', 'Skyr Style',
    ])
  })

  it('round-trips English input back to canonical German', () => {
    const de = ['Größe 3', 'Big Pack', '6er Pack', '0,5 l', 'Kinder']
    expect(canonicalProps(localizeProps(de, 'en'))).toEqual(de)
    expect(localizeProps(localizeProps(de, 'en'), 'de')).toEqual(de)
  })
})
