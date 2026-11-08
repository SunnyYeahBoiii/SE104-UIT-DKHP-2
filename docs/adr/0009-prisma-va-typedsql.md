# 0009. Prisma ORM v7 kèm TypedSQL cho câu lệnh nóng

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 24

## Bối cảnh

Phần lớn dữ liệu là CRUD bình thường. Nhưng đường đăng ký cần SQL chính xác: `SELECT … FOR UPDATE`, `UPDATE …
WHERE enrolled_count < capacity` trả số hàng, partial unique index, CHECK constraint, và kiểm tra trùng lịch bằng
so ngày học của buổi (ngày bắt đầu, ngày kết thúc, nhịp mỗi tuần hoặc cách tuần).

## Quyết định

- Prisma ORM v7 cho schema, migration và CRUD.
- Câu lệnh nóng viết bằng **TypedSQL**: file `prisma/sql/*.sql`, sinh kiểu bằng `prisma generate --sql`, gọi qua `$queryRawTyped`.
- Partial unique index bằng `@@unique(..., where: ...)` (preview `partialIndexes`).
- CHECK constraint thêm bằng `prisma migrate dev --create-only` rồi sửa SQL migration bằng tay.
- Interactive transaction có `timeout` / `maxWait` tường minh (mặc định 5 giây / 2 giây).
- Lan truyền transaction qua service bằng `@nestjs-cls/transactional` + `@nestjs-cls/transactional-adapter-prisma`.
- Phải chạy được với PgBouncer ở transaction mode.

## Hệ quả

- `typedSql` và `partialIndexes` là preview feature. Nếu bị bỏ thì dự phòng bằng `$queryRaw` và migration viết tay. Logic không đổi, chỉ mất kiểm tra kiểu lúc build.
- CHECK constraint không nằm trong `schema.prisma`, nên phải nhớ khi review migration.

## Phương án đã cân nhắc

- **Drizzle:** gần SQL hơn, nhưng nhóm chọn Prisma vì hệ sinh thái và công cụ migration.
- **TypeORM:** hỗ trợ khoá tốt, nhưng kiểu yếu hơn và ít được bảo trì.
- **SQL thuần (Kysely/pg):** linh hoạt nhất, nhưng phải tự viết migration và CRUD.
