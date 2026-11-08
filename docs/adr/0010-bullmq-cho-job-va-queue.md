# 0010. BullMQ cho job định kỳ và hàng đợi

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 25

## Bối cảnh

Hệ thống cần các job định kỳ (chuyển giai đoạn học kỳ, đối soát SePay hằng ngày, xét lại đăng ký có điều kiện,
relay outbox) và hàng đợi cho việc bất đồng bộ (xử lý webhook, gửi email đóng đủ, xuất báo cáo). Redis đã có sẵn cho cache.

## Quyết định

- BullMQ qua `@nestjs/bullmq`.
- Job định kỳ dùng repeatable job:
  - chuyển giai đoạn học kỳ
  - đối soát SePay (tự ghi giao dịch bị lỡ)
  - xét lại đăng ký có điều kiện (DK-06)
  - relay outbox
- Hàng đợi `email` nhận sự kiện đóng đủ từ outbox và gửi email; gửi lỗi thì retry, không ảnh hưởng sổ cái.
- Worker chạy repeatable job là một bản duy nhất. Consumer các hàng đợi thường scale được.
- Hai Redis riêng:
  - `redis-cache` với `allkeys-lru`
  - `redis-queue` với `noeviction` và AOF `everysec`

## Hệ quả

- Không cần thêm hạ tầng message broker.
- AOF `everysec` có thể mất tối đa khoảng 1 giây job khi Redis crash. Chấp nhận được, vì nguồn sự thật là bảng outbox và `bank_transaction` trong Postgres: relay sẽ đẩy lại.
- Mọi job phải idempotent.

## Phương án đã cân nhắc

- **RabbitMQ / Kafka:** mạnh hơn nhưng thêm hạ tầng. Tải và yêu cầu hiện tại không cần.
- **pg-boss (queue trên Postgres):** ít hạ tầng hơn, nhưng dồn thêm tải lên DB vốn đã là điểm nóng.
- **Cron trong tiến trình API:** chạy trùng khi scale nhiều bản API.
