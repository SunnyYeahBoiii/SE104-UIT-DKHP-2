import { describe, expect, it } from 'bun:test'

import { buildTodos, fillPercent } from './monitoring.policy'

describe('staff monitoring policy', () => {
  it('clamps the fill bar for empty and over-full sections', () => {
    expect(fillPercent(0, 0)).toBe(0)
    expect(fillPercent(3, 4)).toBe(75)
    expect(fillPercent(120, 80)).toBe(100)
  })

  it('builds every todo class with its own count and destination', () => {
    const todos = buildTodos({
      termCode: '20262',
      missingTimetable: [{ code: '20263' }],
      missingFeeSchedules: [{ cohortCode: 'K20', systemCode: 'CLC', count: 2 }],
      fullSectionCount: 1,
      clashCount: 3,
      underCreditCount: 1,
    })
    expect(todos.map((todo) => todo.type)).toEqual([
      'MISSING_TIMETABLE',
      'MISSING_FEE_SCHEDULE',
      'FULL_SECTION',
      'SCHEDULE_CLASH',
      'UNDER_CREDIT',
    ])
    expect(todos[0]!.title).toContain('20263')
    expect(todos[1]!.title).toContain('Khoá 20 · CLC')
    expect(todos[1]!.detail).toContain('Liên hệ Phòng Tài vụ')
    expect(todos[2]!.href).toBe('/staff/registration')
    expect(todos[3]!.count).toBe(3)
    expect(todos[4]!.href).toBe('/staff/registration?tab=under-credits')
  })

  it('keeps the todo list empty when nothing is pending', () => {
    expect(
      buildTodos({
        termCode: '20262',
        missingTimetable: [],
        missingFeeSchedules: [],
        fullSectionCount: 0,
        clashCount: 0,
        underCreditCount: 0,
      }),
    ).toEqual([])
  })
})
