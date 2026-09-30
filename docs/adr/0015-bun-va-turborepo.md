# 0015. Bun làm runtime và package manager, monorepo Turborepo

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 33 và 34

## Bối cảnh

Có ba phần (API, web, hợp đồng dùng chung) cần chia sẻ kiểu và build cùng nhau. Muốn khởi động dev bằng một lệnh,
và production đóng gói bằng Docker.

## Quyết định

- Monorepo Bun workspaces + Turborepo:
  - `apps/api` (NestJS, gồm cả entrypoint worker)
  - `apps/web` (Next.js)
  - `packages/contracts` (zod, OpenAPI)
- Bun là package manager, và là runtime của API và worker ở cả dev lẫn production (image `oven/bun`). Next.js chạy trên runtime Node.
- Dev: `bun dev` ở thư mục gốc chạy `turbo dev`. Hạ tầng (Postgres, PgBouncer, 2 Redis) chạy bằng `compose.dev.yml`.
- Production: Docker Compose gồm `web`, `api` (scale ngang), `worker`, `postgres`, `pgbouncer`, `redis-cache`, `redis-queue`, `nginx`. Không Kubernetes. CI bằng GitHub Actions.

## Hệ quả

- **Rủi ro:** NestJS và Prisma không chính thức hỗ trợ runtime Bun. Giảm thiểu bằng smoke test image production trong CI: khởi động, chạy migration, đăng ký một lớp, nhận một webhook. Nếu gãy thì đổi runtime API sang Node mà không đổi code.
- Turborepo cache build và test theo package, nên CI nhanh hơn.

## Phương án đã cân nhắc

- **pnpm + Node:** ổn định và được hỗ trợ chính thức, nhưng chậm hơn khi cài và chạy test.
- **Nx:** mạnh hơn nhưng nặng hơn so với 3 package.
