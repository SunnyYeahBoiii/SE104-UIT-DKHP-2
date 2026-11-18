import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { Role } from '../generated/prisma/enums'
import { StudentsService, type AuditContext, type StudentInput } from './students.service'

function stringField(body: unknown, name: string, required = true): string | null {
  const value = (body as Record<string, unknown> | null)?.[name]
  if (value === undefined || value === null || value === '') {
    if (required)
      throw new HttpException({ code: 'INVALID_REQUEST', message: `${name} là bắt buộc.` }, 400)
    return null
  }
  if (typeof value !== 'string')
    throw new HttpException({ code: 'INVALID_REQUEST', message: `${name} không hợp lệ.` }, 400)
  return value.trim()
}

function intField(body: unknown, name: string): number {
  const value = (body as Record<string, unknown> | null)?.[name]
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    throw new HttpException({ code: 'INVALID_REQUEST', message: `${name} không hợp lệ.` }, 400)
  return value
}

function idsField(body: unknown, name: string): number[] {
  const value = (body as Record<string, unknown> | null)?.[name]
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'number' || id <= 0))
    throw new HttpException({ code: 'INVALID_REQUEST', message: `${name} không hợp lệ.` }, 400)
  return [...new Set(value as number[])]
}

function queryInt(value: unknown, name: string): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new HttpException({ code: 'INVALID_REQUEST', message: `${name} không hợp lệ.` }, 400)
  return parsed
}

function studentInput(body: unknown): StudentInput {
  const studentCode = stringField(body, 'studentCode')!
  if (!/^\d{8}$/.test(studentCode))
    throw new HttpException(
      { code: 'INVALID_STUDENT_CODE', message: 'MSSV gồm đúng 8 chữ số.' },
      400,
    )
  const email = stringField(body, 'email', false) || null
  return {
    studentCode,
    fullName: stringField(body, 'fullName')!,
    email,
    cohortId: intField(body, 'cohortId'),
    trainingSystemId: intField(body, 'trainingSystemId'),
    priorityGroupIds: idsField(body, 'priorityGroupIds'),
  }
}

@Controller('students')
@Roles(Role.ACADEMIC_OFFICE)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  private audit(req: AuthRequest): AuditContext {
    const forwarded = req.headers['x-forwarded-for']
    const fromForwarded = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]
    return {
      actorId: req.auth?.user.id,
      requestId: req.requestId,
      ip: fromForwarded?.trim() || req.headers['x-real-ip']?.toString() || 'unknown',
    }
  }

  @Get()
  list(
    @Query('q') q: string | undefined,
    @Query('cohortId') cohortId: string | undefined,
    @Query('trainingSystemId') trainingSystemId: string | undefined,
    @Query('priorityGroupId') priorityGroupId: string | undefined,
  ) {
    return this.students.list({
      q: q?.trim() || undefined,
      cohortId: queryInt(cohortId, 'cohortId'),
      trainingSystemId: queryInt(trainingSystemId, 'trainingSystemId'),
      priorityGroupId: queryInt(priorityGroupId, 'priorityGroupId'),
    })
  }

  @Get('exists/:code')
  exists(@Param('code') code: string) {
    return this.students.exists(code)
  }

  @Get(':code')
  detail(@Param('code') code: string) {
    return this.students.detail(code)
  }

  @Post()
  @HttpCode(200)
  create(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.students.create(studentInput(body), this.audit(req))
  }

  @Patch(':code')
  @HttpCode(200)
  update(@Param('code') code: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = studentInput(body)
    if (input.studentCode !== code)
      throw new HttpException(
        {
          code: 'STUDENT_CODE_IMMUTABLE',
          message: 'MSSV không sửa được. Xoá hồ sơ rồi tạo lại nếu nhập sai.',
        },
        400,
      )
    return this.students.update(code, input, this.audit(req))
  }

  @Post(':code/reset-password')
  @HttpCode(200)
  resetPassword(@Param('code') code: string, @Req() req: AuthRequest) {
    return this.students.resetPassword(code, this.audit(req))
  }

  @Delete(':code')
  @HttpCode(200)
  remove(@Param('code') code: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.students.remove(code, stringField(body, 'studentCode') ?? '', this.audit(req))
  }
}
