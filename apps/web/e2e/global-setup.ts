import { execFileSync } from 'node:child_process'

/** E2E uses the dedicated dkhp_w39 database (apps/api/.env); the dev seed is deterministic. */
export default function globalSetup(): void {
  execFileSync('bun', ['run', '--cwd', '../api', 'db:seed'], { stdio: 'inherit' })
}
