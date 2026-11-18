import { describe, expect, it } from 'bun:test'

import { filterSections, secondsSince, updatedLabel, type MonitorSection } from '../src/lib/monitor'

const section = (over: Partial<MonitorSection>): MonitorSection => ({
  id: 1,
  code: 'SE104.P21',
  courseCode: 'SE104',
  courseName: 'Lập trình hướng đối tượng',
  systemCode: 'CQUI',
  lecturerName: 'Nguyễn Văn A',
  capacity: 80,
  enrolledCount: 1,
  fillPercent: 1,
  ...over,
})

const sections = [
  section({}),
  section({
    id: 2,
    code: 'CS106.P21',
    courseCode: 'CS106',
    capacity: 1,
    enrolledCount: 1,
    fillPercent: 100,
  }),
  section({
    id: 3,
    code: 'SE104.P23',
    systemCode: 'CLC',
    capacity: 50,
    enrolledCount: 46,
    fillPercent: 92,
  }),
  section({
    id: 4,
    code: 'IT004.P21',
    courseCode: 'IT004',
    capacity: 80,
    enrolledCount: 0,
    fillPercent: 0,
  }),
]

describe('monitoring filters', () => {
  it('selects full, near-full and small classes', () => {
    expect(filterSections(sections, 'full', '', '').map((item) => item.code)).toEqual(['CS106.P21'])
    expect(filterSections(sections, 'nearFull', '', '').map((item) => item.code)).toEqual([
      'CS106.P21',
      'SE104.P23',
    ])
    expect(filterSections(sections, 'small', '', '').map((item) => item.code)).toEqual([
      'SE104.P21',
      'CS106.P21',
      'IT004.P21',
    ])
  })

  it('combines the class-size chip with the course and system selects', () => {
    expect(filterSections(sections, 'all', 'SE104', 'CLC').map((item) => item.code)).toEqual([
      'SE104.P23',
    ])
    expect(filterSections(sections, 'nearFull', 'SE104', 'CQUI')).toEqual([])
  })

  it('formats the polling indicator from the last successful fetch', () => {
    const nowMs = Date.parse('2027-01-06T03:00:03.000Z')
    expect(secondsSince('2027-01-06T03:00:00.000Z', nowMs)).toBe(3)
    expect(secondsSince('2027-01-06T03:01:00.000Z', nowMs)).toBe(0)
    expect(updatedLabel(3)).toBe('Cập nhật 3 giây trước')
  })
})
