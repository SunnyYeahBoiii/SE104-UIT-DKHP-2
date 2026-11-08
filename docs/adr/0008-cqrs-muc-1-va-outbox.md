# 0008. CQRS mức 1 và outbox cho sự kiện quan trọng

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 23

## Bối cảnh

Muốn tách rõ thao tác ghi (có bất biến, có kiểm toán) khỏi thao tác đọc (nhiều, cần nhanh, SQL tuỳ biến). Nhưng
CQRS đầy đủ (read model riêng, event sourcing) tăng độ phức tạp không cần thiết. Ngoài ra, `EventBus` của
`@nestjs/cqrs` chạy trong tiến trình theo kiểu RxJS fire-and-forget: lỗi của handler chỉ đi vào
`UnhandledExceptionBus`, và sự kiện mất nếu tiến trình chết.

## Quyết định

- Dùng `CommandBus` / `QueryBus` của `@nestjs/cqrs`. Command đi qua domain logic + transaction. Query đọc thẳng bằng SQL trên cùng database, không có read model riêng.
- Sự kiện **quan trọng** (thanh toán ghi nhận, cần tự huỷ lớp) được ghi vào bảng `outbox` trong **cùng transaction** với thay đổi. Worker relay đẩy sang BullMQ.
- `EventBus` trong tiến trình chỉ dùng cho việc không quan trọng (ví dụ xoá cache).
- Không dùng `@Saga()`, không event sourcing.
- Interceptor ghi nhật ký kiểm toán cho mọi command.

## Hệ quả

- Không bao giờ có "đã ghi DB nhưng mất sự kiện" hay "phát sự kiện nhưng DB rollback".
- Consumer phải idempotent, vì outbox đảm bảo at-least-once.
- Không có độ trễ đồng bộ read model: đọc luôn thấy dữ liệu mới nhất (trừ phần cache Redis có chủ đích).

## Phương án đã cân nhắc

- **CQRS mức 2 (read model riêng, cập nhật bất đồng bộ):** đọc nhanh hơn, nhưng phải xử lý dữ liệu chưa kịp cập nhật. Cache Redis đã đủ cho tải đọc.
- **Event sourcing:** sổ cái chỉ ghi thêm ([ADR-0004](./0004-so-cai-cong-no-append-only.md)) đã cho phần lịch sử cần thiết.
- **Chỉ dùng `EventBus` cho mọi sự kiện:** mất sự kiện khi crash.
