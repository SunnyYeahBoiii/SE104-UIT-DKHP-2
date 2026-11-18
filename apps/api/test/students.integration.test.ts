import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { passwordProblems } from '../src/auth/password.hasher'
import { SESSION_COOKIE } from '../src/auth/session.store'
import { Role } from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { DEV_PASSWORD } from '../prisma/seed/scenarios'

type Body = {
  code?: string
  status?: string
  message?: string
  registrationForms?: number
  ledgerEntries?: number
  temporaryPassword?: string
  item?: {
    studentCode: string
    fullName: string
    appliedPriorityGroup?: { code: string; discountRate: number } | null
    priorityGroups?: { code: string }[]
  }
  items?: { studentCode: string }[]
  deleteBlocked?: { reason: string | null; registrationForms: number; ledgerEntries: number }
  exists?: boolean
}

const json = async (response: Response): Promise<Body> => (await response.json()) as Body

async function rejects(query: PromiseLike<unknown> | Promise<unknown>): Promise<boolean> {
  try {
    await query
    return false
  } catch {
    return true
  }
}
const cookieFrom = (response: Response) =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

const DEV_IP = '203.0.113.7'
const CREATED = ['25520991', '25520993', '25520994', '25520995', '25520996', '25520997']
const ORPHAN_USER = '25520992'

