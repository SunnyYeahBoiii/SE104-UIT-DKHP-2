import 'reflect-metadata'

import { describe, expect, it } from 'bun:test'

import {
  assertCreditsPreparation,
  assertPreparation,
  datesFromWeeks,
  parseSectionInput,
  phaseFieldErrors,
  shiftMeetingWeek,
  weeksFromDates,
  type MeetingInput,
  type SectionInput,
  type SectionSnapshot,
} from './section-policy'

const termStart = new Date('2027-01-11T00:00:00.000Z')

const meeting = (override: Partial<MeetingInput> = {}): MeetingInput => ({
  dayOfWeek: 2,
  startSlot: 1,
  endSlot: 3,
  room: '',
  startDate: '2027-01-11',
  endDate: '2027-02-08',
  cadence: 2,
  ...override,
})

const input = (override: Partial<SectionInput> = {}): SectionInput => ({
  code: 'SE104.P99',
  courseCode: 'SE104',
  systemCode: 'CQUI',
  lecturerCode: null,
  capacity: 50,
  reservedAdmissionYear: 2021,
  language: 'VN',
  note: null,
  practiceMode: null,
  parentCode: null,
  meetings: [meeting()],
  ...override,
})

const snapshot = (value: SectionInput): SectionSnapshot => ({
  ...value,
  meetings: value.meetings.map((item) => ({
    ...item,
    weeks: weeksFromDates(termStart, item.startDate, item.endDate, item.cadence),
  })),
})

const rejection = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return (error as { response?: { code?: string; fieldErrors?: Record<string, string> } })
      .response
  }
  throw new Error('Expected a rejection')
}

describe('section meetings: recurring dates and copy-one-week-later (QĐ11.9, C.4.6)', () => {
  it('TKB-06: encodes weekly and fortnightly patterns as a bitmask and decodes them back', () => {
    const weeks = weeksFromDates(termStart, '2027-01-11', '2027-02-08', 2)
    expect(weeks).toBe(0b10101)
    expect(datesFromWeeks(termStart, 2, weeks)).toEqual({
      startDate: '2027-01-11',
      endDate: '2027-02-08',
      cadence: 2,
    })
    const weekly = weeksFromDates(termStart, '2027-01-11', '2027-01-25', 1)
    expect(weekly).toBe(0b111)
    expect(datesFromWeeks(termStart, 3, weekly).cadence).toBe(1)
  })

  it('C.4.6: copying a group schedule moves every date one week later', () => {
    const copied = shiftMeetingWeek(meeting())
    expect(copied.startDate).toBe('2027-01-18')
    expect(copied.endDate).toBe('2027-02-15')
    expect(weeksFromDates(termStart, copied.startDate, copied.endDate, copied.cadence)).toBe(
      weeksFromDates(termStart, '2027-01-11', '2027-02-08', 2) << 1,
    )
  })

  it('LHP-01: a section may have no meeting at all', () => {
    const parsed = parseSectionInput(input({ meetings: [] }), termStart, () => true)
    expect(parsed.meetings).toEqual([])
  })

  it('LHP-01: rejects a zero capacity, a bad day and an unknown room', () => {
    expect(
      rejection(() => parseSectionInput(input({ capacity: 0 }), termStart, () => true))?.code,
    ).toBe('CAPACITY_INVALID')
    expect(
      rejection(() =>
        parseSectionInput(input({ meetings: [meeting({ dayOfWeek: 9 })] }), termStart, () => true),
      )?.code,
    ).toBe('DAY_INVALID')
    expect(
      rejection(() =>
        parseSectionInput(input({ meetings: [meeting({ room: 'X99' })] }), termStart, () => false),
      )?.code,
    ).toBe('ROOM_UNKNOWN')
  })
})

describe('LHP-02: phase rules for editing a section', () => {
  it('PREPARATION allows every field to change', () => {
    const before = snapshot(input())
    const after = snapshot(input({ code: 'SE104.P98', language: 'EN', meetings: [] }))
    expect(phaseFieldErrors('PREPARATION', before, after, 0)).toEqual({})
  })

  it('REGISTRATION allows capacity growth and filling an empty lecturer or room', () => {
    const before = snapshot(input({ lecturerCode: null, meetings: [meeting({ room: '' })] }))
    const after = snapshot(
      input({
        capacity: 60,
        lecturerCode: 'GV007',
        meetings: [meeting({ room: 'B1.14' })],
      }),
    )
    expect(phaseFieldErrors('REGISTRATION', before, after, 12)).toEqual({})
  })

  it('REGISTRATION rejects changing any locked field', () => {
    const before = snapshot(input())
    const after = snapshot(input({ code: 'SE104.P98' }))
    const failure = rejection(() => phaseFieldErrors('REGISTRATION', before, after, 0))
    expect(failure?.code).toBe('PHASE_LOCKED')
    expect(failure?.fieldErrors?.code).toBeTruthy()

    const changedMeeting = snapshot(input({ meetings: [meeting({ startSlot: 4 })] }))
    expect(
      rejection(() => phaseFieldErrors('ADJUSTMENT', before, changedMeeting, 0))?.fieldErrors?.[
        'meetings.0.startSlot'
      ],
    ).toBeTruthy()
    expect(
      rejection(() =>
        phaseFieldErrors('REGISTRATION', before, snapshot(input({ meetings: [] })), 0),
      )?.fieldErrors?.meetings,
    ).toBeTruthy()
  })

  it('REGISTRATION refuses a capacity below the number already registered', () => {
    const failure = rejection(() =>
      phaseFieldErrors('REGISTRATION', snapshot(input()), snapshot(input({ capacity: 3 })), 4),
    )
    expect(failure?.fieldErrors?.capacity).toContain('4')
  })

  it('REGISTRATION cannot replace an assigned lecturer or a booked room', () => {
    const before = snapshot(
      input({ lecturerCode: 'GV001', meetings: [meeting({ room: 'B1.14' })] }),
    )
    const after = snapshot(input({ lecturerCode: 'GV002', meetings: [meeting({ room: 'A1.01' })] }))
    const failure = rejection(() => phaseFieldErrors('REGISTRATION', before, after, 0))
    expect(failure?.fieldErrors?.lecturerCode).toBeTruthy()
    expect(failure?.fieldErrors?.['meetings.0.room']).toBeTruthy()
  })

  it('adding, deleting and editing credits are locked outside PREPARATION', () => {
    expect(rejection(() => assertPreparation('REGISTRATION', 'xoá lớp'))?.code).toBe('PHASE_LOCKED')
    expect(rejection(() => assertCreditsPreparation('ADJUSTMENT'))?.code).toBe('CREDITS_LOCKED')
    expect(assertCreditsPreparation('PREPARATION')).toBeUndefined()
  })
})
