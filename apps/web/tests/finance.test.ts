import { describe, expect, it } from 'bun:test'

import { bm7Query, groupDebtLedger, paginate, type LedgerViewRow } from '../src/lib/finance'

const row = (id: number, group: string | null): LedgerViewRow => ({
  id,
  at: '2027-01-06T02:00:00.000Z',
  type: 'BASE_TUITION',
  typeLabel: 'Học phí cố định',
  description: 'Học phí cố định',
  detail: null,
  debit: 1,
  credit: 0,
  balance: 1,
  actor: 'Hệ thống',
  relatedEntryId: null,
  receipt: null,
  group,
})

describe('D.4.3/D.4.8 finance view helpers', () => {
  it('groups consecutive recalculation rows under one heading', () => {
    const rows = [row(1, null), row(2, 'Tính lại'), row(3, 'Tính lại'), row(4, null)]
    expect(groupDebtLedger(rows).map((group) => [group.title, group.rows.length])).toEqual([
      [null, 1],
      ['Tính lại', 2],
      [null, 1],
    ])
  })

  it('paginates a report into fixed-size pages with an empty fallback', () => {
    expect(paginate([1, 2, 3], 2)).toEqual([[1, 2], [3]])
    expect(paginate([], 18)).toEqual([[]])
  })

  it('builds export/filter query strings from non-empty values only', () => {
    expect(
      bm7Query({ termCode: '20262', cohortId: '', trainingSystemId: 'all', priorityGroupId: '3' }),
    ).toBe('?termCode=20262&priorityGroupId=3')
    expect(bm7Query({ termCode: '' })).toBe('')
  })
})
