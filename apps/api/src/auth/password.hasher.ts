import { Injectable } from '@nestjs/common'

/** ADR-0013: argon2id behind an interface so the algorithm can change without touching callers. */
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>
  abstract verify(plain: string, hash: string): Promise<boolean>
}

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return Bun.password.hash(plain, { algorithm: 'argon2id' })
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(plain, hash)
    } catch {
      return false
    }
  }
}

export const PASSWORD_MIN_LENGTH = 8

/** The same checklist is shown in the UI and enforced here. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) problems.push('Ít nhất 8 ký tự')
  if (!/[a-z]/.test(password)) problems.push('Có chữ thường')
  if (!/[A-Z]/.test(password)) problems.push('Có chữ hoa')
  if (!/[0-9]/.test(password)) problems.push('Có chữ số')
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('Có ký tự đặc biệt')
  return problems
}
