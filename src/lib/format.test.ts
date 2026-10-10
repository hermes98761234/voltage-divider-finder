import { describe, expect, it } from 'vitest'
import { formatPct, formatR, formatV, parseR } from './format'

describe('formatR', () => {
  it('uses SI suffixes', () => {
    expect(formatR(4700)).toBe('4.7k')
    expect(formatR(10000)).toBe('10k')
    expect(formatR(1e6)).toBe('1M')
    expect(formatR(47)).toBe('47')
    expect(formatR(0.47)).toBe('470m')
    expect(formatR(100)).toBe('100')
    expect(formatR(33200)).toBe('33.2k')
  })
})

describe('parseR', () => {
  it('parses suffixes and the 4k7 notation', () => {
    expect(parseR('4.7k')).toBe(4700)
    expect(parseR('10K')).toBe(10000)
    expect(parseR('4k7')).toBe(4700)
    expect(parseR('2M2')).toBe(2.2e6)
    expect(parseR('1e3')).toBe(1000)
    expect(parseR('470')).toBe(470)
    expect(parseR('1,5k')).toBe(1500)
    expect(parseR('100 Ω')).toBe(100)
    expect(parseR('0R5')).toBe(0.5)
  })
  it('rejects junk', () => {
    expect(parseR('')).toBeNaN()
    expect(parseR('abc')).toBeNaN()
    expect(parseR('1k2k')).toBeNaN()
  })
})

describe('other formatters', () => {
  it('formats volts and percent', () => {
    expect(formatV(3.3)).toBe('3.3 V')
    expect(formatV(0.0123)).toBe('12.3 mV')
    expect(formatPct(0.12345)).toBe('+0.123%')
    expect(formatPct(-1.5)).toBe('-1.5%')
  })
})
