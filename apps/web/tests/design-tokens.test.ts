import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'bun:test'

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`missing CSS custom property --color-${name}`)
  return match[1]!
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  return channels
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0)
}

function contrast(foreground: string, background: string): number {
  const sorted = [luminance(foreground), luminance(background)].sort((x, y) => y - x)
  return (sorted[0]! + 0.05) / (sorted[1]! + 0.05)
}

describe('A.3 design tokens', () => {
  it('exports the brand, neutral and semantic colours as CSS custom properties', () => {
    expect(token('brand-500').toLowerCase()).toBe('#2c68fc')
    expect(token('neutral-0').toLowerCase()).toBe('#ffffff')
    for (const name of ['success-600', 'warning-600', 'danger-600', 'dark-card'])
      expect(token(name))
    for (const name of ['font-sans', 'font-mono', 'radius-md', 'shadow-md'])
      expect(css).toContain(`--${name}:`)
  })

  it('keeps every A.3.1 text/background pair at WCAG AA or better', () => {
    const pairs: [string, string, number][] = [
      ['brand-500', 'neutral-0', 4.67],
      ['brand-600', 'neutral-0', 5.93],
      ['brand-700', 'brand-50', 7.15],
      ['neutral-500', 'neutral-0', 5.74],
      ['neutral-900', 'neutral-0', 16.8],
      ['success-700', 'success-50', 4.5],
      ['warning-700', 'warning-50', 4.5],
      ['danger-700', 'danger-50', 4.5],
    ]
    for (const [foreground, background, expected] of pairs) {
      const ratio = contrast(token(foreground), token(background))
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(ratio + 0.15).toBeGreaterThanOrEqual(expected)
    }
  })
})
