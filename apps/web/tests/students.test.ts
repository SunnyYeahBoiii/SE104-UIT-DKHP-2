import { describe, expect, it } from 'bun:test'

import {
  beforeAfterRows,
  profileChanged,
  type Student,
  type TuitionPreviewTerm,
} from '../src/lib/students'

const student: Student = {
  id: 1,
  studentCode: '24520013',
  fullName: 'Đinh Hoàng Phúc',
  email: '24520013@gm.uit.edu.vn',
  cohort: { id: 10, code: 'K19', admissionYear: 2019 },
  trainingSystem: { id: 1, code: 'CQUI', name: 'Chính quy' },
  priorityGroups: [],
  appliedPriorityGroup: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const payload = {
  studentCode: student.studentCode,
  fullName: student.fullName,
  email: student.email ?? '',
  cohortId: student.cohort.id,
  trainingSystemId: student.trainingSystem.id,
  priorityGroupIds: [],
}

const term: TuitionPreviewTerm = {
  termCode: '20262',
  termName: 'HK2 2026–2027',
  phase: 'REGISTRATION',
  reason: 'đổi hệ CQUI → CLC',
  creditBalance: 0,
  blocked: null,
  before: {
    baseTuition: 15_000_000,
    surcharge: 0,
    discount: 0,
    netAmount: 15_000_000,
    outstandingAmount: 15_000_000,
  },
  after: {
    baseTuition: 20_000_000,
    surcharge: 0,
    discount: 0,
    netAmount: 20_000_000,
    outstandingAmount: 20_000_000,
  },
}

describe('HS-14/C.4.3: when to ask for a tuition preview', () => {
  it('saves straight through for name or email edits', () => {
    expect(profileChanged(student, { ...payload, fullName: 'Tên mới' })).toBe(false)
  })

  it('asks for a preview on each of the three tuition-relevant fields', () => {
    expect(profileChanged(student, { ...payload, cohortId: 11 })).toBe(true)
    expect(profileChanged(student, { ...payload, trainingSystemId: 2 })).toBe(true)
    expect(profileChanged(student, { ...payload, priorityGroupIds: [3] })).toBe(true)
  })

  it('ignores priority group ordering', () => {
    const withGroups = {
      ...student,
      priorityGroups: [
        { id: 1, code: 'A', name: 'A', discountRate: 10, priority: 2 },
        { id: 2, code: 'B', name: 'B', discountRate: 20, priority: 1 },
      ],
    }
    expect(profileChanged(withGroups, { ...payload, priorityGroupIds: [2, 1] })).toBe(false)
  })
})

describe('A.3.5 BeforeAfter: the five figures shown in the confirmation dialog', () => {
  it('lays out before, after and the signed difference', () => {
    const rows = beforeAfterRows(term)
    expect(rows.map((row) => row.label)).toEqual([
      'Học phí cố định',
      'Phụ thu',
      'Giảm trừ',
      'Số tiền phải đóng',
      'Số tiền còn lại',
    ])
    expect(rows[0]).toMatchObject({ before: 15_000_000, after: 20_000_000, delta: 5_000_000 })
    expect(rows[3]).toMatchObject({ before: 15_000_000, after: 20_000_000 })
  })

  it('shows a negative difference as a saving', () => {
    const cheaper: TuitionPreviewTerm = {
      ...term,
      after: {
        baseTuition: 14_500_000,
        surcharge: 0,
        discount: 0,
        netAmount: 14_500_000,
        outstandingAmount: -100_000,
      },
    }
    expect(beforeAfterRows(cheaper)[4]).toMatchObject({
      before: 15_000_000,
      after: -100_000,
      delta: -15_100_000,
    })
  })
})
