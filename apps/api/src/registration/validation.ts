import { HttpException } from '@nestjs/common'

import { CourseType } from '../generated/prisma/enums'

export type RegisterInput = { sectionIds: number[] }

function invalid(message: string, field: string): never {
  throw new HttpException({ code: 'INVALID_REQUEST', message, field }, 400)
}

export function registerInput(body: unknown): RegisterInput {
  const value = (body as Record<string, unknown> | null)?.sectionIds
  if (!Array.isArray(value) || value.length === 0 || value.length > 20)
    invalid('Chọn từ 1 đến 20 lớp học phần trong một lượt.', 'sectionIds')
  if (value.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0))
    invalid('Mã lớp học phần không hợp lệ.', 'sectionIds')
  return { sectionIds: [...new Set(value as number[])] }
}

export type SectionFilters = {
  q?: string
  available?: boolean
  day?: number
  courseType?: CourseType
  reserved?: boolean
}

function queryText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

export function sectionFilters(query: Record<string, unknown>): SectionFilters {
  const day = query.day === undefined || query.day === '' ? undefined : Number(query.day)
  if (day !== undefined && (!Number.isInteger(day) || day < 2 || day > 8))
    invalid('Thứ trong tuần không hợp lệ.', 'day')
  const courseType = query.courseType
  if (
    courseType !== undefined &&
    courseType !== CourseType.THEORY &&
    courseType !== CourseType.PRACTICE
  )
    invalid('Loại môn không hợp lệ.', 'courseType')
  return {
    q: queryText(query.q),
    available: query.available === 'true',
    day,
    courseType,
    reserved: query.reserved === 'true',
  }
}
