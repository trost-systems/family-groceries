import { describe, expect, it } from 'vitest'
import { cents, euro, lineTotal, parsePrice, parseWeight, perPiece, tripTotal, unitPrice } from './pricing'
import { scenario } from './trip'

describe('parsePrice', () => {
  it.each([
    ['1,19', 119], ['1.19', 119], ['1,9', 190], ['3', 300], [' 2,29 € ', 229], ['999,99', 99999],
  ])('%s is %i cents', (input, value) => expect(parsePrice(input)).toEqual({ ok: true, value }))
  it.each([
    ['', 'empty'], ['  ', 'empty'], ['abc', 'invalid'], ['1,199', 'invalid'], ['-1', 'invalid'], ['1,2,3', 'invalid'],
    ['0', 'zero'], ['0,00', 'zero'], ['1000', 'tooLarge'], ['12345', 'tooLarge'],
  ])('%s fails with %s', (input, error) => expect(parsePrice(input)).toEqual({ ok: false, error }))
})

describe('parseWeight', () => {
  it.each([['0,846', 846], ['1,24 kg', 1240], ['846 g', 846], ['2', 2000]])('%s is %i g', (input, value) =>
    expect(parseWeight(input)).toEqual({ ok: true, value }))
  it.each([['', 'empty'], ['viel', 'invalid'], ['0', 'zero'], ['25', 'tooLarge']])('%s fails with %s', (input, error) =>
    expect(parseWeight(input)).toEqual({ ok: false, error }))
})

describe('line and unit', () => {
  const bananen = { sold: { kind: 'weight' } as const, qty: 846 }
  it('weight: 0,846 kg at 1,99 €/kg is 1,68 €', () =>
    expect(lineTotal({ ...bananen, price: { basis: 'unit', amount: cents(199) } })).toBe(168))
  it('weight: a 1,68 € scale sticker is 1,99 €/kg', () =>
    expect(unitPrice({ ...bananen, price: { basis: 'line', amount: cents(168) } })).toBe(199))
  const wasser = { sold: { kind: 'pack', perPack: 6, packUnit: 'Flaschen' } as const, qty: 2 }
  it('pack: two six-packs at 2,94 € are 5,88 €, 0,49 € a bottle', () => {
    const item = { ...wasser, price: { basis: 'unit' as const, amount: cents(294) } }
    expect(lineTotal(item)).toBe(588)
    expect(perPiece(item)).toBe(49)
  })
  it('a line price keeps its total when the quantity changes', () =>
    expect(lineTotal({ ...wasser, qty: 3, price: { basis: 'line', amount: cents(588) } })).toBe(588))
})

describe('tripTotal', () => {
  it('starts with only the butter priced', () => expect(tripTotal(scenario)).toEqual({ total: 229, priced: 1, open: 6 }))
  it('formats German euros', () => expect(euro(123456)).toBe('1.234,56 €'))
})
