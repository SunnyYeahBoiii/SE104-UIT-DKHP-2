import { describe, expect, it } from 'bun:test'

import {
  DAY_LABELS,
  formatCountdown,
  isPracticeGroup,
  retakeSplitHint,
  sectionDays,
  type Section,
} from '../src/lib/registration'

describe('registration view helpers', () => {
  it('renders a countdown with days only when needed', () => {
    expect(formatCountdown(-5)).toBe('00:00:00')
    expect(formatCountdown(65_000)).toBe('00:01:05')
    expect(formatCountdown(2 * 86400_000 + 4 * 3600_000 + 12 * 60_000 + 9000)).toBe(
      '2 ngày 04:12:09',
    )
  })

  it('labels meeting days and the no-schedule case', () => {
    expect(DAY_LABELS[2]).toBe('T2')
    expect(DAY_LABELS[8]).toBe('CN')
    const section = { days: [2, 6] } as unknown as Section
    expect(sectionDays(section)).toBe('T2 · T6')
    expect(sectionDays({ days: [] } as unknown as Section)).toBe('Không có lịch cố định')
  })

  it('marks practice groups and hints at each retake-split case', () => {
    const group = { parentSectionId: 7, attemptType: 'FIRST' } as unknown as Section
    const theory = {
      parentSectionId: null,
      practiceMode: 'SCHEDULED',
      attemptType: 'IMPROVEMENT',
    } as unknown as Section
    expect(isPracticeGroup(group)).toBe(true)
    expect(isPracticeGroup(theory)).toBe(false)
    expect(retakeSplitHint([theory, group])).toContain('Đạt phần lý thuyết')
    expect(retakeSplitHint([{ ...group, attemptType: 'IMPROVEMENT' }])).toContain(
      'Đạt phần thực hành',
    )
    expect(retakeSplitHint([group])).toBeNull()
  })
})