describe('students (integration: Postgres + Redis)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let academicCookie: string
  let cohortId: number
  let systemId: number
  let otherSystemId: number
  let groupIds: Record<string, number>

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)

    const login = await post('/auth/login', { username: 'pdt.hang', password: DEV_PASSWORD })
    academicCookie = cookieFrom(login)
    expect(login.status).toBe(200)

    const [cohorts, systems, groups] = await Promise.all([
      prisma.cohort.findMany(),
      prisma.trainingSystem.findMany(),
      prisma.priorityGroup.findMany(),
    ])
    cohortId = cohorts.find((item) => item.code === 'K19')!.id
    systemId = systems.find((item) => item.code === 'CQUI')!.id
    otherSystemId = systems.find((item) => item.code === 'CLC')!.id
    groupIds = Object.fromEntries(groups.map((item) => [item.code, item.id]))
  })

  afterAll(async () => {
    await prisma.student.deleteMany({ where: { studentCode: { in: CREATED } } })
    await prisma.user.deleteMany({
      where: { username: { in: [...CREATED, ORPHAN_USER] } },
    })
    await app.close()
  })

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE audit_log RESTART IDENTITY`
  })

  const request = (method: string, path: string, body?: unknown, cookie?: string) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': DEV_IP,
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const post = (path: string, body: unknown, cookie?: string) => request('POST', path, body, cookie)

  const get = (path: string, cookie = academicCookie) => request('GET', path, undefined, cookie)

  const profile = (code: string, overrides: Record<string, unknown> = {}) => ({
    studentCode: code,
    fullName: `Sinh viên ${code}`,
    email: `${code}@gm.uit.edu.vn`,
    cohortId,
    trainingSystemId: systemId,
    priorityGroupIds: [],
    ...overrides,
  })

  const create = async (code: string, overrides: Record<string, unknown> = {}) => {
    const response = await post('/students', profile(code, overrides), academicCookie)
    return { response, body: await json(response) }
  }

  it('HS-13/QĐ08.5: tạo hồ sơ và tài khoản trong cùng giao dịch, mật khẩu chỉ hiện một lần', async () => {
    const code = CREATED[0]!
    const { response, body } = await create(code)
    expect(response.status).toBe(200)
    expect(body.temporaryPassword).toBeTruthy()
    expect(passwordProblems(body.temporaryPassword!)).toEqual([])

    const user = await prisma.user.findUniqueOrThrow({ where: { username: code } })
    const student = await prisma.student.findUniqueOrThrow({ where: { studentCode: code } })
    expect(student.userId).toBe(user.id)
    expect(user.roles).toEqual([Role.STUDENT])
    expect(user.mustChangePassword).toBe(true)
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true)

    const logs = await prisma.auditLog.findMany({ where: { entityId: code } })
    expect(logs.map((log) => log.action)).toContain('STUDENT_CREATED')
    expect(JSON.stringify(logs)).not.toContain(body.temporaryPassword!)

    const login = await post('/auth/login', {
      username: code,
      password: body.temporaryPassword,
    })
    expect(login.status).toBe(200)
    expect((await json(login)).status).toBe('MUST_CHANGE_PASSWORD')
  })

  it('HS-12/QĐ08.4: MSSV trùng bị từ chối ở cả student và user_account', async () => {
    const seeded = await post('/students', profile('24520001'), academicCookie)
    expect(seeded.status).toBe(409)
    expect((await json(seeded)).code).toBe('STUDENT_CODE_EXISTS')

    await prisma.user.create({
      data: {
        username: ORPHAN_USER,
        passwordHash: await Bun.password.hash(DEV_PASSWORD, { algorithm: 'argon2id' }),
        fullName: 'Tài khoản trống',
        roles: [Role.STUDENT],
        mustChangePassword: true,
      },
    })
    const orphan = await create(ORPHAN_USER)
    expect(orphan.response.status).toBe(409)
    expect(orphan.body.code).toBe('STUDENT_CODE_EXISTS')
    expect(await prisma.student.count({ where: { studentCode: ORPHAN_USER } })).toBe(0)

    const badFormat = await create('123')
    expect(badFormat.response.status).toBe(400)
    expect(badFormat.body.code).toBe('INVALID_STUDENT_CODE')
  })

  it('HS-12/QĐ08.6: MSSV không sửa được, sửa hồ sơ ngoài đợt không đụng vào sổ cái', async () => {
    const code = CREATED[1]!
    const { response } = await create(code)
    expect(response.status).toBe(200)

    const immutable = await request(
      'PATCH',
      `/students/${code}`,
      profile('25520000'),
      academicCookie,
    )
    expect(immutable.status).toBe(400)
    expect((await json(immutable)).code).toBe('STUDENT_CODE_IMMUTABLE')

    const ledgerBefore = await prisma.ledgerEntry.count({
      where: { student: { studentCode: code } },
    })
    const updated = await request(
      'PATCH',
      `/students/${code}`,
      profile(code, {
        fullName: 'Đã sửa tên',
        cohortId: (await prisma.cohort.findUniqueOrThrow({ where: { code: 'K20' } })).id,
        trainingSystemId: otherSystemId,
        priorityGroupIds: [groupIds.HO_NGHEO!],
      }),
      academicCookie,
    )
    expect(updated.status).toBe(200)
    const detail = await json(await get(`/students/${code}`))
    expect(detail.item?.fullName).toBe('Đã sửa tên')
    expect(detail.item?.priorityGroups?.[0]?.code).toBe('HO_NGHEO')
    const ledgerAfter = await prisma.ledgerEntry.count({
      where: { student: { studentCode: code } },
    })
    expect(ledgerAfter).toBe(ledgerBefore)

    const logs = await prisma.auditLog.findMany({ where: { entityId: code } })
    expect(logs.map((log) => log.action)).toEqual(['STUDENT_CREATED', 'STUDENT_UPDATED'])
  })

  it('HS-02/QĐ08.3: nhiều đối tượng ưu tiên thì hiện đối tượng có độ ưu tiên cao nhất', async () => {
    const code = CREATED[2]!
    const { response } = await create(code, {
      priorityGroupIds: [groupIds.HO_NGHEO!, groupIds.DTTS_VUNG_SAU!],
    })
    expect(response.status).toBe(200)

    const detail = await json(await get(`/students/${code}`))
    expect(detail.item?.appliedPriorityGroup).toMatchObject({
      code: 'DTTS_VUNG_SAU',
      discountRate: 70,
    })
    expect(detail.item?.priorityGroups).toHaveLength(2)

    const filtered = await json(await get(`/students?priorityGroupId=${groupIds.DTTS_VUNG_SAU!}`))
    expect(filtered.items?.map((item) => item.studentCode)).toContain(code)
  })

  it('HS-12/QĐ08.9: xoá bị chặn khi có phiếu hoặc sổ cái; xác nhận bằng MSSV', async () => {
    const withForm = await request(
      'DELETE',
      '/students/24520001',
      { studentCode: '24520001' },
      academicCookie,
    )
    expect(withForm.status).toBe(409)
    const blockedByForm = await json(withForm)
    expect(blockedByForm.code).toBe('DELETE_BLOCKED')
    expect(blockedByForm.registrationForms).toBeGreaterThan(0)
    expect(blockedByForm.message).toContain('phiếu đăng ký')

    const withLedger = await request(
      'DELETE',
      '/students/24520002',
      { studentCode: '24520002' },
      academicCookie,
    )
    expect(withLedger.status).toBe(409)
    const blockedByLedger = await json(withLedger)
    expect(blockedByLedger.registrationForms).toBe(0)
    expect(blockedByLedger.ledgerEntries).toBeGreaterThan(0)
    expect(blockedByLedger.message).toContain('sổ cái')

    const detail = await json(await get('/students/24520002'))
    expect(detail.deleteBlocked?.reason).toContain('sổ cái')
    expect(await prisma.student.count({ where: { studentCode: '24520002' } })).toBe(1)

    const code = CREATED[3]!
    expect((await create(code)).response.status).toBe(200)
    const wrong = await request(
      'DELETE',
      `/students/${code}`,
      { studentCode: '00000000' },
      academicCookie,
    )
    expect(wrong.status).toBe(400)
    expect((await json(wrong)).code).toBe('CONFIRM_MISMATCH')

    const removed = await request(
      'DELETE',
      `/students/${code}`,
      { studentCode: code },
      academicCookie,
    )
    expect(removed.status).toBe(200)
    expect(await prisma.student.count({ where: { studentCode: code } })).toBe(0)
    expect(await prisma.user.count({ where: { username: code } })).toBe(0)
  })

  it('QĐ08.10/NFR-08: đặt lại mật khẩu thu hồi mọi phiên và bật cờ phải đổi mật khẩu', async () => {
    const code = CREATED[4]!
    const { body: created } = await create(code)
    const first = cookieFrom(
      await post('/auth/login', { username: code, password: created.temporaryPassword! }),
    )
    const second = cookieFrom(
      await post('/auth/login', { username: code, password: created.temporaryPassword! }),
    )
    expect((await get('/auth/me', first)).status).toBe(200)
    expect((await get('/auth/me', second)).status).toBe(200)

    const hashBefore = (await prisma.user.findUniqueOrThrow({ where: { username: code } }))
      .passwordHash
    const reset = await post(`/students/${code}/reset-password`, {}, academicCookie)
    expect(reset.status).toBe(200)
    const fresh = (await json(reset)).temporaryPassword!
    expect(fresh).not.toBe(created.temporaryPassword)
    expect(passwordProblems(fresh)).toEqual([])
    expect((await get('/auth/me', first)).status).toBe(401)
    expect((await get('/auth/me', second)).status).toBe(401)

    const user = await prisma.user.findUniqueOrThrow({ where: { username: code } })
    expect(user.mustChangePassword).toBe(true)
    expect(user.passwordHash).not.toBe(hashBefore)
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true)
    const relogin = await post('/auth/login', { username: code, password: fresh })
    expect((await json(relogin)).status).toBe('MUST_CHANGE_PASSWORD')
  })

  it('QV-03/NFR-10: mọi command ghi nhật ký chỉ ghi thêm, không chứa mật khẩu', async () => {
    const code = CREATED[5]!
    const { body: created } = await create(code)
    await request(
      'PATCH',
      `/students/${code}`,
      profile(code, { fullName: 'Sửa lần một' }),
      academicCookie,
    )
    await post(`/students/${code}/reset-password`, {}, academicCookie)
    await request('DELETE', `/students/${code}`, { studentCode: code }, academicCookie)

    const logs = await prisma.auditLog.findMany({ where: { entityId: code } })
    expect(logs.map((log) => log.action)).toEqual([
      'STUDENT_CREATED',
      'STUDENT_UPDATED',
      'STUDENT_PASSWORD_RESET',
      'STUDENT_DELETED',
    ])
    expect(logs.every((log) => log.actorId !== null && log.requestId && log.ip)).toBe(true)
    expect(JSON.stringify(logs)).not.toContain(created.temporaryPassword!)

    expect(
      await rejects(
        prisma.$executeRawUnsafe(
          `UPDATE audit_log SET action = 'TAMPER' WHERE entity_id = '${code}'`,
        ),
      ),
    ).toBe(true)
    expect(
      await rejects(prisma.$executeRawUnsafe(`DELETE FROM audit_log WHERE entity_id = '${code}'`)),
    ).toBe(true)
  })

  it('QV-01/QV-02: chỉ Phòng Đào tạo được quản lý hồ sơ', async () => {
    const student = cookieFrom(
      await post('/auth/login', { username: '24520001', password: DEV_PASSWORD }),
    )
    const forbidden = await get('/students', student)
    expect(forbidden.status).toBe(403)
    expect((await json(forbidden)).code).toBe('FORBIDDEN')

    const check = await get('/students/exists/24520001')
    expect((await json(check)).exists).toBe(true)
    expect((await json(await get('/students/exists/99999999'))).exists).toBe(false)
    expect((await get('/auth/me', academicCookie)).status).toBe(200)
    expect(SESSION_COOKIE).toBe('dkhp_session')
  })
})
