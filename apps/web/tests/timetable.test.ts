import { describe, expect, it } from 'bun:test'

import {
  cohortLabel,
  draftFromSection,
  meetingWeeks,
  occursInWeek,
  reportCsv,
  shiftMeetingWeek,
  type EditorSection,
  type MeetingDraft,
  type PreviewResponse,
} from '../src/lib/timetable'

const preview: PreviewResponse = {
  termCode: '20263',
  phase: 'PREPARATION',
  canImport: true,
  reason: null,
  fileName: 'tkb.xlsx',
  rowCount: 3012,
  errors: [
    { row: 214, column: 'MÃ MH', code: 'COURSE_UNKNOWN', message: 'IT999 không có trong danh mục' },
    { row: 1102, column: 'TIẾT', code: 'SLOTS_INVALID', message: 'Tiết 12 không hợp lệ' },
  ],
  warnings: [{ row: 17, column: 'PHÒNG HỌC', code: 'ROOM_CLASH', message: 'Trùng phòng B1.14' }],
  summary: { offeredCourses: 412, sections: 1380, practiceGroups: 920, meetings: 3012 },
  existing: { offeredCourses: 0, sections: 0 },
}

describe('timetable report and labels', () => {
  it('exports every error and warning with row and column, with a UTF-8 BOM', () => {
    const csv = reportCsv(preview)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"214","MÃ MH","COURSE_UNKNOWN","IT999 không có trong danh mục"')
    expect(csv).not.toContain('"1.102"')
    expect(csv).toContain('"1102","TIẾT","SLOTS_INVALID","Tiết 12 không hợp lệ"')
    expect(csv).toContain('Cảnh báo (không chặn nhập)')
    expect(csv).toContain('"17","PHÒNG HỌC","ROOM_CLASH","Trùng phòng B1.14"')
  })

  it('quotes embedded quotes so the report stays one row per issue', () => {
    const csv = reportCsv({
      ...preview,
      errors: [{ row: 2, column: 'MÃ MH', code: 'X', message: 'Môn "IT004" sai' }],
      warnings: [],
    })
    expect(csv).toContain('"Môn ""IT004"" sai"')
  })

  it('TKB-07: shows the reserved cohort as both K-label and admission year', () => {
    expect(cohortLabel(2021)).toBe('K16 · 2021')
    expect(cohortLabel(2025)).toBe('K20 · 2025')
    expect(cohortLabel(null)).toBe('Mọi khoá')
  })
})

const meeting: MeetingDraft = {
  dayOfWeek: 3,
  startSlot: 4,
  endSlot: 6,
  room: 'A1.01',
  startDate: '2027-01-12',
  endDate: '2027-02-09',
  cadence: 2,
}

describe('section editor helpers', () => {
  it('C.4.6: previews recurring weeks and marks only weeks that have a class', () => {
    expect(meetingWeeks('2027-01-11', meeting)).toEqual([1, 3, 5])
    expect(occursInWeek(0b10101, 3)).toBe(true)
    expect(occursInWeek(0b10101, 4)).toBe(false)
  })

  it('C.4.6: copying a group schedule moves it one week later', () => {
    const copied = shiftMeetingWeek(meeting)
    expect(copied.startDate).toBe('2027-01-19')
    expect(copied.endDate).toBe('2027-02-16')
    expect(meetingWeeks('2027-01-11', copied)).toEqual([2, 4, 6])
  })

  it('LHP-01: keeps every form field when loading a saved section', () => {
    const section = {
      id: 9,
      code: 'SE104.P21.1',
      courseCode: 'SE104TH',
      courseName: 'Lập trình hướng đối tượng',
      systemCode: 'CQUI',
      lecturerCode: 'GV001',
      lecturerName: 'Nguyễn Văn A',
      capacity: 40,
      enrolledCount: 12,
      reservedAdmissionYear: 2021,
      language: 'VN',
      note: 'Nhóm 1',
      practiceMode: 'SCHEDULED',
      parentCode: 'SE104.P21',
      offeringId: 4,
      meetings: [{ ...meeting, id: 3, weeks: 0b10101, warnings: [] }],
      practiceGroupCount: 0,
      hasWarning: false,
      canEdit: true,
    } as EditorSection
    expect(draftFromSection(section)).toEqual({
      code: 'SE104.P21.1',
      courseCode: 'SE104TH',
      systemCode: 'CQUI',
      lecturerCode: 'GV001',
      capacity: 40,
      reservedAdmissionYear: 2021,
      language: 'VN',
      note: 'Nhóm 1',
      practiceMode: 'SCHEDULED',
      parentCode: 'SE104.P21',
      meetings: [meeting],
    })
  })
})
